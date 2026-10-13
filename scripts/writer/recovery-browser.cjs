const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const { paragraph, fixture } = require("./fixture.cjs");
const auth = JSON.parse(fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"));
const base = "http://127.0.0.1:3007/api";
const origin = "http://127.0.0.1:5175";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Shared parity fixture plus the remaining Writer formatting recovery must preserve.
const mixedFixture = {
  ...fixture,
  content: [
    { ...fixture.content[0], attrs: { level: 1, textAlign: "center" } },
    ...fixture.content.slice(1),
    {
      type: "paragraph",
      attrs: { textAlign: "right" },
      content: [
        {
          type: "text",
          text: "Serif eighteen ",
          marks: [{ type: "textStyle", attrs: { fontFamily: "Writer Serif", fontSize: "18pt" } }],
        },
        {
          type: "text",
          text: "Titled link",
          marks: [
            { type: "bold" },
            { type: "link", attrs: { href: "https://example.com/titled", title: "Example" } },
          ],
        },
      ],
    },
  ],
};
async function api(path, method = "GET", body, token = auth.tokenA) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
}
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];
  let page;
  const newPage = async (token) => {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument(
      (t) => localStorage.setItem("auth_token", t),
      token,
    );
    p.on("pageerror", (error) => {
      console.error("PAGE ERROR", error);
    });
    return p;
  };
  const open = async (p, id) => {
    await p.goto(`${origin}/writer/${id}`, { waitUntil: "domcontentloaded" });
  };
  const ready = (p) => p.waitForSelector(".writer-content");
  const saved = (p) =>
    p.waitForFunction(
      () => document.querySelector(".writer-save")?.textContent === "Saved",
    );
  const records = (p, id, account = auth.ownerA) =>
    p.evaluate(
      async (a, d) =>
        (await import("/src/writer/recovery-store.ts")).recoveryStore.list(
          a,
          d,
        ),
      account,
      id,
    );
  const waitRecord = async (p, id) => {
    for (let i = 0; i < 40; i++) {
      const rows = await records(p, id);
      if (rows.length) return rows;
      await wait(100);
    }
    throw new Error("Local draft was not written");
  };
  const waitClear = async (p, id) => {
    for (let i = 0; i < 40; i++) {
      if (!(await records(p, id)).length) return;
      await wait(100);
    }
    throw new Error("Local draft was not cleared");
  };
  const edit = (p, text) =>
    p.$eval(
      ".writer-content",
      (el, value) => el.editor.chain().focus("end").insertContent(value).run(),
      text,
    );
  const click = async (p, label) => {
    for (const b of await p.$$("button"))
      if ((await b.evaluate((el) => el.textContent.trim())) === label) {
        await b.click();
        return;
      }
    throw new Error(`Missing ${label}`);
  };
  const block = async (p, status = 503) => {
    await p.setRequestInterception(true);
    p.on("request", (r) =>
      r.method() === "PATCH" && r.url().includes("/api/writer/")
        ? r.respond({
            status,
            contentType: "application/json",
            body: '{"message":"Simulated offline"}',
          })
        : r.continue(),
    );
  };
  try {
    let doc = await api("/writer", "POST", { title: "Recovery acceptance" });
    page = await newPage(auth.tokenA);
    await open(page, doc.id);
    await ready(page);
    await edit(page, "Normal save.");
    await waitRecord(page, doc.id);
    await saved(page);
    await waitClear(page, doc.id);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    assert.equal(await page.$("dialog"), null);
    checks.push("normal autosave clears exact draft; reload has no dialog");
    await block(page);
    await edit(page, " Unsaved after network failure.");
    await page.$eval(
      ".writer-content",
      (el, content) => el.editor.commands.setContent(content),
      mixedFixture,
    );
    // Recover title and all page settings together with the JSON.
    await page.$eval(".writer-title input", (input) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, "Recovered title");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.select('select[aria-label="Page size"]', "Letter");
    await page.select('select[aria-label="Orientation"]', "landscape");
    const local = (await waitRecord(page, doc.id))[0];
    await wait(1400);
    assert.match(
      await page.$eval(".writer-save", (el) => el.textContent),
      /Unable to save/,
    );
    const latestLocal = (await records(page, doc.id))[0];
    // Stored draft carries the editor's real serialization (link title, textStyle, alignment).
    const storedJson = JSON.stringify(latestLocal.content);
    for (const fragment of [
      '"title":"Example"',
      '"title":null',
      '"fontFamily":"Writer Serif"',
      '"fontSize":"18pt"',
      '"textAlign":"right"',
      '"textAlign":"center"',
      '"type":"pageBreak"',
      '"type":"orderedList"',
      '"type":"bulletList"',
    ])
      assert.ok(storedJson.includes(fragment), `stored draft missing ${fragment}`);
    await page.close();
    page = await newPage(auth.tokenA);
    await open(page, doc.id);
    await page.waitForSelector("dialog[open]");
    assert.match(
      await page.$eval("dialog", (el) => el.textContent),
      /Unsaved changes found/,
    );
    await click(page, "Recover changes");
    await ready(page);
    assert.deepEqual(
      await page.$eval(".writer-content", (el) => el.editor.getJSON()),
      latestLocal.content,
    );
    await saved(page);
    await waitClear(page, doc.id);
    const recovered = await api(`/writer/${doc.id}`);
    assert.deepEqual(recovered.content, latestLocal.content);
    assert.equal(recovered.title, "Recovered title");
    assert.deepEqual(recovered.pageSettings, latestLocal.pageSettings);
    assert.deepEqual(
      [recovered.pageSettings.size, recovered.pageSettings.orientation],
      ["Letter", "landscape"],
    );
    checks.push(
      "network failure/crash recovery restores exact mixed-format JSON (incl. link title), title and page settings",
    );
    // Newer remote revision: no PATCH is sent until user deliberately recovers.
    await block(page);
    await edit(page, " Local conflicting change.");
    await waitRecord(page, doc.id);
    await page.close();
    const remote = await api(`/writer/${doc.id}`, "PATCH", {
      revision: recovered.revision,
      title: "Newer server title",
    });
    page = await newPage(auth.tokenA);
    let patches = 0;
    page.on("request", (r) => {
      if (r.method() === "PATCH") patches++;
    });
    await open(page, doc.id);
    await page.waitForSelector("dialog[open]");
    await wait(1200);
    assert.match(
      await page.$eval("dialog", (el) => el.textContent),
      /Saved version has changed/,
    );
    assert.equal(patches, 0);
    const mobile = [];
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        theme === "dark",
      );
      for (const width of [320, 375, 390, 430]) {
        await page.setViewport({ width, height: 700 });
        await wait(250);
        const m = await page.evaluate(() => {
          const dialog = document.querySelector("dialog[open]");
          const r = dialog.getBoundingClientRect();
          const buttons = [...dialog.querySelectorAll("button")].map((b) => {
            const br = b.getBoundingClientRect();
            return {
              text: b.textContent.trim() || b.getAttribute("aria-label"),
              inside: br.left >= 0 && br.right <= innerWidth && br.width > 0 && br.height >= 24,
              clipped: b.scrollWidth > b.clientWidth + 1,
            };
          });
          const times = [...dialog.querySelectorAll("time")].map((t) => {
            const tr = t.getBoundingClientRect();
            return tr.right <= r.right + 0.5 && parseFloat(getComputedStyle(t).fontSize) >= 12;
          });
          const style = getComputedStyle(dialog);
          return {
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            dialogOverflowX: dialog.scrollWidth > dialog.clientWidth + 1,
            fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && (r.bottom <= innerHeight || style.overflowY !== "visible"),
            buttons,
            timesReadable: times.every(Boolean),
            contrast: [style.color, style.backgroundColor],
          };
        });
        mobile.push({ theme, width, ...m });
        assert.equal(m.pageOverflow, false, `${theme} ${width}: page overflow`);
        assert.equal(m.dialogOverflowX, false, `${theme} ${width}: dialog overflow`);
        assert.ok(m.fits, `${theme} ${width}: dialog outside viewport`);
        assert.ok(m.timesReadable, `${theme} ${width}: timestamps`);
        for (const b of m.buttons) {
          assert.ok(b.inside, `${theme} ${width}: ${b.text} unreachable`);
          assert.ok(!b.clipped, `${theme} ${width}: ${b.text} clipped`);
        }
        assert.notEqual(m.contrast[0], m.contrast[1]);
        await page.screenshot({ path: `/tmp/writer-recovery-${theme}-${width}.png` });
      }
    }
    fs.writeFileSync("/tmp/writer-recovery-mobile.json", JSON.stringify(mobile, null, 2));
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    checks.push("recovery dialog fits 320/375/390/430 px in light and dark with reachable actions");
    await click(page, "Recover local changes");
    await ready(page);
    await saved(page);
    await waitClear(page, doc.id);
    assert.equal(
      (await api(`/writer/${doc.id}`)).revision,
      remote.revision + 1,
    );
    checks.push(
      "newer server warning; no implicit overwrite; explicit recovery uses current revision",
    );
    // Account switch: local storage persists, only authenticated-account drafts are queried.
    await block(page);
    await edit(page, " Private account A text.");
    await waitRecord(page, doc.id);
    await page.close();
    const b = await api(
      "/writer",
      "POST",
      { title: "Account B document" },
      auth.tokenB,
    );
    page = await newPage(auth.tokenB);
    await open(page, b.id);
    await ready(page);
    assert.deepEqual(await records(page, doc.id, auth.ownerB), []);
    assert.equal(await page.$("dialog"), null);
    assert.ok(
      !(await page.$eval("body", (el) => el.textContent)).includes(
        "Private account A",
      ),
    );
    await open(page, doc.id);
    await page.waitForFunction(() =>
      document.body.textContent.includes("Writer document not found"),
    );
    assert.equal(await page.$("dialog"), null);
    await page.close();
    page = await newPage(auth.tokenA);
    await open(page, doc.id);
    await page.waitForSelector("dialog[open]");
    await click(page, "Use saved version");
    await ready(page);
    await waitClear(page, doc.id);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    assert.equal(await page.$("dialog"), null);
    checks.push(
      "A → B → A isolation and use-saved discard without repeated prompt",
    );
    // Native IndexedDB CRUD, compare/delete, expiration, bounds and malformed data.
    await page.evaluate(
      async (seed, account, id) => {
        const { recoveryStore, RETENTION_MS } =
          await import("/src/writer/recovery-store.ts");
        const draft = {
          ...seed,
          accountId: account,
          documentId: id,
          sessionId: "test",
          token: "old",
          savedLocallyAt: Date.now(),
        };
        await recoveryStore.put(draft);
        await recoveryStore.put({ ...draft, token: "new" });
        await recoveryStore.remove(draft);
        if ((await recoveryStore.list(account, id))[0]?.token !== "new")
          throw Error("CAS deletion lost new record");
        await recoveryStore.put({
          ...draft,
          sessionId: "expired",
          savedLocallyAt: Date.now() - RETENTION_MS - 1,
        });
        if (
          (await recoveryStore.list(account, id)).some(
            (row) => row.sessionId === "expired",
          )
        )
          throw Error("Retention failed");
        for (let i = 0; i < 102; i++)
          await recoveryStore.put({
            ...draft,
            documentId: "bounded",
            sessionId: String(i),
          });
        if ((await recoveryStore.list(account, "bounded")).length > 100)
          throw Error("Storage bound failed");
        // Browser-wide cap evicts the globally oldest records, across accounts. These
        // records are the newest in the store (within cleanup's +60 s clock-skew window).
        const other = "100000000000000000000002";
        const now = Date.now();
        for (let i = 0; i < 102; i++)
          await recoveryStore.put({
            ...draft,
            accountId: i % 2 ? other : account,
            documentId: "cap-order",
            sessionId: `cap-${i}`,
            token: `cap-${i}`,
            savedLocallyAt: now + 10_000 + i * 100,
          });
        const mine = await recoveryStore.list(account, "cap-order");
        const theirs = await recoveryStore.list(other, "cap-order");
        if (mine.some((row) => row.accountId !== account)) throw Error("Cross-account read");
        if (theirs.some((row) => row.accountId !== other)) throw Error("Cross-account read");
        const kept = new Set([...mine, ...theirs].map((row) => row.sessionId));
        if (kept.size !== 100 || kept.has("cap-0") || kept.has("cap-1") || !kept.has("cap-101"))
          throw Error(`Cap did not evict oldest: ${kept.size}`);
        if ((await recoveryStore.list(account, "bounded")).length)
          throw Error("Older records survived over-cap cleanup");
        // Remove future-dated test rows so they cannot crowd out later real drafts.
        for (const row of [...mine, ...theirs]) await recoveryStore.remove(row);
        await recoveryStore.put({
          ...draft,
          savedLocallyAt: Date.now(),
          content: { type: "doc", content: [{ type: "invalid" }] },
        });
        await recoveryStore.put({
          ...draft,
          sessionId: "garbage-json",
          savedLocallyAt: Date.now(),
          content: '{"type":"doc",',
        });
        await recoveryStore.put({
          ...draft,
          sessionId: "unexpected-attrs",
          savedLocallyAt: Date.now(),
          content: {
            type: "doc",
            content: [{ type: "paragraph", attrs: { style: "x" }, content: [{ type: "text", text: "x" }] }],
          },
        });
      },
      local,
      auth.ownerA,
      doc.id,
    );
    const serverBeforeCorrupt = await api(`/writer/${doc.id}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    assert.match(
      await page.$eval(".writer-recovery-notice", (el) => el.textContent),
      /unreadable/,
    );
    assert.equal(await page.$("dialog"), null);
    assert.deepEqual(
      await page.$eval(".writer-content", (el) => el.editor.getJSON()),
      serverBeforeCorrupt.content,
    );
    await waitClear(page, doc.id);
    checks.push(
      "native IDB CRUD, compare/delete, seven-day expiry, oldest-first 100-record cap across accounts and corrupt records (bad structure/garbage/unexpected attrs) fall back to server",
    );
    await block(page, 401);
    await edit(page, " Session expired unsaved work.");
    await waitRecord(page, doc.id);
    await wait(1300);
    assert.ok((await records(page, doc.id)).length);
    await page.close();
    // Whole session expired: /auth/me (and every API call) returns 401. The app clears
    // its token and leaves Writer, but must not touch the recovery database.
    page = await newPage(auth.tokenA);
    await page.setRequestInterception(true);
    let meRejected = false;
    page.on("request", (r) => {
      if (!r.url().startsWith(base)) return r.continue();
      if (r.url().includes("/auth/me")) meRejected = true;
      return r.respond({
        status: 401,
        contentType: "application/json",
        body: '{"message":"Unauthorized"}',
      });
    });
    await open(page, doc.id);
    await page.waitForFunction(() => !location.pathname.startsWith("/writer/"), {
      timeout: 10000,
    }).catch(() => {});
    await wait(800);
    assert.ok(meRejected, "/auth/me was not exercised");
    assert.equal(await page.$(".writer-content"), null);
    assert.equal(await page.$("dialog[open]"), null);
    assert.ok((await records(page, doc.id)).length, "401 deleted local draft");
    await page.close();
    // Another account signing in on this browser still cannot see it.
    page = await newPage(auth.tokenB);
    await open(page, doc.id);
    await page.waitForFunction(() =>
      document.body.textContent.includes("Writer document not found"),
    );
    assert.equal(await page.$("dialog"), null);
    assert.deepEqual(await records(page, doc.id, auth.ownerB), []);
    assert.ok((await records(page, doc.id)).length);
    await page.close();
    page = await newPage(auth.tokenA);
    await open(page, doc.id);
    await page.waitForSelector("dialog[open]");
    assert.match(
      await page.$eval("dialog", (el) => el.textContent),
      /Unsaved changes found|Saved version has changed/,
    );
    await click(page, "Use saved version");
    await ready(page);
    await waitClear(page, doc.id);
    checks.push(
      "expired save authorization and /auth/me 401 retain local draft; B cannot see it; same account re-authenticated is offered it",
    );
    // Storage unavailable must not interfere with backend autosave.
    await page.close();
    page = await newPage(auth.tokenA);
    await page.evaluateOnNewDocument(() =>
      Object.defineProperty(window, "indexedDB", {
        get() {
          throw Error("Storage denied");
        },
      }),
    );
    await open(page, doc.id);
    await ready(page);
    await edit(page, " Storage unavailable but saved online.");
    await saved(page);
    assert.match(
      await page.$eval(".writer-recovery-notice", (el) => el.textContent),
      /unavailable/,
    );
    assert.ok(
      JSON.stringify((await api(`/writer/${doc.id}`)).content).includes(
        "Storage unavailable",
      ),
    );
    checks.push(
      "unavailable IndexedDB leaves editing and backend saving operational",
    );
    await page.close();
    // Request A held in flight while local B is checkpointed; B request then fails.
    doc = await api("/writer", "POST", { title: "In-flight race" });
    page = await newPage(auth.tokenA);
    await open(page, doc.id);
    await ready(page);
    await page.setRequestInterception(true);
    let held;
    page.on("request", (r) => {
      if (r.method() !== "PATCH") return r.continue();
      if (!held) {
        held = r;
        return;
      }
      return r.respond({
        status: 503,
        contentType: "application/json",
        body: '{"message":"B offline"}',
      });
    });
    await edit(page, "State A.");
    while (!held) await wait(100);
    await edit(page, " State B.");
    await wait(400);
    const stateB = (await records(page, doc.id))[0];
    assert.ok(JSON.stringify(stateB.content).includes("State B"));
    await held.continue();
    await wait(700);
    const afterA = (await records(page, doc.id))[0];
    assert.deepEqual(afterA.content, stateB.content);
    assert.equal(afterA.baseRevision, 2);
    checks.push(
      "real in-flight save A retains B recovery with advanced baseline",
    );
    await page.close();
    // Measure immediate editing work with local snapshot path enabled and actual 1/3/10-page layouts.
    const performanceResults = [];
    for (const paragraphs of [4, 20, 70]) {
      const fresh = await api("/writer", "POST", {
        title: `Recovery performance ${paragraphs}`,
      });
      page = await newPage(auth.tokenA);
      await open(page, fresh.id);
      await ready(page);
      await block(page);
      await page.$eval(
        ".writer-content",
        (el, content) => el.editor.commands.setContent(content),
        {
          type: "doc",
          content: Array.from({ length: paragraphs }, () => paragraph()),
        },
      );
      await page.evaluate(() => document.fonts.ready);
      await wait(600);
      const result = await page.$eval(".writer-content", async (el) => {
        const sync = [],
          frames = [];
        for (let i = 0; i < 30; i++) {
          const t = performance.now();
          el.editor.chain().focus("end").insertContent("x").run();
          sync.push(performance.now() - t);
          await new Promise(requestAnimationFrame);
          frames.push(performance.now() - t);
        }
        const p = (a, n) => a.sort((a, b) => a - b)[Math.floor(a.length * n)];
        return {
          pages: el.querySelectorAll(".rm-page-break").length,
          median: p(sync, 0.5),
          p95: p(sync, 0.95),
          frameP95: p(frames, 0.95),
        };
      });
      await waitRecord(page, fresh.id);
      performanceResults.push(result);
      await page.close();
    }
    fs.writeFileSync(
      "/tmp/writer-recovery-results.json",
      JSON.stringify({ checks, performanceResults }, null, 2),
    );
    console.log(JSON.stringify({ checks, performanceResults }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
