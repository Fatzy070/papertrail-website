const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
  
  // Expose the store in App.tsx if it isn't already, wait! I might need to make sure `useEditorStore` is available.
  await page.goto('http://localhost:5173/');
  console.log("Wait for page...");
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Uploading NVerify PDF...");
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/home/fatzy/Desktop/projects/pdfeditor/frontend/scripts/test_nverify.pdf');
  } else {
    console.log("No file input found!");
  }
  
  await new Promise(r => setTimeout(r, 4000));
  
  console.log("Extracting 'Current Core Product' TextElement state...");
  
  const elementStateBefore = await page.evaluate(() => {
    // We assume window.__editorStore is exposed, let me make sure.
    // If not, I can just click the text and read from the DOM, but it's better to expose the store.
    if (!window.useEditorStore) return "window.useEditorStore is not defined";
    const store = window.useEditorStore.getState();
    const document = store.document;
    if (!document) return "No document";
    let target = null;
    for (const p of document.pages) {
      target = p.elements.find(e => e.type === 'text' && e.text.includes('Current Core Product'));
      if (target) break;
    }
    return target;
  });
  
  console.log('BEFORE EDIT:', typeof elementStateBefore === 'object' ? JSON.stringify(elementStateBefore, null, 2) : elementStateBefore);
  
  if (elementStateBefore && typeof elementStateBefore === 'object') {
    console.log("Simulating content edit to 'Product'...");
    await page.evaluate((id) => {
      window.useEditorStore.getState().updateElement(id, {
        text: 'Product',
        edited: true
      });
    }, elementStateBefore.id);
    
    await new Promise(r => setTimeout(r, 1000));
    
    const elementStateAfter = await page.evaluate((id) => {
      const store = window.useEditorStore.getState();
      const document = store.document;
      for (const p of document.pages) {
        const el = p.elements.find(e => e.id === id);
        if (el) return el;
      }
      return null;
    }, elementStateBefore.id);
    
    console.log('AFTER EDIT:', JSON.stringify(elementStateAfter, null, 2));
  }
  
  await browser.close();
})();
