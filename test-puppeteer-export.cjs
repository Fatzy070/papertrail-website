const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  await page.goto('http://localhost:5173/test-export.html');
  
  console.log("Wait for page...");
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Uploading file...");
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/home/fatzy/Desktop/projects/pdfeditor/scripts/test_export.pdf');
  }
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking Run...");
  await page.click('#btn');
  
  await new Promise(r => setTimeout(r, 3000));
  
  const logText = await page.$eval('#log', el => el.textContent);
  console.log("LOG:\n" + logText);
  
  const finalBytesArray = await page.evaluate(() => {
    return window.finalBytes ? Array.from(window.finalBytes) : null;
  });
  if (finalBytesArray) {
    const fs = require('fs');
    fs.writeFileSync('output.pdf', Buffer.from(finalBytesArray));
    console.log("Saved output.pdf");
  }

  const mupdfBytesArray = await page.evaluate(() => {
    return window.mupdfBytes ? Array.from(window.mupdfBytes) : null;
  });
  if (mupdfBytesArray) {
    const fs = require('fs');
    fs.writeFileSync('mupdf_output.pdf', Buffer.from(mupdfBytesArray));
    console.log("Saved mupdf_output.pdf");
  }

  await browser.close();
})();
