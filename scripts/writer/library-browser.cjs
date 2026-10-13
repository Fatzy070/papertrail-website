const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const { fixture } = require("./fixture.cjs");

const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const origin = "http://127.0.0.1:5175";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiRaw(path, method = "GET", body, token = auth.tokenA) {
  return fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function api(path, method = "GET", body, token = auth.tokenA) {
  const response = await apiRaw(path, method, body, token);
  if (!response.ok) {
    const errText = await response.text();
    assert.fail(`${method} ${path}: ${response.status} ${errText}`);
  }
  return response.json();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];

  const newPage = async (token = auth.tokenA) => {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      token,
    );
    p.on("pageerror", (error) => {
      console.error("PAGE ERROR", error);
    });
    p.on("dialog", (d) => void d.accept());
    return p;
  };

  try {
    // Clean up any pre-existing Writer documents for ownerA/ownerB
    for (const token of [auth.tokenA, auth.tokenB]) {
      while (true) {
        const trashed = await api("/writer?page=1&limit=50&status=trash", "GET", undefined, token);
        const dirtyTrashed = trashed.items.filter((item) => item.title !== "__cleanup__");
        if (!dirtyTrashed.length) break;
        for (const item of dirtyTrashed) {
          await api(`/writer/${item.id}/restore`, "POST", undefined, token);
        }
      }
      while (true) {
        const res = await api("/writer?page=1&limit=50&status=active", "GET", undefined, token);
        if (!res.items.length) break;
        for (const item of res.items) {
          if (item.title !== "__cleanup__") {
            await api(`/writer/${item.id}/title`, "PATCH", { title: "__cleanup__" }, token);
          }
          await api(`/writer/${item.id}`, "DELETE", undefined, token);
        }
      }
    }

    // 1. Metadata-only list payload check (Section 6 & 40)
    const heavyDoc = await api("/writer", "POST", { title: "Heavy Document" });
    await api(`/writer/${heavyDoc.id}`, "PATCH", {
      title: "Heavy Document",
      content: fixture,
      pageSettings: {
        size: "Letter",
        orientation: "landscape",
        margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
      },
      revision: heavyDoc.revision,
    });
    const listCheck = await api("/writer?page=1&limit=10");
    assert.equal(listCheck.items.length, 1);
    assert.equal(listCheck.items[0].id, heavyDoc.id);
    assert.equal("content" in listCheck.items[0], false, "List payload must omit full Tiptap content");
    assert.equal(listCheck.items[0].pageSettings.size, "Letter");
    assert.equal(listCheck.items[0].pageSettings.orientation, "landscape");
    checks.push("metadata-only-list-payload");

    await api(`/writer/${heavyDoc.id}`, "DELETE");

    // 2. Pagination test: 25 Writer documents, limit 10 -> Page 1: 10, Page 2: 10, Page 3: 5 (Section 28)
    const createdIds = [];
    const specialTitles = [
      "Project Proposal",
      "School Report",
      "Invoice Draft",
    ];
    for (let i = 0; i < 25; i++) {
      const title =
        i < specialTitles.length
          ? specialTitles[i]
          : `Paginated Doc ${String(i + 1).padStart(2, "0")}`;
      const d = await api("/writer", "POST", { title });
      createdIds.push(d.id);
    }

    const p1 = await api("/writer?page=1&limit=10");
    const p2 = await api("/writer?page=2&limit=10");
    const p3 = await api("/writer?page=3&limit=10");
    assert.equal(p1.items.length, 10);
    assert.equal(p2.items.length, 10);
    assert.equal(p3.items.length, 5);
    assert.equal(p1.total, 25);
    assert.equal(p1.totalPages, 3);
    const combinedIds = new Set([
      ...p1.items.map((x) => x.id),
      ...p2.items.map((x) => x.id),
      ...p3.items.map((x) => x.id),
    ]);
    assert.equal(combinedIds.size, 25, "No duplicate or missing documents across pages");
    for (const id of createdIds) {
      assert.ok(combinedIds.has(id), `Expected created doc ${id} in paginated results`);
    }

    // Verify pagination in the browser UI on /documents?type=writer
    const page = await newPage(auth.tokenA);
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${origin}/documents?type=writer`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-doc-row");
    assert.equal((await page.$$(".writer-doc-row")).length, 10);
    const page1Summary = await page.$eval(".writer-pagination-summary", (el) => el.textContent);
    assert.equal(page1Summary.trim(), "Page 1 of 3");
    const metaText = await page.$eval(".writer-library-meta", (el) => el.textContent);
    assert.ok(metaText.includes("25 documents"));

    // Click Next -> Page 2 (10 docs)
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".writer-pagination-buttons button")];
      buttons.find((b) => b.textContent.includes("Next")).click();
    });
    await page.waitForFunction(
      () => document.querySelector(".writer-pagination-summary")?.textContent?.trim() === "Page 2 of 3",
    );
    assert.equal((await page.$$(".writer-doc-row")).length, 10);

    // Click Next -> Page 3 (5 docs)
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".writer-pagination-buttons button")];
      buttons.find((b) => b.textContent.includes("Next")).click();
    });
    await page.waitForFunction(
      () => document.querySelector(".writer-pagination-summary")?.textContent?.trim() === "Page 3 of 3",
    );
    assert.equal((await page.$$(".writer-doc-row")).length, 5);
    checks.push("pagination-25-docs-10-10-5");

    // 3. Search test (Section 29): Project Proposal, School Report, Invoice Draft -> search "proposal"
    const searchApi = await api("/writer?search=proposal");
    assert.equal(searchApi.total, 1);
    assert.equal(searchApi.items[0].title, "Project Proposal");

    // Browser search input test
    const searchInput = await page.$(".writer-search-field input");
    await searchInput.click({ clickCount: 3 });
    await searchInput.type("proposal");
    await page.waitForFunction(
      () => document.querySelectorAll(".writer-doc-row").length === 1,
    );
    const matchedTitle = await page.$eval(".writer-doc-title", (el) => el.textContent);
    assert.equal(matchedTitle, "Project Proposal");

    // Search with no matches -> intentional search-empty state
    await searchInput.click({ clickCount: 3 });
    await searchInput.type("nonexistent-xyz-[regex]");
    await page.waitForSelector(".writer-empty-state");
    const emptyText = await page.$eval(".writer-empty-state", (el) => el.textContent);
    assert.ok(emptyText.includes("No documents match"));

    // Clear search
    await page.click(".writer-empty-state button");
    await page.waitForFunction(
      () => document.querySelectorAll(".writer-doc-row").length === 10,
    );
    checks.push("search-filter-and-empty-state");

    // 4. Sorting & Timestamp Integrity (Section 10 & 19)
    await page.select(".writer-sort-field select", "title:asc");
    await page.waitForFunction(
      () => document.querySelector(".writer-doc-title")?.textContent === "Invoice Draft",
    );
    const firstSortedTitle = await page.$eval(".writer-doc-title", (el) => el.textContent);
    assert.equal(firstSortedTitle, "Invoice Draft");

    // Verify GET /writer/:id does NOT mutate updatedAt
    const proposalDocBefore = await api(`/writer/${createdIds[0]}`);
    await wait(50);
    const proposalDocAfterGet = await api(`/writer/${createdIds[0]}`);
    assert.equal(proposalDocAfterGet.updatedAt, proposalDocBefore.updatedAt);
    checks.push("sorting-and-timestamp-integrity");

    // 5. Rename test (Section 30): Rename "Invoice Draft" -> "Client Proposal"
    await page.click(".writer-doc-row .writer-menu-trigger");
    await page.waitForSelector(".writer-menu-popover");
    await page.evaluate(() => {
      const items = [...document.querySelectorAll(".writer-menu-item")];
      items.find((el) => el.textContent.trim() === "Rename").click();
    });
    await page.waitForSelector('.writer-create input[aria-label="New document title"]');
    await page.evaluate(() => {
      const input = document.querySelector('.writer-create input[aria-label="New document title"]');
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, "Client Proposal");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click('.writer-dialog-actions button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForFunction(
      () => document.querySelector(".writer-doc-title")?.textContent === "Client Proposal",
    );

    // Confirm invalid empty rename is rejected on API
    const badRename = await apiRaw(`/writer/${createdIds[2]}/title`, "PATCH", { title: "   " });
    assert.equal(badRename.status, 400);

    // Confirm opening /writer/:id shows "Client Proposal" and persists after refresh
    await page.goto(`${origin}/writer/${createdIds[2]}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".writer-title input");
    await page.waitForFunction(
      () => document.querySelector(".writer-title input")?.value === "Client Proposal",
    );
    await page.goto(`${origin}/documents?type=writer`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-doc-row");
    const firstActiveTitle = await page.$eval(".writer-doc-title", (el) => el.textContent);
    assert.equal(firstActiveTitle, "Client Proposal");
    checks.push("rename-modal-and-persistence");

    // 6. Trash + Restore + Local Draft Recovery preservation (Sections 12, 13, 14, 31, 32)
    // First create a local IndexedDB draft on Client Proposal while offline
    await page.goto(`${origin}/writer/${createdIds[2]}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".writer-content");
    await page.setRequestInterception(true);
    const patchBlocker = (req) => {
      if (req.method() === "PATCH" && req.url().includes(`/api/writer/${createdIds[2]}`)) {
        req.respond({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Simulated offline"}',
        });
      } else {
        req.continue();
      }
    };
    page.on("request", patchBlocker);
    await page.$eval(
      ".writer-content",
      (el) => el.editor.chain().focus("end").insertContent("LOCAL_DRAFT_SURVIVES_TRASH").run(),
    );
    await wait(500);
    const storedBeforeTrash = await page.evaluate(
      async (a, d) =>
        (await import("/src/writer/recovery-store.ts")).recoveryStore.list(a, d),
      auth.ownerA,
      createdIds[2],
    );
    assert.equal(storedBeforeTrash.length, 1);
    page.off("request", patchBlocker);
    await page.setRequestInterception(false);

    // Go back to Writer library and Move to trash via confirmation dialog
    await page.goto(`${origin}/documents?type=writer`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-doc-row");
    await page.click(".writer-doc-row .writer-menu-trigger");
    await page.waitForSelector(".writer-menu-popover");
    await page.evaluate(() => {
      const items = [...document.querySelectorAll(".writer-menu-item")];
      items.find((el) => el.textContent.trim() === "Move to trash").click();
    });
    await page.waitForSelector(".writer-danger-button");
    await page.click(".writer-danger-button");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));

    // Wait for Client Proposal to be removed from active list (total drops from 25 to 24)
    await page.waitForFunction(
      () => document.querySelector(".writer-library-meta")?.textContent?.includes("24 documents"),
    );

    // Direct GET /writer/:id must return 404 while trashed
    const trashedGet = await apiRaw(`/writer/${createdIds[2]}`, "GET");
    assert.equal(trashedGet.status, 404);

    // Opening /writer/:id while trashed must NOT delete the local IndexedDB recovery draft
    await page.goto(`${origin}/writer/${createdIds[2]}`, { waitUntil: "networkidle0" });
    await page.waitForSelector('.writer-load[role="alert"]');
    const storedWhileTrashed = await page.evaluate(
      async (a, d) =>
        (await import("/src/writer/recovery-store.ts")).recoveryStore.list(a, d),
      auth.ownerA,
      createdIds[2],
    );
    assert.equal(storedWhileTrashed.length, 1, "Local recovery draft must survive while trashed");

    // Switch to Trash view in Writer library and confirm Client Proposal is listed
    await page.goto(`${origin}/documents?type=writer`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-status-tabs");
    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll(".writer-status-tabs button")];
      tabs.find((b) => b.textContent.trim() === "Trash").click();
    });
    await page.waitForFunction(() => {
      const titles = [...document.querySelectorAll(".writer-doc-title")].map((e) => e.textContent);
      return titles.includes("Client Proposal");
    });

    // Click Restore on Client Proposal
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".writer-doc-row")];
      const targetRow = rows.find((r) =>
        r.querySelector(".writer-doc-title")?.textContent === "Client Proposal",
      );
      targetRow.querySelector(".writer-restore-inline").click();
    });
    await page.waitForFunction(() => {
      const titles = [...document.querySelectorAll(".writer-doc-title")].map((e) => e.textContent);
      return !titles.includes("Client Proposal");
    });

    // Reopen /writer/:id and verify both server doc and local recovery prompt work!
    await page.goto(`${origin}/writer/${createdIds[2]}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("dialog[open]");
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("dialog button")];
      buttons.find((b) => b.textContent.trim() === "Recover changes").click();
    });
    await page.waitForSelector(".writer-content");
    await page.waitForFunction(
      () => document.querySelector(".writer-save")?.textContent === "Saved",
    );
    const restoredServerDoc = await api(`/writer/${createdIds[2]}`);
    assert.ok(JSON.stringify(restoredServerDoc.content).includes("LOCAL_DRAFT_SURVIVES_TRASH"));
    checks.push("trash-restore-and-recovery-survival");

    // 7. Ownership & Isolation test (Section 18 & 33)
    const userBList = await api("/writer", "GET", undefined, auth.tokenB);
    assert.equal(userBList.total, 0);
    assert.equal(userBList.items.length, 0);
    const userBSearch = await api("/writer?search=Proposal", "GET", undefined, auth.tokenB);
    assert.equal(userBSearch.total, 0);
    assert.equal((await apiRaw(`/writer/${createdIds[0]}`, "GET", undefined, auth.tokenB)).status, 404);
    assert.equal(
      (await apiRaw(`/writer/${createdIds[0]}/title`, "PATCH", { title: "Hacked" }, auth.tokenB)).status,
      404,
    );
    assert.equal((await apiRaw(`/writer/${createdIds[0]}`, "DELETE", undefined, auth.tokenB)).status, 404);
    assert.equal(
      (await apiRaw(`/writer/${heavyDoc.id}/restore`, "POST", undefined, auth.tokenB)).status,
      404,
    );
    checks.push("ownership-isolation");

    // 8. 100+ Documents Dataset test (Section 39)
    for (let i = 25; i < 105; i++) {
      await api("/writer", "POST", { title: `Scale Doc ${String(i + 1).padStart(3, "0")}` });
    }
    const scalePage1 = await api("/writer?page=1&limit=10");
    assert.equal(scalePage1.total, 105);
    assert.equal(scalePage1.totalPages, 11);
    assert.equal(scalePage1.items.length, 10);
    assert.equal("content" in scalePage1.items[0], false);

    await page.goto(`${origin}/documents?type=writer`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-pagination-summary");
    const scaleSummary = await page.$eval(".writer-pagination-summary", (el) => el.textContent);
    assert.equal(scaleSummary.trim(), "Page 1 of 11");
    const scaleMeta = await page.$eval(".writer-library-meta", (el) => el.textContent);
    assert.ok(scaleMeta.includes("105 documents"));
    checks.push("105-documents-paginated-scale");

    // 9. Responsive & Theme Verification (Sections 20, 21, 34-38)
    const viewports = [
      { width: 320, height: 640 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
      }, theme);
      for (const vp of viewports) {
        await page.setViewport(vp);
        await wait(60);
        const layout = await page.evaluate(() => {
          const docOverflow =
            document.documentElement.scrollWidth > window.innerWidth;
          const row = document.querySelector(".writer-doc-row");
          const rowRect = row?.getBoundingClientRect();
          const menuBtn = document.querySelector(".writer-menu-trigger");
          const menuRect = menuBtn?.getBoundingClientRect();
          return {
            docOverflow,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            rowFits: rowRect ? rowRect.right <= window.innerWidth + 1 : false,
            menuVisible: menuRect
              ? menuRect.width >= 30 && menuRect.right <= window.innerWidth + 1
              : false,
          };
        });
        assert.equal(
          layout.docOverflow,
          false,
          `Horizontal overflow at ${vp.width}px (${theme}): scrollWidth=${layout.scrollWidth} > innerWidth=${layout.innerWidth}`,
        );
        assert.equal(layout.rowFits, true, `Row overflow at ${vp.width}px (${theme})`);
        assert.equal(layout.menuVisible, true, `Menu trigger clipped at ${vp.width}px (${theme})`);
      }
    }
    checks.push("responsive-320-to-1440-light-and-dark");

    // 10. Existing PDF document library regression check (Section 4 & 43)
    await page.setViewport({ width: 1280, height: 800 });
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    };
    let mockPdfDocs = [
      {
        id: "pdf-doc-1",
        name: "Quarterly Financials.pdf",
        mimeType: "application/pdf",
        size: 204800,
        pageCount: 4,
        currentVersionNumber: 1,
        isStarred: false,
        deletedAt: undefined,
        lastOpenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pdf-doc-2",
        name: "Signed Agreement.pdf",
        mimeType: "application/pdf",
        size: 102400,
        pageCount: 2,
        currentVersionNumber: 1,
        isStarred: true,
        deletedAt: undefined,
        lastOpenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/documents")) {
        if (req.method() === "OPTIONS") {
          req.respond({ status: 204, headers: corsHeaders });
          return;
        }
        if (url.pathname === "/api/documents" && req.method() === "GET") {
          const filter = url.searchParams.get("filter");
          const list =
            filter === "trash"
              ? mockPdfDocs.filter((d) => Boolean(d.deletedAt))
              : mockPdfDocs.filter((d) => !d.deletedAt);
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify(list),
          });
          return;
        }
        if (url.pathname === "/api/documents/pdf-doc-1" && req.method() === "PATCH") {
          const body = JSON.parse(req.postData() || "{}");
          mockPdfDocs = mockPdfDocs.map((d) => {
            if (d.id !== "pdf-doc-1") return d;
            if (body.isDeleted) return { ...d, deletedAt: new Date().toISOString() };
            if (body.restore) return { ...d, deletedAt: undefined };
            return { ...d, ...body };
          });
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify(mockPdfDocs[0]),
          });
          return;
        }
      }
      req.continue();
    });

    // Navigate to /documents (PDF tab)
    await page.goto(`${origin}/documents`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Quarterly Financials.pdf"),
    );
    assert.ok(
      await page.evaluate(() =>
        document.body.textContent?.includes("Signed Agreement.pdf"),
      ),
    );

    // Search PDF documents
    await page.type('input[aria-label="Search documents"]', "Quarterly");
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes("Quarterly Financials.pdf") &&
        !document.body.textContent?.includes("Signed Agreement.pdf"),
    );

    // Clear search
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Search documents"]');
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Signed Agreement.pdf"),
    );

    // Rename PDF document
    await page.click('button[aria-label="Actions for Quarterly Financials.pdf"]');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Rename").click();
    });
    await page.waitForSelector("dialog[open] input");
    await page.evaluate(() => {
      const input = document.querySelector("dialog[open] input");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, "Q4 Financials.pdf");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("dialog[open] button")];
      btns.find((b) => b.textContent.trim() === "Save name").click();
    });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Q4 Financials.pdf"),
    );

    // Move PDF document to trash
    await page.click('button[aria-label="Actions for Q4 Financials.pdf"]');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Move to trash" || b.textContent.trim() === "Delete").click();
    });
    await page.waitForSelector("dialog[open]");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("dialog[open] button")];
      btns.find((b) => b.textContent.trim() === "Delete").click();
    });
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Q4 Financials.pdf"),
    );

    // Restore PDF document from /trash
    await page.goto(`${origin}/trash`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Q4 Financials.pdf"),
    );
    await page.click('button[aria-label="Actions for Q4 Financials.pdf"]');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Restore").click();
    });
    await page.waitForFunction(
      () => !document.body.textContent?.includes("Q4 Financials.pdf"),
    );

    // Return to /documents and verify clicking a PDF document opens /documents/:id/edit
    await page.goto(`${origin}/documents`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() =>
      document.body.textContent?.includes("Q4 Financials.pdf"),
    );
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("tbody tr button")].find((b) =>
        b.textContent.includes("Q4 Financials.pdf"),
      );
      btn.click();
    });
    await page.waitForFunction(() =>
      window.location.pathname === "/documents/pdf-doc-1/edit",
    );
    assert.equal(new URL(page.url()).pathname, "/documents/pdf-doc-1/edit");
    checks.push("pdf-library-regression");

    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
