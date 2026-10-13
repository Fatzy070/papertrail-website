const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");
const { fixture } = require("./fixture.cjs");
const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${auth.tokenA}`,
};
const norm = (s) =>
  s
    .replace(/\s/g, "")
    .replace(/[•]/g, "")
    .replace(/[123]\./g, "");
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    const cases = [
      { size: "A4", orientation: "portrait" },
      { size: "Letter", orientation: "portrait" },
      { size: "A4", orientation: "landscape" },
      { size: "Letter", orientation: "landscape", serif: true },
    ];
    for (const c of cases) {
      const pageSettings = {
        size: c.size,
        orientation: c.orientation,
        margins: c.serif
          ? { top: 15, right: 25, bottom: 18, left: 22 }
          : { top: 20, right: 20, bottom: 20, left: 20 },
      };
      const content = structuredClone(fixture);
      if (c.serif) {
        const visit = (n) => {
          if (n.type === "text")
            n.marks = [
              ...(n.marks || []),
              {
                type: "textStyle",
                attrs: { fontFamily: "Writer Serif", fontSize: "14pt" },
              },
            ];
          n.content?.forEach(visit);
        };
        visit(content);
      }
      const created = await fetch(base + "/writer", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Format parity", pageSettings }),
      }).then((r) => r.json());
      const doc = await fetch(base + "/writer/" + created.id, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ revision: 1, content }),
      }).then((r) => r.json());
      await page.goto("http://127.0.0.1:5175/writer/" + doc.id, {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(".writer-content");
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 500));
      const preview = await page.$eval(".writer-content", (root) => {
        const pitch = root.editor.storage.PaginationPlus.pageHeight + 24;
        const top = root.getBoundingClientRect().top;
        const pages = {};
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (
            n.parentElement.closest(
              "[data-rm-pagination],.rm-first-page-header",
            )
          )
            continue;
          for (let i = 0; i < n.textContent.length; i++) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const p =
              Math.floor((r.getBoundingClientRect().top - top) / pitch) + 1;
            (pages[p] ??= []).push(n.textContent[i]);
          }
        }
        return {
          count: root.querySelectorAll(".rm-page-break").length,
          text: Object.values(pages).map((t) => t.join("")),
        };
      });
      const response = await fetch(`${base}/writer/${doc.id}/export`, {
        method: "POST",
        headers,
        body: JSON.stringify({ revision: doc.revision }),
      });
      assert.equal(response.status, 201);
      const name = `/tmp/writer-${c.size}-${c.orientation}${c.serif ? "-serif" : ""}`;
      fs.writeFileSync(
        name + ".pdf",
        Buffer.from(await response.arrayBuffer()),
      );
      const pdf = execFileSync("pdftotext", ["-layout", name + ".pdf", "-"], {
        encoding: "utf8",
      })
        .split("\f")
        .filter((t) => t.trim());
      const info = execFileSync("pdfinfo", [name + ".pdf"], {
        encoding: "utf8",
      }).match(/Page size:\s*(.*)/)[1];
      let a = 0,
        b = 0;
      const boundaryCharacterOffsets = preview.text.map((t, i) => {
        a += norm(t).length;
        b += norm(pdf[i] || "").length;
        return a - b;
      });
      const result = {
        overallTextMatches: norm(preview.text.join("")) === norm(pdf.join("")),
        boundaryCharacterOffsets,
        ...c,
        pageSettings,
        previewPages: preview.count,
        pdfPages: pdf.length,
        pageSize: info,
        pageTextMatches: preview.text.map(
          (t, i) => norm(t) === norm(pdf[i] || ""),
        ),
      };
      results.push(result);
      console.log(result);
      await page.screenshot({ path: name + ".png" });
    }
    fs.writeFileSync(
      "/tmp/writer-formats.json",
      JSON.stringify(results, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
