// CI browser evidence, separate from the cloud-browser/manual and physical-device QA.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=8798,base='http://127.0.0.1:'+port,server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'pipe'});
let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/')).ok)break;}catch{}if(i===79)throw Error('Server unavailable');await new Promise(r=>setTimeout(r,100));}
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.mp3'))requests.push(r.url());});
 await page.goto(base+'/');await page.locator('#home-role').waitFor({state:'attached'});
 await page.locator('.home-role-row .app-select-trigger').click();await page.getByRole('option',{name:'MOLLIE',exact:true}).click();
 await page.getByRole('button',{name:'台本を読む',exact:true}).click();await page.locator('.speech').first().waitFor();
 assert.equal(requests.length,0,'Startup downloads no MP3s');
 const row=page.locator('#line-act1-scene1-speech-0003');await row.press('Enter');
 await page.locator('[data-audio=toggle]').click();await page.waitForFunction(()=>document.querySelector('.audio-status')?.textContent==='再生中');
 await page.waitForFunction(()=>+document.querySelector('[data-audio=seek]')?.value>.1);
 await page.locator('[data-audio=toggle]').click();assert.equal(await page.locator('.audio-status').textContent(),'一時停止');
 await page.locator('.audio-options summary').click();await page.locator('#sheet .app-select-trigger').click();await page.getByRole('button',{name:'1.25×',exact:true}).click();
 assert.equal(await page.locator('[data-audio=rate]').inputValue(),'1.25');assert.match(await page.locator('#sheet-title').textContent(),/GILES/);
 await page.locator('[data-audio=continuous]').check();await page.locator('[data-audio=toggle]').click();
 await page.waitForFunction(()=>document.querySelector('.mini-label')?.textContent.includes('MOLLIE · 4'),{timeout:10000});
 await page.locator('#sheet .close-sheet').click();await page.locator('[data-mini=toggle]').click();
 await page.locator('[data-mini=stop]').click();
 await page.locator('[data-action=practice]').click();await page.locator('#range-from').fill('3');await page.locator('#range-to').fill('6');
 await page.locator('[data-mode=audio]').click();await page.waitForFunction(()=>document.querySelector('.practice-status')?.textContent.startsWith('あなたの番'),{timeout:10000});
 assert.equal(await page.locator('.practice-counter').textContent(),'2 / 4 · MOLLIE');
 assert.ok(!(await page.locator('.practice-text').textContent()).includes('Doing all'));
 const position=await page.locator('.reader-scroll').evaluate(n=>n.scrollTop);
 await page.locator('[data-action=analysis]').click();assert.equal(await page.locator('.analysis-quote').textContent(),'Doing all the work, you brute.');
 await page.locator('[data-vocab]').first().click();assert.equal(await page.locator('.dictionary-word').textContent(),'brute');
 await page.locator('#sheet .close-sheet').click();await page.locator('#sheet .close-sheet').click();
 assert.equal(await page.locator('.practice-counter').textContent(),'2 / 4 · MOLLIE');assert.equal(await page.locator('.reader-scroll').evaluate(n=>n.scrollTop),position);
 await page.locator('[data-action=model]').click();await page.waitForFunction(()=>document.querySelector('.practice-status')?.textContent==='再生中');
 await page.waitForFunction(()=>document.querySelector('.practice-status')?.textContent.startsWith('あなたの番'),{timeout:10000});assert.equal(await page.locator('.practice-counter').textContent(),'2 / 4 · MOLLIE');
 await page.locator('[data-action=reveal]').click();assert.match(await page.locator('.practice-text').textContent(),/Doing all/);
 await page.reload();await page.locator('[data-action=practice]').click();await page.locator('[data-resume=audio]').click();assert.equal(await page.locator('.practice-counter').textContent(),'2 / 4 · MOLLIE');
 await page.screenshot({path:'test-results/audio-rehearsal-mobile.png',animations:'disabled'});
 const layouts=[];
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,sheet:document.querySelector('#sheet').scrollWidth,client:document.querySelector('#sheet').clientWidth}));
  assert.ok(size.document<=width+1&&size.sheet<=size.client+1,JSON.stringify(size));layouts.push(size);
 }
 await page.screenshot({path:'test-results/audio-rehearsal-desktop.png',animations:'disabled'});
 await page.locator('#sheet .close-sheet').click();await page.locator('[data-mini=stop]').click();
 await page.locator('[data-action=practice]').click();await page.locator('[data-mode=cloze]').click();assert.equal(await page.locator('.practice-counter').textContent(),'1 / 4 · MOLLIE');
 await page.locator('[data-action=advance]').click();assert.ok(!(await page.locator('.practice-text').textContent()).includes('Doing all'));
 await page.locator('[data-action=reveal]').click();assert.match(await page.locator('.practice-text').textContent(),/Doing all/);await page.locator('[data-action=previous]').click();assert.equal(await page.locator('.practice-counter').textContent(),'1 / 4 · MOLLIE');
 assert.equal(errors.length,0,errors.join('\n'));
 const report={actualBundledMP3:true,initialMp3Requests:0,nestedReturn:true,ownStop:true,modelNoAdvance:true,resume:true,layouts,errors,limitations:['Physical Android/iOS devices','TalkBack/VoiceOver','Full listening audit of every clip']};
 await writeFile('test-results/audio-browser-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS: real MP3, play/pause/rate, canonical continuous order, role practice, model, cloze, nested sheets, reload and responsive layout');
}finally{if(browser)await browser.close();server.kill();}
