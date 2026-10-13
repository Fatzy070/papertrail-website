const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
// Actual user-provided serialization excerpt; text and personal URLs redacted.
const fixture = JSON.parse(fs.readFileSync('../papertrail-backend/validation/writer/fixtures/google-docs-paste.json', 'utf8'));
const auth = JSON.parse(fs.readFileSync('/tmp/writer-poc-auth.json', 'utf8'));
const base = 'http://127.0.0.1:3007/api';
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.tokenA}` };
(async () => {
  const created = await fetch(base + '/writer', {method:'POST',headers,body:JSON.stringify({title:'Paste regression'})});
  assert.equal(created.status,201); const doc = await created.json();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try {
    let page = await browser.newPage();
    const open = async () => {
      await page.evaluateOnNewDocument(t => localStorage.setItem('auth_token',t), auth.tokenA);
      await page.goto(`http://127.0.0.1:5175/writer/${doc.id}`,{waitUntil:'domcontentloaded'});
    };
    const ready = () => page.waitForSelector('.writer-content');
    const saved = () => page.waitForFunction(() => document.querySelector('.writer-save')?.textContent === 'Saved');
    const json = () => page.$eval('.writer-content',el=>el.editor.getJSON());
    await open(); await ready();
    // Recreate an old failing draft and force an HTTP 400; it must stay in IndexedDB.
    await page.setRequestInterception(true);
    page.on('request', req => req.method()==='PATCH' ? req.respond({status:400,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:5175','Access-Control-Allow-Credentials':'true'},body:JSON.stringify({message:'Unsupported or invalid Writer content.'})}) : req.continue());
    await page.$eval('.writer-content',(el,value)=>el.editor.commands.setContent(value),fixture);
    await page.waitForFunction(()=>document.querySelector('.writer-save')?.textContent.includes('Unable to save'));
    const records = await page.evaluate(async (owner,id)=>(await import('/src/writer/recovery-store.ts')).recoveryStore.list(owner,id),auth.ownerA,doc.id);
    assert.equal(records.length,1); assert.equal(records[0].content.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.fontFamily,'');
    await page.close(); page = await browser.newPage(); await open();
    await page.waitForFunction(()=>document.body.innerText.includes('Recover changes'));
    for (const button of await page.$$('button')) if ((await button.evaluate(el=>el.textContent)).includes('Recover changes')) {await button.click();break;}
    await ready(); await saved();
    assert.ok(JSON.stringify(await json()).includes('Redacted heading'));
    console.log('PASS: 400 retains actual legacy empty-style draft; close/reopen restores and saves it.');
    // Use the actual Writer paste pipeline with representative Google Docs-style HTML.
    const html = '<b id="docs-internal-guid-test" style="font-weight:normal"><h1><span style="font-family:Arial;font-size:26pt;font-weight:700">Paste heading</span></h1><h2>Section</h2>' +
      '<p style="text-align:center"><span style="font-family:Arial;font-size:10pt">Natural paragraph <b>bold</b> <i>italic</i> <u>underline</u><br><a href="https://example.com" title="Example">Link</a></span></p>' +
      '<p><span style="font-family:Writer Serif;font-size:18pt">Approved font</span></p>' +
      '<ol start="3" style="list-style-type:lower-alpha"><li><p>Numbered item</p><ul><li><p>Nested bullet</p></li></ul></li></ol><p></p>' +
      Array.from({length:30},(_,i)=>`<p><span style="font-family:Arial;font-size:10pt">Paragraph ${i}. ${'Natural writing across pages. '.repeat(12)}</span></p>`).join('')+'</b>';
    await page.$eval('.writer-content',(el,html)=>{el.editor.commands.selectAll();el.editor.view.pasteHTML(html);},html);
    await saved();
    assert.equal(await page.$eval('.writer-content ol', el => getComputedStyle(el).listStyleType), 'lower-alpha');
    const content = await json();
    const styles=[]; const walk=n=>{for(const m of n.marks||[])if(m.type==='textStyle')styles.push(m.attrs);for(const c of n.content||[])walk(c);};walk(content);
    assert.ok(styles.length);assert.ok(styles.every(a=>a.fontFamily!=='' && a.fontSize!==''));
    assert.ok(styles.some(a=>a.fontFamily==='Writer Serif' && a.fontSize==='18pt'));
    await page.$eval('.writer-content',el=>el.editor.commands.focus('end'));await page.keyboard.type(' Typed after paste.');await saved();
    const before=await json();await page.reload({waitUntil:'domcontentloaded'});await ready();assert.deepEqual(await json(),before);
    const server=await (await fetch(base+'/writer/'+doc.id,{headers})).json();
    const output=await fetch(base+'/writer/'+doc.id+'/export',{method:'POST',headers,body:JSON.stringify({revision:server.revision})});
    assert.equal(output.status,201);const pdf=Buffer.from(await output.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');fs.writeFileSync('/tmp/writer-paste-regression.pdf',pdf);
    const invalid=await fetch(base+'/writer/'+doc.id,{method:'PATCH',headers,body:JSON.stringify({revision:server.revision,content:{type:'doc',content:[{type:'totallyUnsupportedNode'}]}})});assert.equal(invalid.status,400);
    const { renderDocument } = require('../../../papertrail-backend/dist/writer/renderer/writer-renderer');
    const preview = await browser.newPage();
    for (const [type, expected] of [['a', 'lower-alpha'], ['A', 'upper-alpha'], ['i', 'lower-roman'], ['I', 'upper-roman']]) {
      const list = {type:'doc',content:[{type:'orderedList',attrs:{start:3,type},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Numbered item'}]}]}]}]};
      await page.$eval('.writer-content', (el, value) => el.editor.commands.setContent(value), list);
      assert.equal(await page.$eval('.writer-content ol', el => getComputedStyle(el).listStyleType), expected);
      await preview.setContent(renderDocument(list, server.pageSettings));
      assert.equal(await preview.$eval('ol', el => getComputedStyle(el).listStyleType), expected);
    }
    await preview.close();
    console.log('PASS: all four numbering styles match actual Writer and backend HTML.');
    console.log('PASS: substantial rich HTML paste, approved/default fonts, nested lists, typing, autosave, refresh, backend PDF, invalid-node HTTP 400.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
