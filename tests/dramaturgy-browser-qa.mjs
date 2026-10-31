// CI-only browser harness; unit tests do not certify the rendered analysis sheet.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,devices} from 'playwright';
const port=8797,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'pipe'});
let browser;
try{
 for(let i=0;i<80;i++){
  try{if((await fetch(base+'/')).ok)break;}catch{}
  if(i===79)throw Error('Preview server did not start');
  await new Promise(r=>setTimeout(r,100));
 }
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({...devices['Pixel 7'],locale:'ja-JP'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#script');
 await page.locator('.speech').first().waitFor();
 await page.locator('.speech .speaker').first().click();
 await page.locator('#sheet .analysis-explanation').waitFor();

 const coverage=await page.evaluate(async()=>{
  const storage=await import('./modules/storage.js'),{loadDramaturgy}=await import('./modules/dramaturgy.js'),{showAnalysis}=await import('./modules/reader.js');
  const source=await storage.get('script:mousetrap-private');
  const {data,warning}=await loadDramaturgy(storage,async url=>(await fetch(url)).json(),source);
  if(warning)throw Error(warning);
  const ctx={data,progress:{},small:{notes:{}},save(){},setProgress(){}};
  let references=0;
  for(const line of data.lines){
   showAnalysis(line,ctx);
   const sheet=document.querySelector('#sheet'),entry=data.dramaturgy[line.id];
   const check=(yes,kind)=>{if(!yes)throw Error(line.id+': '+kind);};
   check(sheet.open,'sheet closed');
   check(sheet.querySelector('.analysis-context').dataset.analysisId===line.id,'wrong full ID');
   check(sheet.querySelector('.analysis-quote').textContent===line.text,'wrong original');
   const t=data.translations[line.id];
   check(sheet.querySelector('.eyebrow').nextElementSibling.textContent===(typeof t==='string'?t:t.translation),'wrong translation');
   check(sheet.querySelector('.analysis-explanation').textContent===entry.explanation,'wrong explanation');
   check(!!sheet.querySelector('.analysis-spoiler')===!!entry.spoiler,'conditional spoiler');
   check(!!sheet.querySelector('.analysis-supplement')===!!(entry.premise||entry.cause||entry.emotion||entry.intention||entry.subtext||entry.devices),'conditional supplement');
   check(!sheet.querySelector('.analysis-neighbor'),'mechanical context');
   const actualRefs=[...sheet.querySelectorAll('[data-related-id]')].map(el=>el.dataset.relatedId);
   check(JSON.stringify(actualRefs)===JSON.stringify(entry.relatedLineIds||[]),'wrong references');
   for(const id of actualRefs){
    const related=data.lines.find(l=>l.id===id),button=sheet.querySelector('[data-related-id="'+id+'"]');
    check(button.textContent.includes(String(related.ordinal))&&button.textContent.includes(related.speaker),'wrong reference label');
   }
   references+=actualRefs.length;
   check(sheet.querySelectorAll('.grammar-item').length===(data.grammar[line.id]||[]).length,'lost grammar');
   check(sheet.querySelectorAll('[data-vocab]').length===(data.vocabulary[line.id]||[]).length,'lost vocabulary');
  }
  showAnalysis(data.lines[0],ctx);
  return {rendered:data.lines.length,references};
 });
 assert.deepEqual(coverage,{rendered:1164,references:526});
 console.log('PASS: all 1164 actual analysis sheets, translations, grammar, vocabulary and 526 reference labels');

 await page.locator('#sheet .analysis-related summary').click();
 await page.locator('#sheet [data-related-id="act2-speech-0587"]').press('Enter');
 assert.equal(await page.locator('#sheet .analysis-context').getAttribute('data-analysis-id'),'act2-speech-0587');
 assert.match(await page.locator('#sheet .analysis-explanation').textContent(),/ジミーの兄/);
 await page.locator('#sheet [data-action=return-origin]').click();
 assert.equal(await page.locator('#sheet .analysis-context').getAttribute('data-analysis-id'),'act1-scene1-speech-0001');
 await page.keyboard.press('Escape');
 // Resume interaction through the actual app context, not the coverage-loop fixture.
 const row=page.locator('#line-act1-scene1-speech-0002');
 await row.scrollIntoViewIfNeeded();await row.locator('.speaker').click();
 await page.locator('#sheet [data-action=level-analysis]').click();
 await page.locator('#sheet [data-action=review-analysis]').click();
 await page.locator('#sheet .analysis-personal summary').click();
 await page.locator('#context-note').fill('検査用の解釈メモ');
 await page.locator('#acting-note').fill('検査用の演技メモ');
 await page.keyboard.press('Escape');
 await row.locator('.speech-bookmark').click();
 await page.reload();await row.waitFor();
 assert.equal(await row.locator('.speech-bookmark').getAttribute('aria-pressed'),'true');
 await row.locator('.speaker').click();
 assert.equal(await page.locator('#sheet [data-action=level-analysis]').textContent(),'練習中');
 assert.equal(await page.locator('#sheet [data-action=review-analysis]').textContent(),'要復習を解除');
 await page.locator('#sheet .analysis-personal summary').click();
 assert.equal(await page.locator('#context-note').inputValue(),'検査用の解釈メモ');
 assert.equal(await page.locator('#acting-note').inputValue(),'検査用の演技メモ');
 await page.locator('#sheet .analysis-personal summary').click();
 await page.locator('#sheet .expand-sheet').click();
 await page.evaluate(()=>{document.querySelector('#sheet .sheet-body').scrollTop=0;});
 await page.screenshot({path:'test-results/dramaturgy-mobile.png',animations:'disabled'});
 await page.keyboard.press('Escape');
 // Word dictionary, return to analysis, and role changes still use the live UI.
 await page.locator('#line-act1-scene1-speech-0001 .word').first().click();
 assert.equal(await page.locator('#sheet .dictionary-word').count(),1);
 await page.locator('#sheet [data-action=analyze-word]').click();
 assert.equal(await page.locator('#sheet .analysis-context').getAttribute('data-analysis-id'),'act1-scene1-speech-0001');
 await page.keyboard.press('Escape');
 await page.locator('.reader-role').click();await page.locator('.role-menu [role=option]').filter({hasText:/^MOLLIE/}).click();
 assert.match(await page.locator('.reader-role').textContent(),/MOLLIE/);
 await page.reload();await page.locator('.reader-role').waitFor();assert.match(await page.locator('.reader-role').textContent(),/MOLLIE/);
 console.log('PASS: related navigation, saved notes, mastery, review, bookmarks, dictionary and persisted role');

 // Browser-level network loss, including loading the sidecar from the service-worker cache.
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const cached=await page.evaluate(async()=>!!await caches.match(new URL('./data/mousetrap-dramaturgy.ja.json',location.href).href));
 assert.equal(cached,true);
 await page.evaluate(async()=>{const storage=await import('./modules/storage.js');await storage.put('dramaturgy:mousetrap-private',null);});
 await context.setOffline(true);await page.reload();await row.waitFor();await row.locator('.speaker').click();
 assert.equal(await page.locator('#sheet .analysis-context').getAttribute('data-analysis-id'),'act1-scene1-speech-0002');
 assert.equal(await page.locator('#sheet [data-action=level-analysis]').textContent(),'練習中');
 await page.keyboard.press('Escape');await context.setOffline(false);
 console.log('PASS: real browser offline reload restores sidecar from SW without resetting learning');

 // Narrow, tablet, desktop and 200% text stress in a fresh browser page.
 const desktop=await browser.newPage({viewport:{width:1280,height:900},locale:'ja-JP'});
 desktop.on('pageerror',e=>errors.push(e.message));
 await desktop.goto(base+'/#script');await desktop.locator('.speech').first().waitFor();
 const layout=[];
 for(const width of [320,390,768,1280]){
  await desktop.setViewportSize({width,height:900});
  const first=desktop.locator('.speech').first();await first.press('Enter');
  await desktop.locator('#sheet .expand-sheet').click();
  const sizes=await desktop.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth,sheet:document.querySelector('#sheet').scrollWidth,client:document.querySelector('#sheet').clientWidth}));
  assert.ok(sizes.document<=sizes.viewport+1&&sizes.sheet<=sizes.client+1,JSON.stringify({width,...sizes}));
  layout.push({width,...sizes});
  if(width===1280)await desktop.screenshot({path:'test-results/dramaturgy-desktop.png',animations:'disabled'});
  await desktop.keyboard.press('Escape');
 }
 await desktop.addStyleTag({content:'.sheet-body p,.sheet-body h3,.sheet-body summary,.sheet-body .scene-link{font-size:200%!important}'});
 await desktop.locator('.speech').first().press('Enter');
 const zoom=await desktop.locator('#sheet').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(zoom.scroll<=zoom.client+1);
 assert.equal(errors.length,0,errors.join('\n'));
 const report={coverage,layout,textScale:'200% sheet text stress',offline:true,errors,limitations:['Android physical devices','OS text scaling','TalkBack/VoiceOver']};
 await writeFile('test-results/dramaturgy-browser-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS: 320/390/768/1280px layout, 200% sheet text stress, no page exceptions');
}finally{
 if(browser)await browser.close();server.kill();
}
