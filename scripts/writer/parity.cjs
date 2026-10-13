const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");
const { fixture } = require("./fixture.cjs");
const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
(async () => {
  const id = fs.readFileSync("/tmp/writer-doc-id", "utf8");
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
    await page.goto(`http://127.0.0.1:5175/writer/${id}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector(".writer-content");
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 700));
    const layout = await page.$eval(".writer-content", (root) => {
      const top = root.getBoundingClientRect().top;
      const pages = {};
      const lines = {};
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (
          node.parentElement.closest(
            "[data-rm-pagination],.rm-first-page-header",
          )
        )
          continue;
        for (let i = 0; i < node.textContent.length; i++) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect();
          const page =
            Math.floor((rect.top - top) / ((297 * 96) / 25.4 + 24)) + 1;
          (pages[page] ??= []).push(node.textContent[i]);
          lines[page] ??= {
            top: rect.top - top,
            left: rect.left - root.getBoundingClientRect().left,
          };
        }
      }
      return {
        count: root.querySelectorAll(".rm-page-break").length,
        height: root.offsetHeight,
        pages: Object.fromEntries(
          Object.entries(pages).map(([p, t]) => [p, t.join("")]),
        ),
        lines,
        header: getComputedStyle(root.querySelector(".rm-first-page-header"))
          .display,
      };
    });
    fs.writeFileSync(
      "/tmp/writer-parity.json",
      JSON.stringify(layout, null, 2),
    );
    const pdf = execFileSync(
      "pdftotext",
      ["-layout", "/tmp/writer-specimen.pdf", "-"],
      { encoding: "utf8" },
    )
      .split("\f")
      .filter((s) => s.trim());
    const norm = (s) =>
      s
        .replace(/\s/g, "")
        .replace(/[•]/g, "")
        .replace(/[123]\./g, "");
    console.log(
      "PREVIEW",
      layout.count,
      layout.height,
      layout.header,
      layout.lines,
    );
    console.log("PDF", pdf.length);
    for (let i = 0; i < pdf.length; i++) {
      console.log(
        "PAGE",
        i + 1,
        "match",
        norm(layout.pages[i + 1] || "") === norm(pdf[i]),
        "preview chars",
        norm(layout.pages[i + 1] || "").length,
        "pdf chars",
        norm(pdf[i]).length,
        "preview starts",
        (layout.pages[i + 1] || "").slice(0, 85),
        "pdf starts",
        pdf[i].trim().slice(0, 85),
      );
    }
    await page.screenshot({ path: "/tmp/writer-preview-fixed.png" });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
