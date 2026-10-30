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
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false,'Role dropdown must not open a bottom sheet');
 assert.equal(await own.getAttribute('aria-haspopup'),'listbox');
 const choices=page.locator('.role-menu [role=option]');
 assert.ok(await choices.count()>1,'Role options open in an anchored listbox');
 const rect1=await own.boundingBox(),rect2=await page.locator('.role-menu').boundingBox();
 assert.ok(rect2&&rect1&&Math.abs(rect2.y-(rect1.y+rect1.height))<55,'Role menu is positioned beside the trigger');
 const second=await choices.nth(1).locator('.role-menu-name').textContent();
 await choices.nth(1).click();
 await page.waitForFunction(value=>document.querySelector('#home-role')?.value!==value,original);
 assert.equal(await page.locator('.role-menu').count(),0,'Selection immediately dismisses the dropdown');
 assert.ok((await own.textContent()).includes(second.trim()));
 await own.click();
 await page.locator('.role-menu [role=option]').first().press('Escape');
 assert.equal(await page.locator('.role-menu').count(),0,'Escape closes role menu');
 assert.equal(await own.getAttribute('aria-expanded'),'false');
 console.log('PASS: anchored role menu opens by button, persists role immediately and supports Escape');

 await page.locator('.global-settings').click();
 await page.locator('.settings-page').waitFor();
 assert.equal(await page.locator('.bottom-nav a[href="#settings"]').count(),0,'No bottom settings tab');
 assert.equal(await page.locator('.bottom-nav a.nav-item').count(),3,'Bottom bar has three destinations');
 assert.equal(await page.locator('.global-settings').getAttribute('aria-label'),'設定を閉じる');
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


 assert.equal(await page.locator('.settings-page').count(),1,'Minimal settings screen renders');
 assert.equal(await page.locator('.settings-page h2').count(),2,'Only two groups remain');
 assert.equal(await page.locator('.settings-page .setting-row').count(),4,'Only core controls remain');
 assert.equal(await page.locator('.settings-page .version,.settings-page #offline-note').count(),0,'Redundant status UI removed');
 const animationName=await page.locator('.settings-page').evaluate(el=>getComputedStyle(el).animationName);
 assert.ok(animationName.includes('page-enter'),'Settings has enter motion');
 const beforeStick=await page.locator('#show-stick').isChecked();
 if(beforeStick)await page.locator('#show-stick').uncheck();else await page.locator('#show-stick').check();
 assert.notEqual(await page.locator('#show-stick').isChecked(),beforeStick,'Custom switch toggles');
 const rate=page.locator('#playback-rate');
 assert.equal(await rate.isVisible(),false,'Playback rate uses hidden native select');
 const manage=page.locator('[data-action="manage-data"]');
 await manage.click();
 assert.equal(await page.locator('#sheet .management-action').count(),5,'Management options preserved');
 const managementRect=await page.locator('#sheet').boundingBox();
 assert.ok(managementRect&&managementRect.y>=0&&managementRect.y<page.viewportSize().height,'New sheet remains on screen after previous swipe animations');
 assert.equal(await page.locator('#sheet .management-note').count(),1);
 await page.locator('#sheet [data-action="import"]').click();
 assert.equal(await page.locator('#sheet #import-result').count(),1,'Import accessible through management');
 await page.locator('#sheet .close-sheet').click();
 console.log('PASS: minimal settings, persistent controls, animations and management operations');
 await page.locator('.bottom-nav a[href="#script"]').click();
 await page.locator('.speech').first().waitFor({timeout:25000});
 const readerRole=page.locator('.reader-role');
 await readerRole.click();
 assert.equal(await page.locator('.role-menu [role=option]').count()>1,true,'Reader role uses the same anchored dropdown');
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false,'Reader role does not use a bottom sheet');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.role-menu').count(),0);
 await page.screenshot({path:'test-results/reader-mobile.png'});
 assert.equal(await page.locator('.global-settings').count(),1,'Reader has a settings gear');
 const position=await page.locator('.global-settings').boundingBox();
 assert.ok(position && position.x>page.viewportSize().width-85 && position.y<65,'Gear stays in the top right corner');
 await page.locator('.global-settings').click();
 await page.locator('.settings-page').waitFor();
 assert.equal(await page.locator('.global-settings').getAttribute('aria-label'),'設定を閉じる');
 await page.locator('.global-settings').click();
 await page.locator('.script-body .speech').first().waitFor();
 assert.equal(new URL(page.url()).hash,'#script','Closing settings returns to script');
 console.log('PASS: reader settings gear opens and closes settings without losing route');
 const widths=await page.locator('.script-body .speech').first().evaluate(el=>({
  row:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width
 }));
 assert.ok(Math.abs(widths.row-widths.parent)<2,'Script rows remain full width');
 assert.ok(await page.locator('.word').count()>0,'Some tappable dictionary words rendered');
 const under=await page.locator('.word').first().evaluate(el=>getComputedStyle(el).textDecorationLine);
 assert.ok(under.includes('underline'),'Clickable vocabulary has underline');
 console.log('PASS: full-width reader and clickable dictionary affordance');

 // Regression: a per-line bookmark never opens analysis, survives reload and remains independent of review.
 const myRow=page.locator('.reader-scroll .speech.mine').first();
 await myRow.scrollIntoViewIfNeeded();
 const myId=await myRow.getAttribute('data-id');
 assert.equal(await myRow.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(238, 246, 255)','Own lines have a persistent pale-blue background');
 assert.equal(await page.locator('.speech-analysis').count(),0,'Ellipsis analysis buttons have been removed');
 const myBookmark=myRow.locator('.speech-bookmark');
 assert.equal(await myBookmark.getAttribute('aria-pressed'),'false');
 await myBookmark.click();
 assert.equal(await myBookmark.getAttribute('aria-pressed'),'true','Bookmark toggles directly');
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false,'Bookmark action must not open analysis');
 await page.reload({waitUntil:'domcontentloaded'});
 const restored=page.locator('.reader-scroll .speech[data-id="'+myId+'"]');
 await restored.waitFor({timeout:25000});
 assert.equal(await restored.locator('.speech-bookmark').getAttribute('aria-pressed'),'true','Bookmark survives a reload');
 // The empty space of the script row is the analysis trigger; words remain dictionary triggers.
 await restored.locator('.speech-inner').click({position:{x:6,y:6}});
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true,'Row background opens analysis');
 const headings=await page.locator('#sheet .sheet-body h3').allTextContents();
 const translation=headings.indexOf('日本語訳'),context=headings.indexOf('会話の流れ・文脈');
 const acting=headings.indexOf('演技のポイント'),grammar=headings.indexOf('文法・構文');
 assert.ok(translation>=0&&context>translation&&acting>context&&grammar>acting,'Translation, context and acting precede grammar');
 assert.ok(await page.locator('#sheet .analysis-neighbor').count()>=1,'Supplied neighboring translations are shown as context');
 assert.equal(await page.locator('#sheet .analysis-context .subtle').first().textContent(),'前後の発話を、提供済みの日本語訳から表示しています。');

 await page.locator('#sheet .close-sheet').click();
 const word=restored.locator('.word').first();
 if(await word.count()){await word.click();assert.equal(await page.locator('#sheet .sheet-body .dictionary-word').count(),1,'Word tap opens dictionary instead of analysis');await page.locator('#sheet .close-sheet').click();}
 await page.evaluate(()=>{const select=document.querySelector('#review-filter');select.value='bookmarked';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>document.querySelectorAll('.reader-scroll .speech').length===1);
 assert.equal(await page.locator('.reader-scroll .speech').first().getAttribute('data-id'),myId,'Bookmark filter selects saved line');
 await page.locator('.reader-scroll .speech-bookmark').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('.reader-scroll .speech').length===0);
 assert.equal(await page.locator('.reader-scroll .empty').count(),1,'Removing a bookmark immediately updates bookmark-only view');
 await page.evaluate(()=>{const select=document.querySelector('#review-filter');select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('.reader-scroll .speech').first().waitFor();
 const keyboardLine=page.locator('.reader-scroll .speech').first();
 await keyboardLine.focus();
 await keyboardLine.press('Enter');
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true,'Keyboard users can open analysis without an ellipsis');
 await page.locator('#sheet .close-sheet').click();
 console.log('PASS: pale-blue owned lines, independent saved bookmarks, background analysis, prioritized context and dictionary');


 const desktop=await browser.newPage({viewport:{width:1280,height:800},locale:'ja-JP'});
 await desktop.goto(base+'/',{waitUntil:'domcontentloaded'});
 await desktop.locator('.home-role-row .app-select-trigger').waitFor({timeout:25000});
 await desktop.locator('.nav-items a[href="#script"]').click();
 const desktopRole=desktop.locator('.reader-role');
 await desktopRole.click();
 assert.ok(await desktop.locator('.role-menu [role=option]').count()>1,'Desktop reader role uses anchored menu');
 assert.equal(await desktop.locator('#sheet').evaluate(el=>el.open),false);
 await desktop.keyboard.press('Escape');
 assert.equal(await desktop.locator('.role-menu').count(),0);
 await desktop.locator('.nav-items a[href="#home"]').click();
 await desktop.screenshot({path:'test-results/home-desktop.png'});
 console.log('PASS: desktop layout booted');
}finally{
 if(browser)await browser.close();
 server.kill();
}
