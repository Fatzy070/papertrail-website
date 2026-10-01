const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  await page.goto('http://localhost:5173');
  
  console.log("Wait for editor to load...");
  await new Promise(r => setTimeout(r, 2000));
  
  // Expose a function to run test
  await page.evaluate(async () => {
     try {
       // We can import from window if we expose it, but this is a vite app
       // Instead, let's just trigger the export via the global state
     } catch (e) {
       console.error("Test failed", e);
     }
  });
  
  await browser.close();
})();
