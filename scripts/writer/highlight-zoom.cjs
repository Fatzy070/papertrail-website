const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer');
const {fixture}=require('./fixture.cjs');
const origin='http://127.0.0.1:5175'; const base='http://127.0.0.1:3007/api';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const auth=JSON.parse(fs.readFileSync('/tmp/writer-poc-auth.json'));
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${auth.tokenA}`};
 const api=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});assert.ok(r.ok,`${method} ${path}: ${r.status} ${r.ok?'':await r.text()}`);return r.json();};
 const doc=await api('/writer','POST',{title:'Highlight and zoom acceptance'});
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 let page;
 try{
 const open=async()=>{page=await browser.newPage();await page.setViewport({width:1440,height:1000});await page.evaluateOnNewDocument(t=>localStorage.setItem('auth_token',t),auth.tokenA);page.on('pageerror',e=>console.error('PAGE ERROR',e.message));await page.goto(`${origin}/writer/${doc.id}`,{waitUntil:'domcontentloaded'});};
 const ready=()=>page.waitForSelector('.writer-content');
 const saved=()=>page.waitForFunction(()=>document.querySelector('.writer-save')?.textContent==='Saved');
 const content=()=>page.$eval('.writer-content',e=>e.editor.getJSON());
 const select=(from,to)=>page.$eval('.writer-content',(el,range)=>el.editor.chain().focus().setTextSelection(range).run(),{from,to});
 const click=async(label)=>{for(const b of await page.$$('button'))if(await b.evaluate((el,label)=>(el.getAttribute('aria-label')||el.textContent.trim())===label,label)){await b.click();return;}throw Error('Missing button '+label);};
 const palette=async color=>{await click('Highlight text');await page.waitForSelector('.writer-highlight-popover');await click(color);await page.waitForSelector('.writer-highlight-popover',{hidden:true});};
 const marks=()=>page.$eval('.writer-content',el=>el.editor.state.doc.firstChild.firstChild.marks.map(m=>m.toJSON()));
 const records=()=>page.evaluate(async(owner,id)=>(await import('/src/writer/recovery-store.ts')).recoveryStore.list(owner,id),auth.ownerA,doc.id);
 await open();await ready();
 await page.$eval('.writer-content',el=>el.editor.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Important information and plain text'}]}]}));
 await select(1,22);await palette('Yellow');
 assert.deepEqual((await marks()).find(m=>m.type==='highlight'),{type:'highlight',attrs:{color:'#fef08a'}});
 assert.equal(await page.$eval('.writer-content mark',e=>e.textContent),'Important information');
 await select(1,22);await click('Highlight text');assert.equal(await page.$eval('.writer-highlight-popover button[aria-pressed="true"]',e=>e.getAttribute('aria-label')||e.textContent.trim()),'Yellow');await click('Green');await page.waitForSelector('.writer-highlight-popover',{hidden:true});
 assert.equal((await marks()).find(m=>m.type==='highlight').attrs.color,'#bbf7d0');
 await page.$eval('.writer-content',el=>el.editor.chain().focus().toggleBold().setLink({href:'https://example.com'}).run());
 await palette('Remove highlight');assert.ok(!(await marks()).some(m=>m.type==='highlight'));assert.ok((await marks()).some(m=>m.type==='bold'));assert.ok((await marks()).some(m=>m.type==='link'));
 await palette('Yellow');await wait(550);await click('Undo');assert.ok(!(await marks()).some(m=>m.type==='highlight'));await click('Redo');assert.ok((await marks()).some(m=>m.type==='highlight'));
 await click('Clear formatting');assert.ok(!(await marks()).some(m=>['highlight','bold'].includes(m.type)));assert.ok((await marks()).some(m=>m.type==='link'));
 await palette('Blue');await saved();const blue=await content();const server=await api('/writer/'+doc.id);assert.deepEqual(server.content,blue);await page.reload({waitUntil:'domcontentloaded'});await ready();assert.deepEqual(await content(),blue);
 console.log('PASS highlight: selected range, selected-color UI, yellow/green/blue, remove-only-highlight, bold/link, undo/redo, clear formatting, Mongo/GET/reload.');
 // Real failed-save recovery path with the new mark.
 await page.setRequestInterception(true);page.on('request',r=>r.method()==='PATCH'?r.respond({status:503,contentType:'application/json',body:'{"message":"Test outage"}'}):r.continue());
 await select(1,22);await palette('Pink');await page.waitForFunction(()=>document.querySelector('.writer-save')?.textContent.includes('Unable to save'));assert.ok(JSON.stringify(await records()).includes('#fbcfe8'));
 await page.close();await open();await page.waitForFunction(()=>document.body.innerText.includes('Recover changes'));await click('Recover changes');await ready();await saved();assert.equal((await marks()).find(m=>m.type==='highlight').attrs.color,'#fbcfe8');
 // Google Docs background spans, default marks and unsupported alpha.
 await page.$eval('.writer-content',el=>{el.editor.commands.selectAll();el.editor.view.pasteHTML('<p><span style="background-color:rgb(255,255,0);font-family:Arial">Pasted yellow</span> <mark>Default</mark> <span style="background-color:transparent">Plain</span></p>');});await saved();
 const pasted=await content();assert.ok(JSON.stringify(pasted).includes('#fef08a') || JSON.stringify(pasted).includes('#fde047'));assert.ok(!JSON.stringify(pasted).includes('rgb('));
 console.log('PASS highlight: failed-save IndexedDB recovery and Google Docs-style background paste.');
 // Multi-page fixture with six simultaneous marks, including highlight.
 const mixed=structuredClone(fixture);mixed.content[0].content[0].marks=[{type:'highlight',attrs:{color:'#fef08a'}},{type:'bold'},{type:'italic'},{type:'underline'},{type:'link',attrs:{href:'https://example.com'}},{type:'textStyle',attrs:{fontSize:'24pt',fontFamily:'Writer Sans'}}];
 await page.$eval('.writer-content',(el,v)=>el.editor.commands.setContent(v),mixed);await saved();await wait(1000);
 let patches=0;page.on('request',r=>{if(r.method()==='PATCH')patches++;});
 const baseline=await content();const revision=(await api('/writer/'+doc.id)).revision;
 const layout=()=>page.$eval('.writer-content',el=>({count:el.querySelector('[data-rm-pagination]').children.length,width:el.offsetWidth,height:el.offsetHeight,nodes:[...el.children].filter(n=>!n.hasAttribute('data-rm-pagination')).map(n=>[n.offsetTop,n.offsetHeight,n.offsetWidth]),breaks:[...el.querySelectorAll('[data-page-break]')].map(n=>n.style.height)}));
 const initial=await layout();assert.ok(initial.count>=3,`Need 3+ pages: ${initial.count}`);
 const snapshots=[];
 for(const zoom of [50,75,100,125,150,200]){
  await page.select('select[aria-label="Document view zoom percentage"]',String(zoom));await wait(250);
  assert.deepEqual(await content(),baseline);assert.deepEqual(await layout(),initial,`Layout changed at ${zoom}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // Click a real text coordinate, test native caret and drag selection on the first paragraph.
  const points=await page.$eval('.writer-content',el=>{const v=el.editor.view;const a=v.coordsAtPos(3),b=v.coordsAtPos(10);return {a:{x:a.left,y:(a.top+a.bottom)/2},b:{x:b.left,y:(b.top+b.bottom)/2}};});
  await page.mouse.click(points.a.x,points.a.y);
  const pos=await page.$eval('.writer-content',el=>el.editor.state.selection.from);assert.ok(Math.abs(pos-3)<=1,`Caret ${pos} at ${zoom}`);
  await page.mouse.move(points.a.x,points.a.y);await page.mouse.down();await page.mouse.move(points.b.x,points.b.y,{steps:8});await page.mouse.up();
  const range=await page.$eval('.writer-content',el=>({from:el.editor.state.selection.from,to:el.editor.state.selection.to}));assert.ok(range.to-range.from>=5,`Selection failed at ${zoom}: ${JSON.stringify(range)}`);
  snapshots.push({zoom,pages:initial.count,caret:pos});
 }
 await wait(1200);assert.equal(patches,0,'Zoom/selection must not save');assert.equal((await api('/writer/'+doc.id)).revision,revision);assert.equal((await records()).length,0,'Zoom must not create recovery');
 const zoomOnlyPatches=patches;
 // Existing export toggles editability and flushes saves. Test it separately
 // from view-only changes so export's own saves aren't attributed to zoom.
 await page.evaluate(() => { const original=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{window.__writerExportBlob=blob;return original(blob);}; });
 for(const zoom of [50,100,200]) {
  await page.select('select[aria-label="Document view zoom percentage"]',String(zoom));
  await page.evaluate(()=>window.__writerExportBlob=null);
  const exported=page.waitForResponse(r=>r.url().endsWith('/export') && r.request().method()==='POST');await click('Export PDF');
  const response=await exported;assert.ok(response.ok());await page.waitForFunction(()=>window.__writerExportBlob instanceof Blob);const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__writerExportBlob.arrayBuffer())));assert.ok(bytes.length>1000);fs.writeFileSync(`/tmp/writer-zoom-${zoom}.pdf`,Buffer.from(bytes));await wait(1300);await saved();
  assert.deepEqual(await content(),baseline);
 }
 const pdfText=zoom=>execFileSync('pdftotext',['-layout',`/tmp/writer-zoom-${zoom}.pdf`,'-']).toString();assert.equal(pdfText(50),pdfText(100));assert.equal(pdfText(100),pdfText(200));
 // Typing and keyboard navigation must still work at high zoom. Compare the
 // post-edit geometry with the same document at 100%, then undo the edit.
 await page.$eval('.writer-content',el=>el.editor.commands.focus('end'));
 await page.keyboard.type(' Typed while zoomed.');await saved();await wait(250);
 const zoomedEdit=await layout();assert.ok(JSON.stringify(await content()).includes('Typed while zoomed.'));
 await page.select('select[aria-label="Document view zoom percentage"]','100');await wait(250);assert.deepEqual(await layout(),zoomedEdit);
 await click('Undo');await saved();assert.deepEqual(await content(),baseline);
 console.log('PASS zoom: '+JSON.stringify(snapshots)+'; stable geometry/JSON/revision, zero PATCH/recovery drafts, accurate caret/drag, equal exported text layout.');
 for(const width of [320,375,390,430]){await page.setViewport({width,height:850});await page.select('select[aria-label="Document view zoom percentage"]','200');await wait(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.$eval('.writer-toolbar',el=>el.scrollLeft=el.scrollWidth);await click('Highlight text');await page.waitForSelector('.writer-highlight-popover');assert.ok(await page.$eval('.writer-highlight-popover',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));await page.keyboard.press('Escape');await page.waitForSelector('.writer-highlight-popover',{hidden:true});}
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.$eval('.writer-toolbar',el=>el.scrollLeft=el.scrollWidth);await click('Highlight text');await page.waitForSelector('.writer-highlight-popover');await page.screenshot({path:'/tmp/writer-highlight-dark-mobile.png'});await page.keyboard.press('Escape');
 console.log('PASS mobile: 320/375/390/430 shell overflow and palette bounds; Escape; dark screenshot.');
 // Regression for tiptap-pagination-plus's viewport/document unit mismatch:
 // inserting a full document at 200% previously produced 5 pages instead of 4.
 await page.setViewport({width:1440,height:1000});
 let insertionLayout;
 for(const zoom of [100,200,50]) {
  await page.$eval('.writer-content',el=>el.editor.commands.setContent('<p>Blank</p>'));await wait(300);
  await page.select('select[aria-label="Document view zoom percentage"]',String(zoom));
  await page.$eval('.writer-content',(el,v)=>el.editor.commands.setContent(v),fixture);await wait(1200);
  const current=await layout();if(insertionLayout)assert.deepEqual(current,insertionLayout,`Insertion layout differs at ${zoom}`);else insertionLayout=current;
 }
 console.log('PASS: multi-page insertion has identical layout at 50/100/200.');
 fs.writeFileSync('/tmp/writer-highlight-zoom-results.json',JSON.stringify({snapshots,pages:initial.count,revision,patches:zoomOnlyPatches},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
