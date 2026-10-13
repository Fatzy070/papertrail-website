const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5175";
const API_BASE = process.env.API_BASE || "http://127.0.0.1:3007/api";

async function waitForSaved(page) {
  await page.waitForFunction(
    () => document.querySelector(".writer-save")?.textContent === "Saved",
    { timeout: 15000 },
  );
}

(async () => {
  const { tokenA } = JSON.parse(
    fs.readFileSync("/tmp/writer-poc-auth.json", "utf8"),
  );
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenA}`,
  };

  const createRes = await fetch(`${API_BASE}/writer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Clear Formatting Verification" }),
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
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".writer-content");

    // Verify toolbar button attributes and tooltip
    const buttonMeta = await page.$eval(
      '.writer-toolbar button[aria-label="Clear formatting"]',
      (btn) => ({
        title: btn.getAttribute("title"),
        ariaLabel: btn.getAttribute("aria-label"),
        hasSvg: Boolean(btn.querySelector("svg")),
      }),
    );
    assert.equal(buttonMeta.title, "Clear formatting");
    assert.equal(buttonMeta.ariaLabel, "Clear formatting");
    assert.equal(buttonMeta.hasSvg, true);
    checks.push("toolbar-button-icon-and-tooltip");

    const clickClearFormatting = async () => {
      await page.click('.writer-toolbar button[aria-label="Clear formatting"]');
    };

    // -------------------------------------------------------------------------
    // 1. Selected formatted text ("This is important")
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is important",
                marks: [
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "18pt" },
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.selectAll();
    });

    await clickClearFormatting();

    const clearedBasic = await page.$eval(".writer-content", (el) => {
      const json = el.editor.getJSON();
      const p = el.querySelector("p");
      const cs = window.getComputedStyle(p);
      return {
        node: json.content[0].content[0],
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        hasStrong: Boolean(p.querySelector("strong")),
        hasEm: Boolean(p.querySelector("em")),
        hasU: Boolean(p.querySelector("u")),
      };
    });
    assert.equal(clearedBasic.node.text, "This is important");
    assert.equal(clearedBasic.node.marks, undefined);
    assert.match(clearedBasic.fontFamily, /Writer Sans/);
    assert.equal(clearedBasic.fontSize, "16px"); // 12pt = 16px
    assert.equal(clearedBasic.hasStrong, false);
    assert.equal(clearedBasic.hasEm, false);
    assert.equal(clearedBasic.hasU, false);
    checks.push("basic-inline-marks-cleared-to-default");

    // -------------------------------------------------------------------------
    // 2. Undo / Redo test (Section 15 & 24)
    // -------------------------------------------------------------------------
    await page.click('.writer-toolbar button[title="Undo"]');
    const afterUndo = await page.$eval(".writer-content", (el) => {
      const node = el.editor.getJSON().content[0].content[0];
      return (node.marks || []).map((m) => m.type).sort();
    });
    assert.deepEqual(afterUndo, ["bold", "italic", "textStyle", "underline"]);

    await page.click('.writer-toolbar button[title="Redo"]');
    const afterRedo = await page.$eval(".writer-content", (el) => {
      return el.editor.getJSON().content[0].content[0].marks;
    });
    assert.equal(afterRedo, undefined);
    checks.push("undo-restores-and-redo-clears-formatting");

    // -------------------------------------------------------------------------
    // 3. Partial selection test (Section 20)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hello beautiful Papertrail document",
                marks: [
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "18pt" },
                  },
                ],
              },
            ],
          },
        ],
      });
      // "Hello " is positions 1..7, "beautiful" is positions 7..16
      el.editor.chain().focus().setTextSelection({ from: 7, to: 16 }).run();
    });

    await clickClearFormatting();

    const partialNodes = await page.$eval(".writer-content", (el) => {
      return el.editor.getJSON().content[0].content;
    });
    assert.equal(partialNodes.length, 3);
    assert.equal(partialNodes[0].text, "Hello ");
    assert.equal(partialNodes[0].marks.length, 4);
    assert.equal(partialNodes[1].text, "beautiful");
    assert.equal(partialNodes[1].marks, undefined);
    assert.equal(partialNodes[2].text, " Papertrail document");
    assert.equal(partialNodes[2].marks.length, 4);
    checks.push("partial-selection-only-clears-selected-range");

    // -------------------------------------------------------------------------
    // 4. Heading test (Section 21)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, textAlign: "center" },
            content: [
              {
                type: "text",
                text: "Quarterly Report Heading",
                marks: [
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "30pt" },
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.selectAll();
    });

    await clickClearFormatting();

    const headingCheck = await page.$eval(".writer-content", (el) => {
      const block = el.editor.getJSON().content[0];
      const h1 = el.querySelector("h1");
      const cs = window.getComputedStyle(h1);
      return {
        type: block.type,
        level: block.attrs.level,
        textAlign: block.attrs.textAlign,
        marks: block.content[0].marks,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      };
    });
    assert.equal(headingCheck.type, "heading");
    assert.equal(headingCheck.level, 1);
    assert.equal(headingCheck.textAlign, "center");
    assert.equal(headingCheck.marks, undefined);
    assert.match(headingCheck.fontFamily, /Writer Sans/);
    assert.equal(headingCheck.fontSize, "32px"); // 24pt h1 default = 32px
    assert.equal(headingCheck.fontWeight, "700");
    checks.push("heading-structure-and-default-heading-size-preserved");

    // -------------------------------------------------------------------------
    // 5. List test (Section 22)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Item one",
                        marks: [
                          { type: "bold" },
                          {
                            type: "textStyle",
                            attrs: {
                              fontFamily: "Writer Serif",
                              fontSize: "16pt",
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Item two",
                        marks: [{ type: "italic" }, { type: "underline" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.selectAll();
    });

    await clickClearFormatting();

    const listCheck = await page.$eval(".writer-content", (el) => {
      const listNode = el.editor.getJSON().content[0];
      return {
        type: listNode.type,
        itemCount: listNode.content.length,
        item1Marks: listNode.content[0].content[0].content[0].marks,
        item2Marks: listNode.content[1].content[0].content[0].marks,
      };
    });
    assert.equal(listCheck.type, "bulletList");
    assert.equal(listCheck.itemCount, 2);
    assert.equal(listCheck.item1Marks, undefined);
    assert.equal(listCheck.item2Marks, undefined);
    checks.push("bullet-list-structure-preserved");

    // -------------------------------------------------------------------------
    // 6. Link preservation test (Section 5 & 23)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Papertrail website",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://papertrail.parvis.com.ng/docs" },
                  },
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "24pt" },
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.selectAll();
    });

    await clickClearFormatting();

    const linkCheck = await page.$eval(".writer-content", (el) => {
      const textNode = el.editor.getJSON().content[0].content[0];
      const anchor = el.querySelector("a");
      return {
        marks: textNode.marks,
        domHref: anchor?.getAttribute("href"),
        hasStrong: Boolean(el.querySelector("strong")),
        hasEm: Boolean(el.querySelector("em")),
      };
    });
    assert.equal(linkCheck.marks.length, 1);
    assert.equal(linkCheck.marks[0].type, "link");
    assert.equal(
      linkCheck.marks[0].attrs.href,
      "https://papertrail.parvis.com.ng/docs",
    );
    assert.equal(linkCheck.domHref, "https://papertrail.parvis.com.ng/docs");
    assert.equal(linkCheck.hasStrong, false);
    assert.equal(linkCheck.hasEm, false);
    checks.push("link-preserved-while-inline-styles-removed");

    // -------------------------------------------------------------------------
    // 7. Mixed formatting & full structure preservation test (Section 4, 6, 19)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "right" },
            content: [
              {
                type: "text",
                text: "Section Heading",
                marks: [
                  { type: "italic" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "30pt" },
                  },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              { type: "text", text: "Normal " },
              { type: "text", text: "bold ", marks: [{ type: "bold" }] },
              { type: "text", text: "italic ", marks: [{ type: "italic" }] },
              {
                type: "text",
                text: "serif ",
                marks: [
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif" },
                  },
                ],
              },
              {
                type: "text",
                text: "large ",
                marks: [{ type: "textStyle", attrs: { fontSize: "24pt" } }],
              },
              {
                type: "text",
                text: "linked",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://papertrail.parvis.com.ng/" },
                  },
                  { type: "bold" },
                  { type: "underline" },
                ],
              },
            ],
          },
          { type: "pageBreak" },
          {
            type: "orderedList",
            attrs: { start: 1 },
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Numbered item",
                        marks: [{ type: "bold" }, { type: "underline" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.selectAll();
    });

    await clickClearFormatting();

    const mixedResult = await page.$eval(".writer-content", (el) => {
      return el.editor.getJSON().content;
    });
    assert.equal(mixedResult[0].type, "heading");
    assert.equal(mixedResult[0].attrs.level, 2);
    assert.equal(mixedResult[0].attrs.textAlign, "right");
    assert.equal(mixedResult[0].content[0].marks, undefined);

    assert.equal(mixedResult[1].type, "paragraph");
    assert.equal(mixedResult[1].attrs.textAlign, "center");
    assert.equal(mixedResult[1].content.length, 2); // plain text merged + linked text
    assert.equal(
      mixedResult[1].content[0].text,
      "Normal bold italic serif large ",
    );
    assert.equal(mixedResult[1].content[0].marks, undefined);
    assert.equal(mixedResult[1].content[1].text, "linked");
    assert.equal(mixedResult[1].content[1].marks.length, 1);
    assert.equal(mixedResult[1].content[1].marks[0].type, "link");

    assert.equal(mixedResult[2].type, "pageBreak");
    assert.equal(mixedResult[3].type, "orderedList");
    assert.equal(
      mixedResult[3].content[0].content[0].content[0].marks,
      undefined,
    );
    checks.push("mixed-formatting-and-structure-preserved");

    // -------------------------------------------------------------------------
    // 8. Pasted rich content test (Section 18)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [{ type: "paragraph" }],
      });
      el.editor.commands.focus("start");
      const dt = new DataTransfer();
      dt.setData(
        "text/html",
        `<p><strong><em><u><span style="font-family: 'Writer Serif'; font-size: 24px; color: red; background: yellow">Pasted rich external content</span></u></em></strong></p><p><span style="font-family: 'Writer Serif'; font-size: 18pt">Second pasted paragraph</span></p>`,
      );
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    const beforePasteClear = await page.$eval(".writer-content", (el) => {
      return el.editor.getJSON().content[0].content[0].marks.map((m) => m.type);
    });
    assert.ok(beforePasteClear.includes("bold"));
    assert.ok(beforePasteClear.includes("italic"));
    assert.ok(beforePasteClear.includes("underline"));
    assert.ok(beforePasteClear.includes("textStyle"));

    await page.$eval(".writer-content", (el) => el.editor.commands.selectAll());
    await clickClearFormatting();

    const afterPasteClear = await page.$eval(".writer-content", (el) => {
      const blocks = el.editor.getJSON().content;
      return {
        blockCount: blocks.length,
        p1Text: blocks[0].content[0].text,
        p1Marks: blocks[0].content[0].marks,
        p2Text: blocks[1].content[0].text,
        p2Marks: blocks[1].content[0].marks,
      };
    });
    assert.equal(afterPasteClear.blockCount, 2);
    assert.equal(afterPasteClear.p1Text, "Pasted rich external content");
    assert.equal(afterPasteClear.p1Marks, undefined);
    assert.equal(afterPasteClear.p2Text, "Second pasted paragraph");
    assert.equal(afterPasteClear.p2Marks, undefined);
    checks.push("pasted-rich-html-formatting-cleared");

    // -------------------------------------------------------------------------
    // 9. No-selection (empty cursor) test (Section 11)
    // -------------------------------------------------------------------------
    await page.$eval(".writer-content", (el) => {
      el.editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Styled prefix",
                marks: [
                  { type: "bold" },
                  { type: "italic" },
                  { type: "underline" },
                  {
                    type: "textStyle",
                    attrs: { fontFamily: "Writer Serif", fontSize: "18pt" },
                  },
                ],
              },
            ],
          },
        ],
      });
      el.editor.commands.focus("end");
    });

    // Clear formatting at cursor with no selection
    await clickClearFormatting();

    // Verify toolbar state immediately reflects cleared storedMarks
    const toolbarStateAfterCursorClear = await page.evaluate(() => ({
      font: document.querySelector('select[aria-label="Font family"]').value,
      size: document.querySelector('select[aria-label="Font size"]').value,
      boldPressed: document
        .querySelector('button[aria-label="Bold"]')
        .getAttribute("aria-pressed"),
      italicPressed: document
        .querySelector('button[aria-label="Italic"]')
        .getAttribute("aria-pressed"),
      underlinePressed: document
        .querySelector('button[aria-label="Underline"]')
        .getAttribute("aria-pressed"),
    }));
    assert.equal(toolbarStateAfterCursorClear.font, "Writer Sans");
    assert.equal(toolbarStateAfterCursorClear.size, "12pt");
    assert.equal(toolbarStateAfterCursorClear.boldPressed, "false");
    assert.equal(toolbarStateAfterCursorClear.italicPressed, "false");
    assert.equal(toolbarStateAfterCursorClear.underlinePressed, "false");

    await page.keyboard.type(" and plain continuation");

    const cursorClearNodes = await page.$eval(".writer-content", (el) => {
      return el.editor.getJSON().content[0].content;
    });
    assert.equal(cursorClearNodes.length, 2);
    assert.equal(cursorClearNodes[0].text, "Styled prefix");
    assert.equal(cursorClearNodes[0].marks.length, 4);
    assert.equal(cursorClearNodes[1].text, " and plain continuation");
    assert.equal(cursorClearNodes[1].marks, undefined);
    checks.push("empty-cursor-resets-active-marks-without-modifying-neighbors");

    // -------------------------------------------------------------------------
    // 10. Autosave, Recovery, and Backend PDF Export parity (Sections 16 & 17)
    // -------------------------------------------------------------------------
    await waitForSaved(page);
    const savedDoc = await fetch(`${API_BASE}/writer/${createdDoc.id}`, {
      headers,
    }).then((r) => r.json());
    assert.ok(savedDoc.revision > createdDoc.revision);
    assert.equal(
      savedDoc.content.content[0].content[1].text,
      " and plain continuation",
    );
    assert.equal(savedDoc.content.content[0].content[1].marks, undefined);

    const exportRes = await fetch(
      `${API_BASE}/writer/${createdDoc.id}/export`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ revision: savedDoc.revision }),
      },
    );
    assert.equal(exportRes.status, 201);
    const pdfPath = "/tmp/writer-clear-formatting-export.pdf";
    fs.writeFileSync(pdfPath, Buffer.from(await exportRes.arrayBuffer()));
    const pdfText = execFileSync("pdftotext", [pdfPath, "-"], {
      encoding: "utf8",
    });
    assert.match(pdfText, /Styled prefix and plain continuation/);
    fs.unlinkSync(pdfPath);
    checks.push("autosave-revision-and-pdf-export-parity");

    // -------------------------------------------------------------------------
    // 11. Mobile accessibility & horizontal scroll toolbar check (Section 13)
    // -------------------------------------------------------------------------
    for (const width of [375, 320]) {
      await page.setViewport({ width, height: 812 });
      const mobileCheck = await page.evaluate(() => {
        const toolbar = document.querySelector(".writer-toolbar");
        const clearBtn = document.querySelector(
          '.writer-toolbar button[aria-label="Clear formatting"]',
        );
        clearBtn.scrollIntoView({ inline: "center", block: "nearest" });
        const rect = clearBtn.getBoundingClientRect();
        return {
          noPageOverflow:
            document.documentElement.scrollWidth <= window.innerWidth,
          toolbarScrollable: toolbar.scrollWidth >= toolbar.clientWidth,
          buttonVisible:
            rect.width > 0 &&
            rect.height >= 32 &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth,
        };
      });
      assert.equal(mobileCheck.noPageOverflow, true);
      assert.equal(mobileCheck.buttonVisible, true);
    }
    checks.push("mobile-375-320-toolbar-accessible-no-overflow");

    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
