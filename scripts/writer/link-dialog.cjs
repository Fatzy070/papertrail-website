const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
(async () => {
  const { tokenA } = JSON.parse(fs.readFileSync('/tmp/writer-poc-auth.json', 'utf8'));
  const response = await fetch('http://127.0.0.1:3007/api/writer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Link dialog acceptance' }),
  });
  assert.equal(response.status, 201);
  const doc = await response.json();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.on('dialog', () => { throw new Error('Unexpected browser prompt'); });
    await page.evaluateOnNewDocument(token => localStorage.setItem('auth_token', token), tokenA);
    await page.goto(`http://127.0.0.1:5175/writer/${doc.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.writer-content');
    await page.$eval('.writer-content', el => el.editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Papertrail is useful.' }] }] }));
    const select = async (from, to = from) => page.$eval('.writer-content', (el, range) => el.editor.chain().focus().setTextSelection(range).run(), { from, to });
    const button = async label => {
      const buttons = await page.$$('button');
      for (const b of buttons) if ((await b.evaluate(el => el.textContent.trim())) === label) { await b.click(); return; }
      throw new Error(`Button missing: ${label}`);
    };
    const open = async () => { await button('Link'); await page.waitForSelector('dialog[open] input'); await page.waitForFunction(() => document.activeElement === document.querySelector('dialog input'));  };
    const input = async value => { await page.focus('dialog input'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); if (value) await page.type('dialog input', value); };
    const href = () => page.$eval('.writer-content', el => el.querySelector('a')?.getAttribute('href') || null);
    const closed = () => page.waitForSelector('dialog', { hidden: true });
    await select(1, 11); await open();
    assert.equal(await page.$eval('dialog input', el => el === document.activeElement), true);
    await input('papertrail.parvis.com.ng'); await button('Apply link'); await closed();
    assert.equal(await href(), 'https://papertrail.parvis.com.ng/');
    assert.equal(await page.$eval('.writer-content a', el => el.textContent), 'Papertrail');
    await select(4); await open();
    assert.equal(await page.$eval('dialog h2', el => el.textContent), 'Edit link');
    assert.equal(await page.$eval('dialog input', el => el.value), 'https://papertrail.parvis.com.ng/');
    await input('http://example.com/changed'); await page.keyboard.press('Enter'); await closed();
    assert.equal(await href(), 'http://example.com/changed');
    await open(); await input('https://cancel.example'); await button('Cancel'); await closed();
    assert.equal(await href(), 'http://example.com/changed');
    await open(); await input('https://escape.example'); await page.keyboard.press('Escape'); await closed();
    assert.equal(await href(), 'http://example.com/changed');
    await open();
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'https://', 'bad url']) {
      await input(value); await page.keyboard.press('Enter'); await page.waitForSelector('dialog [role="alert"]');
      assert.equal(await href(), 'http://example.com/changed');
    }
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('dialog'))), true); }
    await button('Remove link'); await closed(); assert.equal(await href(), null);
    await select(1, 11); await open(); await input('mailto:hello@example.com'); await page.keyboard.press('Enter'); await closed();
    assert.equal(await href(), 'mailto:hello@example.com');
    await select(3); await open(); await input(''); await page.keyboard.press('Enter'); await closed(); assert.equal(await href(), null);
    await select(1, 11); await open();
    for (const width of [320, 375, 768]) {
      await page.setViewport({ width, height: 800 });
      assert.equal(await page.$eval('dialog', el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth; }), true);
    }
    await page.setViewport({ width: 375, height: 800 });
    await page.screenshot({ path: '/tmp/writer-link-light.png' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: '/tmp/writer-link-dark.png' });
    console.log('PASS: selection, add/normalize, prefill, edit, remove, empty removal, cancel, Enter, Escape, unsafe validation, focus trap, 320/375/768 layout; light/dark screenshots captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
