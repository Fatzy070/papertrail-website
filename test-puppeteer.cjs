const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  await page.goto('http://localhost:5173/test-browser.html');
  
  console.log("Wait for page...");
  await new Promise(r => setTimeout(r, 1000));
  
  const fileInput = await page.$('#file');
  await fileInput.uploadFile('/home/fatzy/Downloads/Recipt1771584462029.pdf');
  
  console.log("File uploaded. Waiting for console output...");
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
})();
