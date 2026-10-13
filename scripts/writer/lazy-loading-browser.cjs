const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const origin = "http://127.0.0.1:5175";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FORBIDDEN_ON_NON_PDF_ROUTES =
  /EditorPage|MergePdfPage|SplitPdfPage|CompressPdfPage|ConvertPdfPage|pdf-loader|pdf-exporter|mupdf|pdf\.worker|pdfjs-dist|pdf-lib|fontkit/i;

async function createSamplePdfBytes(label = "Sample") {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`${label} PDF Page ${i}`, {
      x: 72,
      y: 740,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  return Buffer.from(await doc.save());
}

// 1x1 transparent PNG
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

(async () => {
  const samplePdfA = await createSamplePdfBytes("Hello Papertrail Editor");
  const samplePdfB = await createSamplePdfBytes("Second Merge Input");
  const tmpPdfA = "/tmp/papertrail-sample-a.pdf";
  const tmpPdfB = "/tmp/papertrail-sample-b.pdf";
  const tmpPng = "/tmp/papertrail-sample.png";
  fs.writeFileSync(tmpPdfA, samplePdfA);
  fs.writeFileSync(tmpPdfB, samplePdfB);
  fs.writeFileSync(tmpPng, ONE_PIXEL_PNG);

  // Create a Writer doc via API so we can also test /writer/:id route isolation
  const writerRes = await fetch(`${base}/writer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "Lazy Route Isolation Doc" }),
  });
  assert.ok(writerRes.ok, `POST /writer failed: ${writerRes.status}`);
  const writerDoc = await writerRes.json();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];
  const metrics = {};

  const attachPdfMocks = async (page) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    };
    const mockMeta = {
      id: "pdf-doc-1",
      name: "LazyLoadedSample.pdf",
      mimeType: "application/pdf",
      size: samplePdfA.byteLength,
      pageCount: 2,
      currentVersionNumber: 1,
      isStarred: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/documents")) {
        if (req.method() === "OPTIONS") {
          req.respond({ status: 204, headers: corsHeaders });
          return;
        }
        if (url.pathname === "/api/documents" && req.method() === "GET") {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify([mockMeta]),
          });
          return;
        }
        if (url.pathname === "/api/documents/pdf-doc-1" && req.method() === "GET") {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: "application/json",
            body: JSON.stringify(mockMeta),
          });
          return;
        }
        if (
          url.pathname === "/api/documents/pdf-doc-1/content" &&
          req.method() === "GET"
        ) {
          req.respond({
            status: 200,
            headers: corsHeaders,
            contentType: "application/pdf",
            body: samplePdfA,
          });
          return;
        }
      }
      if (url.pathname === "/api/billing/status") {
        req.respond({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            hasActiveSubscription: false,
            canExport: true,
          }),
        });
        return;
      }
      req.continue();
    });
  };

  try {
    // 1. Verify non-PDF routes NEVER request PDF Editor, PDF Tools, PDF.js, Worker, MuPDF, or pdf-lib
    const nonPdfRoutes = [
      { path: "/", authenticated: false },
      { path: "/login", authenticated: false },
      { path: "/register", authenticated: false },
      { path: "/dashboard", authenticated: true },
      { path: "/documents", authenticated: true },
      { path: `/writer/${writerDoc.id}`, authenticated: true },
      { path: "/settings", authenticated: true },
      { path: "/support", authenticated: true },
      { path: "/tools", authenticated: true },
    ];

    for (const route of nonPdfRoutes) {
      const p = await browser.newPage();
      if (route.authenticated) {
        await p.evaluateOnNewDocument(
          (t) => localStorage.setItem("auth_token", t),
          auth.tokenA,
        );
      }
      const requestedUrls = [];
      p.on("request", (r) => requestedUrls.push(r.url()));
      await p.goto(`${origin}${route.path}`, { waitUntil: "networkidle0" });
      if (route.path.startsWith("/writer/")) {
        await p.waitForSelector(".writer-content");
      }
      const forbidden = requestedUrls.filter((u) =>
        FORBIDDEN_ON_NON_PDF_ROUTES.test(u),
      );
      assert.deepEqual(
        forbidden,
        [],
        `Route ${route.path} unexpectedly loaded PDF modules: ${JSON.stringify(forbidden)}`,
      );
      await p.close();
    }
    checks.push(
      "non-pdf-routes-zero-pdf-engine-or-tool-requests (/, /login, /register, /dashboard, /documents, /writer/:id, /settings, /support, /tools)",
    );

    // 2. Direct URL navigation to /documents/:id/edit (Sections 12, 16, 19, 20)
    const editorTab = await browser.newPage();
    await editorTab.setViewport({ width: 1440, height: 900 });
    await editorTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    await attachPdfMocks(editorTab);
    const editorRequests = [];
    editorTab.on("request", (r) => editorRequests.push(r.url()));

    const t0 = Date.now();
    await editorTab.goto(`${origin}/documents/pdf-doc-1/edit`, {
      waitUntil: "domcontentloaded",
    });
    await editorTab.waitForSelector(".editor-shell");
    await editorTab.waitForSelector("#pdf-page-0 canvas");
    await editorTab.waitForSelector("#pdf-page-1 canvas");
    await editorTab.waitForFunction(() =>
      document.body.textContent?.includes("Hello Papertrail Editor PDF Page 1"),
    );
    metrics.editorFirstOpenMs = Date.now() - t0;

    // Confirm PDF chunks loaded on demand when entering /documents/:id/edit
    assert.ok(
      editorRequests.some((u) => /EditorPage/i.test(u)),
      "EditorPage chunk should load on /documents/:id/edit",
    );
    assert.ok(
      editorRequests.some((u) => /pdf\.worker/i.test(u)),
      "PDF.js worker should load when PDF is opened in EditorPage",
    );
    assert.ok(
      editorRequests.some((u) => /mupdf/i.test(u)),
      "MuPDF should load on demand when enriching PDF text in EditorPage",
    );

    // Test mobile viewports on EditorPage & Dashboard (Section 21)
    for (const width of [375, 390, 430, 1440]) {
      await editorTab.setViewport({ width, height: 844 });
      await wait(80);
      const hasShell = await editorTab.$(".editor-shell");
      assert.ok(hasShell, `Editor shell present at ${width}px`);
    }
    await editorTab.close();
    checks.push(`direct-editor-url-navigation-and-render (${metrics.editorFirstOpenMs}ms)`);

    // 3. Test PDF Tools lazy loading & functionality (Section 20)
    // 3a. Merge PDF (/tools/merge)
    const mergeTab = await browser.newPage();
    await mergeTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    const mergeReqs = [];
    mergeTab.on("request", (r) => mergeReqs.push(r.url()));
    await mergeTab.goto(`${origin}/tools/merge`, { waitUntil: "networkidle0" });
    await mergeTab.waitForSelector("h1");
    assert.equal(await mergeTab.$eval("h1", (el) => el.textContent), "Merge PDF");
    assert.equal(
      mergeReqs.some((u) => /mupdf|pdf\.worker|pdfjs-dist/i.test(u)),
      false,
      "/tools/merge must not load PDF.js worker or MuPDF",
    );
    const mergeInput = await mergeTab.$('input[type="file"]');
    await mergeInput.uploadFile(tmpPdfA, tmpPdfB);
    await mergeTab.waitForFunction(() =>
      document.body.textContent?.includes("Files to merge"),
    );
    await mergeTab.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.includes("Merge PDFs")).click();
    });
    await mergeTab.waitForFunction(() =>
      document.body.textContent?.includes("Merge Complete!"),
    );
    await mergeTab.close();
    checks.push("lazy-tool-merge-pdf-functional-and-isolated");

    // 3b. Split / Extract PDF (/tools/split)
    const splitTab = await browser.newPage();
    await splitTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    await splitTab.goto(`${origin}/tools/split`, { waitUntil: "networkidle0" });
    await splitTab.waitForSelector("h1");
    const splitInput = await splitTab.$('input[type="file"]');
    await splitInput.uploadFile(tmpPdfA);
    await splitTab.waitForSelector("#range-input");
    await splitTab.type("#range-input", "1-1");
    await splitTab.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.includes("Extract Pages")).click();
    });
    await splitTab.waitForFunction(() =>
      document.body.textContent?.includes("Extraction Complete!"),
    );
    await splitTab.close();
    checks.push("lazy-tool-split-pdf-functional");

    // 3c. Compress PDF (/tools/compress)
    const compressTab = await browser.newPage();
    await compressTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    await compressTab.goto(`${origin}/tools/compress`, { waitUntil: "networkidle0" });
    await compressTab.waitForSelector("h1");
    const compressInput = await compressTab.$('input[type="file"]');
    await compressInput.uploadFile(tmpPdfA);
    await compressTab.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent.includes("Compress PDF"),
      ),
    );
    await compressTab.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Compress PDF").click();
    });
    await compressTab.waitForFunction(() =>
      /Compression Successful!|Already Optimized|Already Well Optimized/.test(
        document.body.textContent || "",
      ),
    );
    await compressTab.close();
    checks.push("lazy-tool-compress-pdf-functional");

    // 3d. Convert PDF (/tools/convert): Images -> PDF (without spawning PDF.js worker) + PDF -> Images (spawns PDF.js worker on demand)
    const convertTab = await browser.newPage();
    await convertTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    const convertReqs = [];
    convertTab.on("request", (r) => convertReqs.push(r.url()));
    await convertTab.goto(`${origin}/tools/convert`, { waitUntil: "networkidle0" });
    await convertTab.waitForSelector(".conversion-choices");
    assert.equal(
      convertReqs.some((u) => /pdf\.worker.*worker_file|pdf\.worker\.min/i.test(u)),
      false,
      "PDF.js worker must not spawn merely from opening /tools/convert",
    );

    // Test Images -> PDF first
    await convertTab.evaluate(() => {
      const btns = [...document.querySelectorAll(".conversion-choice")];
      btns.find((b) => b.textContent.includes("Images to PDF")).click();
    });
    const imgInput = await convertTab.$('input[type="file"]');
    await imgInput.uploadFile(tmpPng);
    await convertTab.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent.includes("Create PDF"),
      ),
    );
    await convertTab.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Create PDF").click();
    });
    await convertTab.waitForFunction(() =>
      document.body.textContent?.includes("Conversion Complete!"),
    );
    assert.equal(
      convertReqs.some((u) => /pdf\.worker.*worker_file|pdf\.worker\.min/i.test(u)),
      false,
      "Images -> PDF conversion must not spawn PDF.js worker",
    );

    // Now switch to PDF -> Images and verify PDF.js worker spawns on Extract Images
    await convertTab.evaluate(() => {
      const btns = [...document.querySelectorAll(".conversion-choice")];
      btns.find((b) => b.textContent.includes("PDF to Images")).click();
    });
    const pdfInput = await convertTab.$('input[type="file"]');
    await pdfInput.uploadFile(tmpPdfA);
    await convertTab.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent.includes("Extract Images"),
      ),
    );
    await convertTab.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      btns.find((b) => b.textContent.trim() === "Extract Images").click();
    });
    await convertTab.waitForFunction(() =>
      document.body.textContent?.includes("Extracted Images"),
    );
    assert.equal(
      convertReqs.some((u) => /pdf\.worker/i.test(u)),
      true,
      "PDF -> Images extraction spawns PDF.js worker on demand",
    );
    await convertTab.close();
    checks.push("lazy-tool-convert-images-to-pdf-and-pdf-to-images-worker-deferred");

    // 4. Chunk-load failure handling (Section 13)
    const errTab = await browser.newPage();
    await errTab.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      auth.tokenA,
    );
    await errTab.setRequestInterception(true);
    errTab.on("request", (req) => {
      if (req.url().includes("CompressPdfPage")) {
        req.abort("failed");
      } else {
        req.continue();
      }
    });
    await errTab.goto(`${origin}/tools/compress`, { waitUntil: "networkidle0" });
    await errTab.waitForSelector('[role="alert"]');
    const alertText = await errTab.$eval('[role="alert"]', (el) => el.textContent);
    assert.ok(
      alertText.includes("Unable to load this page"),
      `Expected chunk error boundary message, got: ${alertText}`,
    );
    await errTab.close();
    checks.push("chunk-load-failure-graceful-error-boundary");

    // 5. Mobile Safari ReadableStream[Symbol.asyncIterator] compatibility check (Section 7 & 24E)
    const safariTab = await browser.newPage();
    for (const width of [375, 390, 430]) {
      await safariTab.setViewport({ width, height: 844 });
      await safariTab.goto(`${origin}/`, { waitUntil: "networkidle0" });
      const overflow = await safariTab.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `No horizontal overflow on / at ${width}px`);
    }
    const polyfillWorks = await safariTab.evaluate(async () => {
      const orig = ReadableStream.prototype[Symbol.asyncIterator];
      delete ReadableStream.prototype[Symbol.asyncIterator];
      const { applyPolyfills } = await import("/src/polyfills.ts");
      applyPolyfills();
      const restored = typeof ReadableStream.prototype[Symbol.asyncIterator] === "function";
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(...chunk);
      }
      ReadableStream.prototype[Symbol.asyncIterator] = orig;
      return restored && chunks.join(",") === "1,2,3";
    });
    assert.equal(polyfillWorks, true, "Mobile Safari ReadableStream asyncIterator polyfill must remain intact");
    await safariTab.close();
    checks.push("mobile-viewports-375-390-430-and-safari-readablestream-polyfill");

    console.log(JSON.stringify({ ok: true, metrics, checks }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
