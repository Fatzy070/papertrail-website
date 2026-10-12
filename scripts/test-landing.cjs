const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
(async () => {
 const cors = {'access-control-allow-origin':'http://127.0.0.1:5174','access-control-allow-credentials':'true','access-control-allow-headers':'authorization,content-type'};
 const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
 try {
  for (const token of [null, 'stale-token']) {
   const page = await browser.newPage();
   page.setDefaultTimeout(10000);

   const init = await page.evaluateOnNewDocument(t => { localStorage.removeItem('auth_token'); if(t) localStorage.setItem('auth_token',t); }, token);
   await page.setRequestInterception(true);
   let pending;
   page.on('request', r => r.method() === 'OPTIONS' ? r.respond({status:204,headers:cors}) : r.url().includes('/auth/me') ? pending = r : r.continue());
   await page.goto('http://127.0.0.1:5174', {waitUntil:'domcontentloaded'});
   await page.waitForSelector('.hero-actions .primary-button');
   await page.removeScriptToEvaluateOnNewDocument(init.identifier);

   const label = await page.$eval('.landing-header-actions', e=>e.textContent);
   assert.ok(label.includes(token ? 'Go to dashboard' : 'Sign in'));
   assert.equal(await page.$('.landing .skeleton'), null);
   if(token) {
    assert.match(await page.$eval('.hero-actions',e=>e.textContent), /Go to dashboard/);
    await page.click('.hero-actions .primary-button');
    assert.equal(await page.$('.dashboard'), null);
   }

   await pending.respond({status:401, contentType:'application/json', headers:{'access-control-allow-origin':'http://127.0.0.1:5174','access-control-allow-credentials':'true'}, body:'{"message":"Unauthorized"}'});

   await page.waitForFunction(()=>localStorage.getItem('auth_token')===null);
   if(token) { await page.waitForFunction(()=>location.pathname==='/login'); await page.goto('http://127.0.0.1:5174', {waitUntil:'domcontentloaded'}); }
   await page.waitForSelector('.landing-header-actions');
   assert.match(await page.$eval('.landing-header-actions',e=>e.textContent), /Sign in/);
   await page.close();
  }
  // Verify successful token/cookie sessions and correction while staying on the landing page.
  for (const scenario of ['valid', 'cookie', 'stale']) {
   const page = await browser.newPage();
   await page.setViewport({width:320,height:900});
   await page.evaluateOnNewDocument(s => { localStorage.removeItem('auth_token'); if(s !== 'cookie') localStorage.setItem('auth_token', 'test-token'); }, scenario);
   await page.setRequestInterception(true);
   let verify;
   page.on('request', r => r.method() === 'OPTIONS' ? r.respond({status:204,headers:cors}) : r.url().includes('/auth/me') ? verify = r : r.continue());
   await page.goto('http://127.0.0.1:5174', {waitUntil:'domcontentloaded'});
   await page.waitForSelector('.hero-actions .primary-button');
   assert.match(await page.$eval('.landing-header-actions',e=>e.textContent), scenario === 'cookie' ? /Sign in/ : /Go to dashboard/);
   await verify.respond({status:scenario === 'stale' ? 401 : 200, headers:cors, contentType:'application/json',body:JSON.stringify(scenario === 'stale' ? {} : {id:'test',name:'Test',email:'test@example.com',emailVerified:true,profile:{initials:'T',imageUrl:null}})});
   await page.waitForFunction(expected => document.querySelector('.landing-header-actions').textContent.includes(expected), {}, scenario === 'stale' ? 'Sign in' : 'Go to dashboard');
   assert.match(await page.$eval('.hero-actions',e=>e.textContent), scenario === 'stale' ? /Start editing for free/ : /Go to dashboard/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `auth overflow ${scenario}`);
   if(scenario === 'stale') assert.equal(await page.evaluate(()=>localStorage.getItem('auth_token')),null);
   await page.close();
  }
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', r => r.method() === 'OPTIONS' ? r.respond({status:204,headers:cors}) : r.url().includes('/auth/me') ? r.respond({status:401,contentType:'application/json',headers:{'access-control-allow-origin':'http://127.0.0.1:5174','access-control-allow-credentials':'true'},body:'{}'}) : r.continue());
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  for(const dark of [false,true]) for(const width of [320,375,390,430,768,1024,1440]) {
   await page.setViewport({width,height:1000});
   await page.goto('http://127.0.0.1:5174', {waitUntil:'domcontentloaded'});
   await page.waitForSelector('.landing-footer');
   await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `overflow ${width} dark=${dark}`);
   await page.screenshot({path:`/tmp/papertrail-${width}-${dark?'dark':'light'}.png`,fullPage:true});
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto('http://127.0.0.1:5174', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.hero-actions .primary-button');
  assert.equal(await page.$eval('.hero-actions',e=>getComputedStyle(e).opacity), '1');
  for(const selector of ['.hero-product', '.feature-item', '.pricing-grid > div']) {
   await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));
   await page.waitForFunction(s=>getComputedStyle(document.querySelector(s)).opacity==='1',{},selector);
  }
  console.log('PASS: pending CTAs, valid token and cookie sessions, stale-token correction, protected-route rejection, reduced-motion layouts at 7 widths in both themes.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e); process.exit(1)});
