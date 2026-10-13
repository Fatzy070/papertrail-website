const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
const auth = JSON.parse(fs.readFileSync('/tmp/writer-poc-auth.json', 'utf8'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const requests = [];
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    let me;
    page.on('request', request => {
      requests.push(request.url());
      if (request.method() === 'GET' && request.url().endsWith('/auth/me')) me = request;
      else request.continue();
    });
    await page.goto('http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-actions .primary-button');
    assert.equal(await page.$eval('.hero-actions .primary-button', e => e.textContent.trim()), 'Start creating for free');
    assert.equal(await page.$eval('.landing-header-actions .text-link', e => e.textContent.trim()), 'Sign in');
    assert.match(await page.$eval('.hero-description', e => e.textContent), /Create PDFs from scratch or edit/);
    assert.equal(await page.$eval('.landing-create-copy a', e => e.getAttribute('href')), '/register');
    const widths = [320, 375, 390, 430, 768, 1024, 1440];
    for (const width of widths) {
      await page.setViewport({ width, height: 950 });
      for (const dark of [false, true]) {
        await page.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
        await page.$eval('#editor', e => e.scrollIntoView()); await delay(650);
        const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, paper: document.querySelector('.landing-writer-preview').getBoundingClientRect().toJSON() }));
        assert.ok(layout.scroll <= width, `Overflow at ${width}/${dark}: ${layout.scroll}`);
        assert.ok(layout.paper.left >= 0 && layout.paper.right <= width);
        if ([375, 1440].includes(width)) await page.screenshot({ path: `/tmp/landing-create-${width}-${dark ? 'dark' : 'light'}.png` });
      }
    }
    await page.click('.landing-workflow-choices button:nth-child(2)');
    assert.equal(await page.$$eval('.feature-grid article', e => e.length), 3);
    assert.equal(await page.$eval('#landing-workflow > a', e => e.getAttribute('href')), '/register');
    await page.focus('.landing-workflow-choices button:first-child'); await page.keyboard.press('Enter');
    assert.equal(await page.$eval('.landing-workflow-choices button:first-child', e => e.getAttribute('aria-pressed')), 'true');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    assert.equal(await page.$eval('.landing-writer-caret', e => getComputedStyle(e).display), 'none');
    assert.ok(!requests.some(url => /@tiptap|tiptap-pagination|\/writer\/WriterPage|\/writer\/pagination/.test(url)), 'Writer editor fetched on landing');
    await me.respond({ status: 401, contentType: 'application/json', body: '{"message":"Unauthorized"}' });
    await page.close();
    const signed = await browser.newPage(); let pendingMe; let holdAuth = true;
    await signed.evaluateOnNewDocument(token => localStorage.setItem('auth_token', token), auth.tokenA);
    await signed.setRequestInterception(true);
    signed.on('request', request => holdAuth && request.method() === 'GET' && request.url().endsWith('/auth/me') ? pendingMe = request : request.continue());
    await signed.goto('http://127.0.0.1:5175/', { waitUntil: 'domcontentloaded' });
    await signed.waitForSelector('.hero-actions .primary-button');
    for (const selector of ['.hero-actions .primary-button', '.landing-header-actions .primary-button']) {
      assert.equal(await signed.$eval(selector, e => e.textContent.trim()), 'Go to dashboard');
      assert.equal(await signed.$eval(selector, e => e.getAttribute('href')), '/dashboard');
    }
    await signed.click('.landing-workflow-choices button:nth-child(2)');
    assert.equal(await signed.$eval('#landing-workflow > a', e => e.getAttribute('href')), '/documents');
    await signed.click('.landing-workflow-choices button:first-child');
    assert.equal(await signed.$eval('.landing-create-copy a', e => e.getAttribute('href')), '/dashboard');
    holdAuth = false;
    const verified = signed.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/auth/me'));
    await pendingMe.continue();
    assert.equal((await verified).status(), 200);
    await signed.$eval('.landing-create-copy a', e => e.scrollIntoView({ block: 'center' }));
    await delay(600);
    await signed.click('.landing-create-copy a');
    await signed.waitForSelector('.writer-dashboard .primary-button');
    assert.equal(await signed.$eval('.writer-dashboard .primary-button', e => e.textContent.trim()), 'Create document');
    await signed.click('.writer-dashboard .primary-button');
    await signed.waitForSelector('dialog[open]');
    assert.match(await signed.$eval('dialog h2', e => e.textContent), /Create document/);
    console.log('PASS: immediate unauthenticated and local-token CTAs with /auth/me held; Create/Edit routes; existing creation dialog; 320/375/390/430/768/1024/1440 layout in light/dark; workflow keyboard activation; reduced motion; no Tiptap/Writer editor requests on landing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
