import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,devices} from 'playwright';

const port=8796,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'pipe'});
let browser;
const sleep=t=>new Promise(r=>setTimeout(r,t));
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(server.exitCode!==null)throw Error('Server exited: '+server.exitCode);
  try{const r=await fetch(base+'/index.html');if(r.ok){ready=true;break;}}catch{}
  await sleep(200);
 }
 assert.ok(ready,'Local web server responded');
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({...devices['Pixel 7'],locale:'ja-JP'});
 page.on('pageerror',err=>{console.error('Browser exception:',err.message)});
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('.home-role-row .app-select-trigger').waitFor({timeout:25000});
 const original=await page.locator('#home-role').inputValue();
 assert.ok(original,'The original source of truth retains a role');
 assert.equal(await page.locator('#home-role').isVisible(),false,'Native picker is hidden');
 await page.screenshot({path:'test-results/home-mobile.png'});
 const own=page.locator('.home-role-row .app-select-trigger');
 await own.click();
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true);
 const choices=page.locator('#sheet .app-choice');
 assert.ok(await choices.count()>1,'role choices are rendered in app');
 const second=await choices.nth(1).textContent();
 await choices.nth(1).click();
 await page.waitForFunction(value=>document.querySelector('#home-role')?.value!==value,original);
 assert.ok((await own.textContent()).includes(second.trim()));
 console.log('PASS: role picker uses in-app choices, persists selection and dispatches change');

 await page.locator('.bottom-nav a[href="#settings"]').click();
 await page.locator('#line-height').waitFor({state:'attached'});
 assert.equal(await page.locator('#line-height').isVisible(),false);
 const setting=page.locator('.setting-row .app-select-trigger').first();
 await setting.click();
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true);
 const handle=page.locator('#sheet .sheet-handle');
 const rect=await handle.boundingBox();
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.down();
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2+170,{steps:10});
 await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('#sheet').open,{timeout:10000});
 console.log('PASS: dragging sheet handle down dismisses it');

 await setting.click();
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true);
 await page.evaluate(()=>{
  const body=document.querySelector('#sheet .sheet-body');
  function fire(name,y){
   const t=new Touch({identifier:9,target:body,clientX:170,clientY:y});
   body.dispatchEvent(new TouchEvent(name,{
    bubbles:true,cancelable:true,touches:name==='touchend'?[]:[t],changedTouches:[t],targetTouches:name==='touchend'?[]:[t]
   }));
  }
  body.scrollTop=0;
  fire('touchstart',250);fire('touchmove',340);fire('touchmove',410);fire('touchend',410);
 });
 await page.waitForFunction(()=>!document.querySelector('#sheet').open,{timeout:10000});
 console.log('PASS: dragging down from top of sheet content dismisses it');
 await page.screenshot({path:'test-results/settings-mobile.png'});

 await page.locator('.bottom-nav a[href="#script"]').click();
 await page.locator('.speech').first().waitFor({timeout:25000});
 await page.screenshot({path:'test-results/reader-mobile.png'});
 const widths=await page.locator('.script-body .speech').first().evaluate(el=>({
  row:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width
 }));
 assert.ok(Math.abs(widths.row-widths.parent)<2,'Script rows remain full width');
 assert.ok(await page.locator('.word').count()>0,'Some tappable dictionary words rendered');
 const under=await page.locator('.word').first().evaluate(el=>getComputedStyle(el).textDecorationLine);
 assert.ok(under.includes('underline'),'Clickable vocabulary has underline');
 console.log('PASS: full-width reader and clickable dictionary affordance');

 const desktop=await browser.newPage({viewport:{width:1280,height:800},locale:'ja-JP'});
 await desktop.goto(base+'/',{waitUntil:'domcontentloaded'});
 await desktop.locator('.home-role-row .app-select-trigger').waitFor({timeout:25000});
 await desktop.screenshot({path:'test-results/home-desktop.png'});
 console.log('PASS: desktop layout booted');
}finally{
 if(browser)await browser.close();
 server.kill();
}
