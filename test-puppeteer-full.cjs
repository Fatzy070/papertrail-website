const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  // Set fake user in localStorage to bypass Auth
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('sb-htfblhmsbtyrfjnvbtdf-auth-token', JSON.stringify({
      access_token: "fake",
      refresh_token: "fake",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "123", aud: "authenticated", role: "authenticated", email: "test@example.com" }
    }));
  });
  
  await page.goto('http://localhost:5173');
  
  console.log("Wait for page...");
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Uploading file...");
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/home/fatzy/Desktop/projects/pdfeditor/scripts/test_output.pdf');
  } else {
    console.log("File input not found! Maybe it's loading?");
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Looking for Edit Text...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const editBtn = btns.find(b => b.textContent.includes('Edit') || b.title?.includes('Edit'));
    if (editBtn) {
      console.log("Found edit btn");
      editBtn.click();
    }
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking on text element...");
  await page.mouse.click(200, 200); 
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Pressing Delete...");
  await page.keyboard.press('Delete');
  
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking Download...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dlBtn = btns.find(b => b.textContent.includes('Download') || b.title?.includes('Download'));
    if (dlBtn) dlBtn.click();
  });
  
  console.log("Waiting for export...");
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
