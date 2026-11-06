import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,devices} from 'playwright';

const port=8798,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
let browser;
try {
 let ready=false;
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)throw Error('HTTP server terminated');
  try{if((await fetch(base+'/index.html')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(ready,'serve production build');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({...devices['Pixel 7'],locale:'ja-JP'});
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto(base+'/#rehearse',{waitUntil:'domcontentloaded'});
 await page.locator('.practice-part').first().waitFor({timeout:30000});
 assert.equal(await page.locator('[data-practice-id]').count(),40);
 assert.equal(await page.locator('.practice-group').count(),3);
 assert.equal(await page.locator('.practice-part.has-role').count()>0,true,'role highlights actual speaking scenes');
 await page.locator('[data-practice-id="S03"]').click();
 assert.equal(await page.locator('#range-scene').inputValue(),'act1-scene1');
 assert.equal(await page.locator('#range-from').inputValue(),'45');
 assert.equal(await page.locator('#range-to').inputValue(),'74');
 assert.equal(await page.locator('[data-practice-id="S03"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-mode="cloze"]').click();
 await page.locator('.rehearsal-free .speech').first().waitFor();
 assert.equal(await page.locator('.rehearsal-free .speech').count(),30,'cloze selects exact 30 speeches');
 assert.match(await page.locator('.reader-heading').innerText(),/S03/);
 await page.locator('[data-action="exit"]').click();
 await page.locator('.practice-part').first().waitFor();
 const lastGroup=page.locator('.practice-group').nth(2);
 await lastGroup.locator('summary').click();
 await page.locator('[data-practice-id="S40"]').click();
 assert.equal(await page.locator('#range-scene').inputValue(),'act2');
 assert.equal(await page.locator('#range-from').inputValue(),'594');
 assert.equal(await page.locator('#range-to').inputValue(),'638');
 await page.locator('[data-mode="audio"]').click();
 await page.locator('.audio-stage').waitFor();
 assert.match(await page.locator('.reader-heading').innerText(),/S40/);
 assert.match(await page.locator('#session-counter').innerText(),/1\s*\/\s*45/);
 await page.locator('[data-action="exit"]').click();
 await page.locator('.practice-part').first().waitFor();
 const select=page.locator('#rehearsal-role');
 await select.evaluate(element=>{
  element.value='VOICE ON THE RADIO';
  element.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('.practice-picker').waitFor();
 const noLines=page.locator('[data-practice-id="S40"]');
 assert.equal(await noLines.getAttribute('class').then(v=>v.includes('has-role')),false,
  'no speaking lines are not falsely highlighted after a role change');
 // The no-lines part remains selectable (context/rehearsal of other cast members).
 await page.locator('.practice-group').nth(2).locator('summary').click();
 await noLines.click();
 assert.equal(await noLines.getAttribute('aria-pressed'),'true');
 assert.deepEqual(pageErrors,[],'no browser exceptions');
 console.log('Practice scene browser QA passed: 40 parts, range, cloze, audio, role highlight and zero-line selection');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
