const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  await page.goto('http://localhost:5173');
  
  console.log("Wait for page...");
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Uploading file...");
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/home/fatzy/Downloads/Recipt1771584462029.pdf');
  } else {
    console.log("File input not found!");
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking Edit Text button...");
  // Let's just click the button with title "Edit Text"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const editBtn = btns.find(b => b.textContent.includes('Edit') || b.title.includes('Edit'));
    if (editBtn) editBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking on text element...");
  await page.mouse.click(200, 200); // Try clicking somewhere in the middle
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Pressing Delete...");
  await page.keyboard.press('Delete');
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking Download...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dlBtn = btns.find(b => b.textContent.includes('Download') || b.title.includes('Download'));
    if (dlBtn) dlBtn.click();
  });
  
  console.log("Waiting for export error...");
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
