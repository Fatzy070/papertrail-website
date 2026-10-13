const fs = require("node:fs");
const puppeteer = require("puppeteer");
const { fixture } = require("./fixture.cjs");
const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${auth.tokenA}`,
};
(async () => {
  const created = await fetch(`${base}/writer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Writer parity specimen" }),
  }).then((r) => r.json());
  const doc = await fetch(`${base}/writer/${created.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ revision: 1, content: fixture }),
  }).then((r) => r.json());
  console.log("DOCUMENT", doc.id, doc.revision);
  fs.writeFileSync("/tmp/writer-doc-id", doc.id);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("BROWSER ERROR", e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluateOnNewDocument(
      (token) => localStorage.setItem("auth_token", token),
      auth.tokenA,
    );
    await page.goto(`http://127.0.0.1:5175/writer/${doc.id}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector(".writer-content");
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1500));
    console.log(
      "LAYOUT",
      await page.$eval(".writer-content", (e) => ({
        height: e.offsetHeight,
        width: e.offsetWidth,
        pages: e.querySelectorAll(".rm-page-break").length,
        text: e.textContent.length,
        breaks: [...e.querySelectorAll("[data-page-break]")].map((b) => ({
          top: b.offsetTop,
          height: b.offsetHeight,
        })),
        rect: e.getBoundingClientRect().toJSON(),
      })),
    );
    await page.screenshot({ path: "/tmp/writer-preview.png", fullPage: true });
    await page.$eval(".writer-workspace", (e) => (e.scrollTop = 1050));
    await page.screenshot({ path: "/tmp/writer-preview-page2.png" });
    const result = await fetch(`${base}/writer/${doc.id}/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({ revision: doc.revision }),
    });
    console.log("EXPORT", result.status);
    if (result.ok)
      fs.writeFileSync(
        "/tmp/writer-specimen.pdf",
        Buffer.from(await result.arrayBuffer()),
      );
    else console.log(await result.text());
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
