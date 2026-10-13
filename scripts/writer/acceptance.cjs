const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");
const { fixture, paragraph } = require("./fixture.cjs");
const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const headers = (t) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${t}`,
});
async function api(path, method = "GET", body, token = auth.tokenA) {
  return fetch(base + path, {
    method,
    headers: headers(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await delay(180);
  return page.$eval(".writer-content", (e) => ({
    count: e.querySelectorAll(".rm-page-break").length,
    height: e.offsetHeight,
    width: e.offsetWidth,
  }));
}
async function saved(page) {
  try {
    await page.waitForFunction(
      () => document.querySelector(".writer-save")?.textContent === "Saved",
      { timeout: 15000 },
    );
  } catch (e) {
    console.log(
      "SAVE STATUS",
      await page.$eval(".writer-save", (e) => e.textContent),
    );
    throw e;
  }
}
async function pageTexts(page) {
  return page.$eval(".writer-content", (root) => {
    const ed = root.editor;
    const pitch = ed.storage.PaginationPlus.pageHeight + 24;
    const top = root.getBoundingClientRect().top;
    const pages = {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement.closest("[data-rm-pagination],.rm-first-page-header"))
        continue;
      for (let i = 0; i < n.textContent.length; i++) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const p = Math.floor((r.getBoundingClientRect().top - top) / pitch) + 1;
        (pages[p] ??= []).push(n.textContent[i]);
      }
    }
    return Object.values(pages).map((t) => t.join(""));
  });
}
const norm = (s) =>
  s
    .replace(/\s/g, "")
    .replace(/[•]/g, "")
    .replace(/[123]\./g, "");
(async () => {
  const checks = [];
  const measurements = [];
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", async (r) => {
      if (
        r.url().includes("/writer/") &&
        r.status() >= 400 &&
        r.request().method() === "PATCH"
      )
        console.log("PATCH FAILED", r.status(), await r.text());
    });
    await page.goto("http://127.0.0.1:5175/dashboard", {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector(".writer-dashboard .primary-button");
    await page.click(".writer-dashboard .primary-button");
    await page.waitForSelector("dialog[open]");
    await page.$eval(".writer-create input", (e) => {
      e.focus();
      e.select();
    });
    await page.keyboard.type("Writer acceptance");
    await page.click(".writer-create .primary-button");
    await page.waitForSelector(".writer-content");
    const id = page.url().split("/").pop();
    checks.push("Dashboard create -> Writer route");
    assert.equal(
      (await api("/writer/" + id, "GET", undefined, auth.tokenB)).status,
      404,
    );
    assert.equal(
      (
        await api(
          "/writer/" + id,
          "PATCH",
          { revision: 1, title: "hijack" },
          auth.tokenB,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await api(
          "/writer/" + id + "/export",
          "POST",
          { revision: 1 },
          auth.tokenB,
        )
      ).status,
      404,
    );
    assert.equal((await fetch(base + "/writer/" + id)).status, 401);
    assert.equal(
      (await api("/writer", "POST", { ownerId: auth.ownerB })).status,
      400,
    );
    assert.equal(
      (
        await api("/writer/" + id, "PATCH", {
          revision: 1,
          pageSettings: { size: "A3" },
        })
      ).status,
      400,
    );
    const cookie = await fetch(base + "/writer/" + id, {
      headers: { Cookie: `pdfeditor_session=${auth.tokenA}` },
    });
    assert.equal(cookie.status, 200);
    checks.push(
      "Ownership read/update/export, unauthenticated rejection, forged owner, invalid settings, cookie + bearer",
    );
    await page.$eval(
      ".writer-content",
      (e, doc) => e.editor.commands.setContent(doc),
      fixture,
    );
    await settle(page);
    await saved(page);
    const persisted = await (await api("/writer/" + id)).json();
    assert.equal(
      persisted.content.content[0].content[0].text,
      "A clearer way to work",
    );
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector(".writer-content");
    assert.match(
      await page.$eval(".writer-content", (e) => e.textContent),
      /A clearer way to work/,
    );
    checks.push("Autosave + refresh persistence");
    const before = await settle(page);
    await page.$eval(".writer-content", (e) =>
      e.editor
        .chain()
        .setTextSelection(2)
        .insertContent(
          "New words move the existing content forward. ".repeat(24),
        )
        .run(),
    );
    const grown = await settle(page);
    assert.ok(grown.height > before.height);
    await page.$eval(".writer-content", (e) => e.editor.commands.undo());
    await settle(page);
    assert.equal(
      await page.$eval(".writer-content", (e) =>
        e.editor.getText().startsWith("A clearer"),
      ),
      true,
    );
    checks.push("Insert at start reflows; undo across continuous document");
    const previousBreak = await page.$eval(
      "[data-page-break]",
      (e) => e.getBoundingClientRect().top,
    );
    await page.$eval(".writer-content", (e) => {
      const editor = e.editor;
      let end = 0;
      editor.state.doc.forEach((node, offset, index) => {
        if (index < 4) end = offset + node.nodeSize;
      });
      editor.commands.deleteRange({ from: 0, to: end });
    });
    const shrunk = await settle(page);
    assert.ok(shrunk.height <= before.height);
    assert.ok(
      (await page.$eval(
        "[data-page-break]",
        (e) => e.getBoundingClientRect().top,
      )) < previousBreak,
    );
    checks.push("Deleting earlier paragraphs pulls later content backward");
    await page.$eval(
      ".writer-content",
      (e, doc) => e.editor.commands.setContent(doc),
      fixture,
    );
    await settle(page);
    await page.$eval(".writer-content", (e) => {
      const editor = e.editor;
      const top = e.getBoundingClientRect().top;
      let selected = 1;
      for (let pos = 1; pos < editor.state.doc.content.size; pos++) {
        const c = editor.view.coordsAtPos(pos);
        if (c.top - top > 990 && c.top - top < 1040) {
          selected = pos;
          break;
        }
      }
      editor.commands.setTextSelection(selected);
      editor.commands.focus();
    });
    await page.keyboard.type(
      "Writing at the bottom continues naturally onto the next page. ",
    );
    await settle(page);
    assert.match(
      await page.$eval(".writer-content", (e) => e.textContent),
      /Writing at the bottom/,
    );
    checks.push("Keyboard typing near first-page boundary");
    // Paste multiple paragraphs through the editor DOM event path.
    await page.$eval(".writer-content", (e) => {
      e.editor.commands.focus("end");
      const dt = new DataTransfer();
      dt.setData(
        "text/html",
        "<p>First pasted paragraph</p><p>Second pasted paragraph</p>",
      );
      e.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    assert.match(
      await page.$eval(".writer-content", (e) => e.textContent),
      /Second pasted paragraph/,
    );
    checks.push("Multi-paragraph paste");
    await page.$eval(".writer-content", (e) =>
      e.editor.chain().selectAll().setFontSize("18pt").run(),
    );
    const larger = await settle(page);
    assert.ok(larger.count > before.count);
    checks.push("Font-size reflow");
    await page.$eval(
      ".writer-content",
      (e, doc) => e.editor.commands.setContent(doc),
      fixture,
    );
    await settle(page);
    await page.select('select[aria-label="Page size"]', "Letter");
    await page.select('select[aria-label="Orientation"]', "landscape");
    const landscape = await settle(page);
    assert.ok(landscape.width > 1000);
    checks.push("A4 -> Letter and portrait -> landscape reflow");
    await page.select('select[aria-label="Page size"]', "A4");
    await page.select('select[aria-label="Orientation"]', "portrait");
    await settle(page);
    // Failed autosave retains editable content, then retries after the service recovers.
    await saved(page);
    await page.setRequestInterception(true);
    let failSave = true;
    const handler = (r) => {
      if (failSave && r.method() === "PATCH" && r.url().includes("/writer/"))
        return r.respond({
          status: 503,
          contentType: "application/json",
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:5175",
            "access-control-allow-credentials": "true",
          },
          body: '{"message":"Temporary failure"}',
        });
      return r.continue();
    };
    page.on("request", handler);
    await page.$eval(".writer-content", (e) =>
      e.editor.chain().focus("end").insertContent(" Recovery proof.").run(),
    );
    await page.waitForFunction(() =>
      document
        .querySelector(".writer-save")
        .textContent.includes("Unable to save"),
    );
    assert.match(
      await page.$eval(".writer-content", (e) => e.textContent),
      /Recovery proof/,
    );
    failSave = false;
    await saved(page);
    page.off("request", handler);
    await page.setRequestInterception(false);
    checks.push("Save failure retains content and retry persists");
    // Export before debounce fires must save the last edit first.
    await page.$eval(".writer-content", (e) =>
      e.editor
        .chain()
        .focus("end")
        .insertContent(" LATEST-EXPORT-MARKER")
        .run(),
    );
    await page.evaluate(() => {
      const original = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        window.writerDownload = blob;
        return original(blob);
      };
    });
    const exported = page.waitForResponse(
      (r) => r.url().endsWith("/export") && r.request().method() === "POST",
    );
    await page.click(".writer-topbar .primary-button");
    const exportResponse = await exported;
    assert.equal(exportResponse.status(), 201);
    await page.waitForFunction(() => window.writerDownload?.size > 0);
    const download = await page.evaluate(async () =>
      Array.from(new Uint8Array(await window.writerDownload.arrayBuffer())),
    );
    fs.writeFileSync("/tmp/writer-latest.pdf", Buffer.from(download));
    assert.match(
      execFileSync("pdftotext", ["/tmp/writer-latest.pdf", "-"], {
        encoding: "utf8",
      }),
      /LATEST-EXPORT-MARKER/,
    );
    await page.waitForFunction(
      () => !document.querySelector(".writer-topbar .primary-button").disabled,
    );
    checks.push("Export flushes latest content before debounce");
    // Pure paragraph specimens are calibrated to exactly 1, 3 and 10 pages.
    for (const target of [1, 3, 10]) {
      let count = target === 1 ? 4 : target === 3 ? 20 : 70;
      let layout;
      for (let tries = 0; tries < 15; tries++) {
        await page.$eval(
          ".writer-content",
          (e, n) =>
            e.editor.commands.setContent({
              type: "doc",
              content: Array.from({ length: n }, () => ({
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "The Papertrail team is preparing a practical guide for small businesses that manage important documents every day. Clear writing makes responsibilities easier to understand, reduces unnecessary follow-up, and gives each reader a reliable record of the next step. We review the draft together, check the details carefully, and keep the final document simple enough to use in a busy working day. ",
                  },
                ],
              })),
            }),
          count,
        );
        layout = await settle(page);
        if (layout.count === target) break;
        count += layout.count < target ? 1 : -1;
      }
      assert.equal(layout.count, target);
      const times = await page.$eval(".writer-content", async (e) => {
        const editor = e.editor;
        editor.commands.focus("end");
        const result = [];
        for (let i = 0; i < 30; i++) {
          const start = performance.now();
          editor.commands.insertContent("x");
          const sync = performance.now() - start;
          await new Promise(requestAnimationFrame);
          result.push({ sync, frame: performance.now() - start });
        }
        return result;
      });
      await settle(page);
      await saved(page);
      const current = await (await api("/writer/" + id)).json();
      const pdf = await api("/writer/" + id + "/export", "POST", {
        revision: current.revision,
      });
      assert.equal(pdf.status, 201);
      const file = `/tmp/writer-${target}-pages.pdf`;
      fs.writeFileSync(file, Buffer.from(await pdf.arrayBuffer()));
      const pdfPages = execFileSync("pdftotext", ["-layout", file, "-"], {
        encoding: "utf8",
      })
        .split("\f")
        .filter((p) => p.trim());
      const preview = await pageTexts(page);
      const sorted = times.map((x) => x.sync).sort((a, b) => a - b);
      measurements.push({
        target,
        paragraphs: count,
        previewPages: (await settle(page)).count,
        pdfPages: pdfPages.length,
        pageTextMatches: preview.map(
          (p, i) => norm(p) === norm(pdfPages[i] || ""),
        ),
        syncMedianMs: sorted[15],
        syncP95Ms: sorted[28],
        frameP95Ms: times.map((x) => x.frame).sort((a, b) => a - b)[28],
      });
      console.log("MEASURE", measurements.at(-1));
    }
    // Keep a reproducible mixed-feature specimen for inspection.
    await page.$eval(
      ".writer-content",
      (e, doc) => e.editor.commands.setContent(doc),
      fixture,
    );
    await settle(page);
    await saved(page);
    for (const width of [375, 768, 1440]) {
      await page.setViewport({ width, height: 1000 });
      await settle(page);
      await page.$eval(".writer-workspace", (e) => { e.scrollTop = 0; });
      await page.screenshot({ path: `/tmp/writer-${width}.png` });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}`,
      );
    }
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "/tmp/writer-dark.png" });
    checks.push("Mobile/tablet/desktop outer layout and dark mode");
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      "/tmp/writer-acceptance.json",
      JSON.stringify({ checks, measurements }, null, 2),
    );
    console.log("PASS", checks);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
