const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5175";
const API_BASE = process.env.API_BASE || "http://127.0.0.1:3007/api";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForSaved(page) {
  await page.waitForFunction(
    () => document.querySelector(".writer-save")?.textContent === "Saved",
    { timeout: 15000 },
  );
}

(async () => {
  const { tokenA, ownerA } = JSON.parse(
    fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"),
  );
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenA}`,
  };

  const createRes = await fetch(`${API_BASE}/writer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Highlight Popover Verification" }),
  });
  assert.equal(createRes.status, 201);
  const createdDoc = await createRes.json();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.setViewport({ width: 1440, height: 960 });
    await page.evaluateOnNewDocument(
      (token) => localStorage.setItem("auth_token", token),
      tokenA,
    );

    await page.goto(`${FRONTEND_URL}/writer/${createdDoc.id}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector(".writer-content");

    const content = () => page.$eval(".writer-content", (el) => el.editor.getJSON());
    const select = (from, to) =>
      page.$eval(
        ".writer-content",
        (el, range) => el.editor.chain().focus().setTextSelection(range).run(),
        { from, to },
      );
    const clickBtn = async (label) => {
      const btns = await page.$$("button");
      for (const b of btns) {
        const text = await b.evaluate(
          (el) => el.getAttribute("aria-label") || el.textContent.trim(),
        );
        if (text === label) {
          await b.click();
          return;
        }
      }
      throw new Error(`Button not found: ${label}`);
    };

    const openPopover = async () => {
      await clickBtn("Highlight text");
      await page.waitForSelector(".writer-highlight-popover");
    };

    // -------------------------------------------------------------------------
    // 1. Popover structure and compact swatch palette count
    // -------------------------------------------------------------------------
    await openPopover();
    const popoverMeta = await page.$eval(".writer-highlight-popover", (el) => {
      const swatches = el.querySelectorAll(".writer-highlight-swatch-btn");
      const noneBtn = el.querySelector(".writer-highlight-none-btn");
      const rect = el.getBoundingClientRect();
      return {
        swatchCount: swatches.length,
        hasNoneBtn: Boolean(noneBtn),
        noneText: noneBtn?.textContent?.trim(),
        width: rect.width,
        height: rect.height,
      };
    });
    assert.equal(popoverMeta.swatchCount, 27); // 9 families x 3 shades
    assert.equal(popoverMeta.hasNoneBtn, true);
    assert.equal(popoverMeta.noneText, "Remove highlight");
    assert.ok(popoverMeta.width <= 270, `Popover width ${popoverMeta.width} exceeds compact limit`);
    checks.push("compact-popover-27-swatches-and-remove-action");

    // Close popover via click outside
    await page.mouse.click(10, 10);
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });
    checks.push("click-outside-closes-popover");

    // -------------------------------------------------------------------------
    // 2. Select text -> open palette -> choose Yellow (immediate apply & close)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Important notice for everyone" }],
          },
        ],
      });
    });
    // Select "Important notice" (1 to 17)
    await select(1, 17);
    await openPopover();
    // Click Yellow swatch
    await clickBtn("Yellow");
    // Verify popover closed automatically
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });

    const yellowMarks = await page.$eval(".writer-content", (el) => {
      const firstText = el.editor.state.doc.firstChild.firstChild;
      return firstText.marks.map((m) => m.toJSON());
    });
    assert.deepEqual(yellowMarks, [
      { type: "highlight", attrs: { color: "#fef08a" } },
    ]);
    assert.equal(
      await page.$eval(".writer-content mark", (el) => el.textContent),
      "Important notice",
    );
    checks.push("select-text-apply-yellow-and-autoclose");

    // -------------------------------------------------------------------------
    // 3. Toolbar indicator indicates active color
    // -------------------------------------------------------------------------
    // Place caret inside the highlighted word
    await select(5, 5);
    const indicatorColor = await page.$eval(
      ".writer-highlight-indicator",
      (el) => el.style.backgroundColor,
    );
    // rgb(254, 240, 138) is #fef08a
    assert.ok(
      indicatorColor.includes("254, 240, 138") || indicatorColor.includes("#fef08a"),
      `Unexpected indicator color: ${indicatorColor}`,
    );

    // Reopen popover -> verify Yellow is active with checkmark and aria-pressed="true"
    await openPopover();
    const activeColorMeta = await page.$eval(
      '.writer-highlight-popover button[aria-pressed="true"]',
      (btn) => ({
        label: btn.getAttribute("aria-label"),
        hasCheck: Boolean(btn.querySelector(".writer-swatch-check")),
      }),
    );
    assert.equal(activeColorMeta.label, "Yellow");
    assert.equal(activeColorMeta.hasCheck, true);
    checks.push("toolbar-indicator-and-active-swatch-state");
    await page.keyboard.press("Escape");
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });

    // -------------------------------------------------------------------------
    // 4. Change Yellow -> Green (#bbf7d0)
    // -------------------------------------------------------------------------
    await select(1, 17);
    await openPopover();
    await clickBtn("Green");
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });
    const greenMarks = await page.$eval(".writer-content", (el) => {
      const firstText = el.editor.state.doc.firstChild.firstChild;
      return firstText.marks.map((m) => m.toJSON());
    });
    assert.equal(greenMarks[0].attrs.color, "#bbf7d0");
    checks.push("change-color-yellow-to-green");

    // -------------------------------------------------------------------------
    // 5. Remove highlight -> removes only highlight, preserves other formatting
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor
        .chain()
        .focus()
        .setTextSelection({ from: 1, to: 17 })
        .toggleBold()
        .setLink({ href: "https://example.com" })
        .run();
    });
    await select(1, 17);
    await openPopover();
    await clickBtn("Remove highlight");
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });

    const marksAfterRemove = await page.$eval(".writer-content", (el) => {
      const firstText = el.editor.state.doc.firstChild.firstChild;
      return (firstText?.marks || []).map((m) => m.type.name);
    });
    assert.ok(!marksAfterRemove.includes("highlight"));
    assert.ok(marksAfterRemove.includes("bold"));
    assert.ok(marksAfterRemove.includes("link"));
    checks.push("remove-highlight-preserves-bold-and-link");

    // -------------------------------------------------------------------------
    // 6. Escape key closes popover without changing document
    // -------------------------------------------------------------------------
    await openPopover();
    await page.keyboard.press("Escape");
    await page.waitForSelector(".writer-highlight-popover", { hidden: true });
    // Verify document content unchanged
    const docAfterEsc = await content();
    assert.equal(docAfterEsc.content[0].content[0].text, "Important notice");
    checks.push("escape-closes-popover-without-modification");

    // -------------------------------------------------------------------------
    // 7. Undo / Redo behavior
    // -------------------------------------------------------------------------
    await select(1, 17);
    await openPopover();
    await clickBtn("Yellow");
    await wait(300);

    // Undo -> highlight removed
    await clickBtn("Undo");
    const afterUndoMarks = await page.$eval(".writer-content", (el) => {
      const firstText = el.editor.state.doc.firstChild.firstChild;
      return (firstText?.marks || []).map((m) => m.type.name);
    });
    assert.ok(!afterUndoMarks.includes("highlight"));

    // Redo -> yellow restored
    await clickBtn("Redo");
    const afterRedoMarks = await page.$eval(".writer-content", (el) => {
      const firstText = el.editor.state.doc.firstChild.firstChild;
      return firstText.marks.map((m) => m.toJSON());
    });
    assert.equal(afterRedoMarks.find((m) => m.type === "highlight")?.attrs?.color, "#fef08a");
    checks.push("undo-redo-highlight-support");

    // -------------------------------------------------------------------------
    // 8. Multiple highlight colors in one document / paragraph
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Yellow ", marks: [{ type: "highlight", attrs: { color: "#fef08a" } }] },
              { type: "text", text: "Green ", marks: [{ type: "highlight", attrs: { color: "#bbf7d0" } }] },
              { type: "text", text: "Blue ", marks: [{ type: "highlight", attrs: { color: "#bfdbfe" } }] },
              { type: "text", text: "Pink ", marks: [{ type: "highlight", attrs: { color: "#fbcfe8" } }] },
              { type: "text", text: "Teal ", marks: [{ type: "highlight", attrs: { color: "#99f6e4" } }] },
              { type: "text", text: "Coral ", marks: [{ type: "highlight", attrs: { color: "#fecaca" } }] },
              { type: "text", text: "Plain" },
            ],
          },
        ],
      });
    });
    await waitForSaved(page);

    const docMulti = await content();
    assert.equal(docMulti.content[0].content.length, 7);
    checks.push("multiple-highlight-colors-in-one-paragraph");

    // -------------------------------------------------------------------------
    // 9. Autosave and server reload persistence
    // -------------------------------------------------------------------------
    const serverDoc = await fetch(`${API_BASE}/writer/${createdDoc.id}`, { headers }).then((r) => r.json());
    assert.deepEqual(serverDoc.content, docMulti);

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-content");
    const reloadedContent = await content();
    assert.deepEqual(reloadedContent, docMulti);
    checks.push("autosave-and-refresh-persistence");

    // -------------------------------------------------------------------------
    // 10. IndexedDB recovery persistence
    // -------------------------------------------------------------------------
    await page.setRequestInterception(true);
    const failHandler = (r) =>
      r.method() === "PATCH"
        ? r.respond({
            status: 503,
            contentType: "application/json",
            headers: {
              "access-control-allow-origin": "http://127.0.0.1:5175",
              "access-control-allow-credentials": "true",
            },
            body: '{"message":"Test outage"}',
          })
        : r.continue();
    page.on("request", failHandler);

    await select(1, 7);
    await openPopover();
    await clickBtn("Pink");
    await page.waitForFunction(() =>
      document.querySelector(".writer-save")?.textContent.includes("Unable to save"),
    );

    const records = await page.evaluate(async (owner, id) => {
      const store = (await import("/src/writer/recovery-store.ts")).recoveryStore;
      return store.list(owner, id);
    }, ownerA, createdDoc.id);
    assert.ok(records.length > 0);
    assert.ok(JSON.stringify(records).includes("#fbcfe8"));
    checks.push("indexeddb-recovery-preserves-highlight-draft");

    page.off("request", failHandler);
    await page.setRequestInterception(false);
    await waitForSaved(page);

    // -------------------------------------------------------------------------
    // 11. Backend PDF export parity
    // -------------------------------------------------------------------------
    const latestDoc = await fetch(`${API_BASE}/writer/${createdDoc.id}`, { headers }).then((r) => r.json());
    const exportRes = await fetch(`${API_BASE}/writer/${createdDoc.id}/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({ revision: latestDoc.revision }),
    });
    assert.equal(exportRes.status, 201);
    const pdfPath = "/tmp/writer-highlight-test.pdf";
    fs.writeFileSync(pdfPath, Buffer.from(await exportRes.arrayBuffer()));
    const pdfText = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
    assert.match(pdfText, /Yellow Green Blue Pink Teal Coral Plain/);
    fs.unlinkSync(pdfPath);
    checks.push("backend-pdf-export-parity");

    // -------------------------------------------------------------------------
    // 12. Mobile viewports & Dark mode check
    // -------------------------------------------------------------------------
    for (const width of [320, 375, 390, 430]) {
      await page.setViewport({ width, height: 800 });
      await wait(100);

      // Verify no horizontal document overflow
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `Horizontal overflow at width ${width}`);

      // Scroll toolbar and open highlight popover on mobile
      await page.$eval(".writer-toolbar", (el) => (el.scrollLeft = el.scrollWidth));
      await openPopover();

      // Check popover is within viewport bounds
      const popoverBounds = await page.$eval(".writer-highlight-popover", (el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          innerWidth: window.innerWidth,
          withinViewport: r.left >= 0 && r.right <= window.innerWidth + 2,
        };
      });
      assert.equal(popoverBounds.withinViewport, true, `Popover bounds out of screen at ${width}: ${JSON.stringify(popoverBounds)}`);

      await page.keyboard.press("Escape");
      await page.waitForSelector(".writer-highlight-popover", { hidden: true });
    }
    checks.push("mobile-viewports-320-375-390-430-no-overflow");

    // Dark mode verification
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await openPopover();
    const darkPopoverVisible = await page.$eval(".writer-highlight-popover", (el) => {
      const cs = window.getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    });
    assert.equal(darkPopoverVisible, true);
    await page.keyboard.press("Escape");
    checks.push("dark-mode-popover-rendered-cleanly");

    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
