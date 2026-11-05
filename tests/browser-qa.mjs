import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,devices} from 'playwright';

const port=8796,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
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

 // Quick-memory smoke test: live role, contextual script, completion, history, and startup refresh.
 const quickHome=page.locator('.quick-memory-home');
 assert.equal(await quickHome.count(),1,'one compact prompt exists below the progress graph');
 assert.ok(await quickHome.evaluate(el=>el.previousElementSibling?.classList.contains('home-progress-dashboard')),'prompt follows the ring graph');
 const firstPrompt=await page.locator('.quick-memory-home-text').textContent();
 assert.ok(firstPrompt?.length,'the selected role has a quick-memory prompt');
 const firstId=await page.evaluate(role=>{
  const state=JSON.parse(localStorage.getItem('mt-state:mousetrap-private'));
  return state.quickMemorize.currentByRole[role];
 },original);
 await page.locator('.quick-memory-home-link').click();
 await page.locator('.quick-memory-speech.is-target').waitFor({timeout:10000});
 assert.equal(new URL(page.url()).hash,'#quick','the prompt opens its dedicated route');
 assert.equal((await page.locator('.quick-memory-speech.is-target .quick-memory-speaker').textContent()).trim(),original,'only the selected actor is prompted');
 assert.ok(await page.locator('.quick-memory-speech:not(.is-target)').count()>=1,'surrounding dialogue remains available');
 assert.equal(await page.locator('#quick-context-title').textContent(),'状況・コンテクスト','dedicated situation section is visible');
 assert.ok((await page.locator('.quick-memory-context-situation').textContent()).trim().length>5,'the current line has new situation data');
 const at=await page.locator('.quick-memory-speech').all();
 assert.ok(at.length>=1&&at.length<=3,'initial view renders no more than one line before and after');
 const targetAt=await page.locator('.quick-memory-speech.is-target').evaluate(el=>[...el.parentElement.querySelectorAll('.quick-memory-speech')].indexOf(el));
 assert.ok(targetAt<=1,'no more than one previous line is shown');
 assert.ok(at.length-targetAt-1<=1,'no more than one following line is shown');
 const extra=page.locator('.quick-memory-more').first();
 if(await extra.count()){
  await extra.click();
  assert.equal(await page.locator('.quick-memory-speech').count(),at.length+1,'extra dialogue is visible only on request');
 }

 // A native modal is above the underlying page: completion must be INSIDE it.
 await page.locator('.quick-memory-speech.is-target').click();
 const quickSheetButton=page.locator('#sheet .quick-memory-sheet-complete');
 await quickSheetButton.waitFor({state:'visible',timeout:10000});
 assert.equal(await quickSheetButton.textContent().then(t=>t.trim()),'完了');
 assert.equal(await page.locator('#sheet .quick-memory-sheet-footer').count(),1,'exactly one completion footer inside the modal');
 // The existing sheet entrance animates from translateY(26px). Check the settled layout.
 await page.locator('#sheet').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 const compactBounds=await page.evaluate(()=>{
  const sheet=document.querySelector('#sheet'),button=sheet.querySelector('.quick-memory-sheet-complete'),body=sheet.querySelector('.sheet-body');
  return {bottom:button.getBoundingClientRect().bottom,viewHeight:innerHeight,bodyBottom:body.getBoundingClientRect().bottom,buttonTop:button.getBoundingClientRect().top};
 });
 assert.ok(compactBounds.bottom<=compactBounds.viewHeight+2,'sheet completion is onscreen in compact mode');
 assert.ok(compactBounds.buttonTop>=compactBounds.bodyBottom-2,'action does not overlap explanation scrolling area');
 await page.locator('#sheet .expand-sheet').click();
 assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('expanded')),true);
 assert.equal(await quickSheetButton.isVisible(),true,'completion persists in expanded sheet');
 const expandedBounds=await page.evaluate(()=>{
  const sheet=document.querySelector('#sheet'),button=sheet.querySelector('.quick-memory-sheet-complete'),body=sheet.querySelector('.sheet-body');
  return {bottom:button.getBoundingClientRect().bottom,viewHeight:innerHeight,bodyBottom:body.getBoundingClientRect().bottom,buttonTop:button.getBoundingClientRect().top};
 });
 assert.ok(expandedBounds.bottom<=expandedBounds.viewHeight+2,'expanded-sheet completion stays onscreen');
 assert.ok(expandedBounds.buttonTop>=expandedBounds.bodyBottom-2,'expanded sheet does not cover completion');
 await page.locator('#sheet .close-sheet').click();
 await page.waitForFunction(()=>!document.querySelector('#sheet').open,{timeout:10000});
 assert.equal(await page.locator('.quick-memory-complete').isVisible(),true,'normal completion action returns after dismissing the sheet');

 await page.screenshot({path:'test-results/quick-memory-mobile.png'});
 await page.locator('.quick-memory-complete').click();
 await page.locator('.quick-memory-home').waitFor({timeout:10000});
 const result=await page.evaluate(({role,id})=>{
  const state=JSON.parse(localStorage.getItem('mt-state:mousetrap-private'));
  return {next:state.quickMemorize.currentByRole[role],count:state.quickMemorize.counts[id]?.count};
 },{role:original,id:firstId});
 assert.equal(result.count,1,'a completed dialogue is recorded once');
 assert.notEqual(result.next,firstId,'completion immediately prepares a new dialogue');
 const beforeReload=result.next;
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.quick-memory-home-text').waitFor({timeout:25000});
 const reopened=await page.evaluate(role=>JSON.parse(localStorage.getItem('mt-state:mousetrap-private')).quickMemorize.currentByRole[role],original);
 assert.notEqual(reopened,beforeReload,'a fresh app launch draws a different dialogue when alternatives exist');
 // Completing from the modal must run the exact same once-only persistence path.
 await page.locator('.quick-memory-home-link').click();
 await page.locator('.quick-memory-speech.is-target').waitFor({timeout:10000});
 await page.locator('.quick-memory-speech.is-target').click();
 await page.locator('#sheet .quick-memory-sheet-complete').click();
 await page.locator('.quick-memory-home').waitFor({timeout:10000});
 const sheetCompletionCount=await page.evaluate(id=>{
  const state=JSON.parse(localStorage.getItem('mt-state:mousetrap-private'));
  return state.quickMemorize.counts[id]?.count;
 },reopened);
 assert.equal(sheetCompletionCount,1,'modal-sheet completion records exactly once');

 console.log('PASS: quick memory role filter, context, completion, history, and launch refresh');



 const headerAction=page.locator('[data-action="home-app-action"]');
 assert.equal(await headerAction.isVisible(),true,'home shows prominent install pill before standalone launch');
 assert.equal(await headerAction.getAttribute('aria-label'),'アプリをインストール');
 assert.equal(await page.locator('.home-progress-dashboard').count(),1,'double ring is visible at the top of home');
 assert.equal(await page.locator('.home-double-ring .home-festival-ring').count(),1,'thin navy countdown ring is present');
 assert.equal(await page.locator('.home-festival-prefix').textContent(),'残り','countdown shows remaining label');
 assert.match(await page.locator('.home-festival-days').textContent(),/^\d+日$/,'countdown shows value with 日 suffix');
 assert.equal(await page.locator('.home-install-callout,.home-offline-card').count(),0,'old metadata cards are absent');
 await page.evaluate(()=>{
  localStorage.removeItem('mt-pwa-audio-offer-v1');
  window.dispatchEvent(new Event('appinstalled'));
 });
 await page.waitForFunction(()=>{
  const action=document.querySelector('[data-action="home-app-action"]');
  return action&&action.getAttribute('aria-label')==='オフライン音声を保存'&&!action.hidden;
 },null,{timeout:15000});
 assert.equal(await page.locator('[data-action="audio-later"]').count(),0,'installation no longer interrupts with an automatic audio prompt');
 assert.equal(await headerAction.isVisible(),true,'audio save button replaces install after installation event');


 assert.equal(await page.locator('[data-action="open-notifications"]').count(),0,'website never renders notification button');
 assert.equal(await page.locator('.notification-badge').count(),0,'website does not show unread badge');
 const installedPage=await browser.newPage({...devices['Pixel 7'],locale:'ja-JP'});
 // Simulate a genuine standalone PWA launch, not only an appinstalled event
 // dispatched in a browser tab. The latter must never unlock the inbox.
 await installedPage.addInitScript(()=>{
  const media=window.matchMedia.bind(window);
  window.matchMedia=(query)=>query==='(display-mode: standalone)'
   ? {matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}}
   : media(query);
 });
 await installedPage.addInitScript(()=>{localStorage.setItem('mt-daily-received-v1',JSON.stringify([{date:'2026-11-03',type:'trivia',category:'英語トリビア',title:'台本ジャンプのテスト',body:'通知の引用から該当発話へ移動します。',lineId:'act1-scene1-speech-0040',quoteAnchor:'seven guineas'}]));});
 await installedPage.goto(base+'/',{waitUntil:'domcontentloaded'});
 await installedPage.locator('.home-role-row .app-select-trigger').waitFor({timeout:25000});
 const bell=installedPage.locator('[data-action="open-notifications"]');
 assert.equal(await bell.isVisible(),true,'standalone PWA has the notification bell');
 await installedPage.locator('.notification-badge').waitFor({state:'visible',timeout:20000});
 await bell.click();
 assert.equal(await installedPage.locator('#sheet #sheet-title').textContent(),'お知らせ');
 const inboxText=(await installedPage.locator('#sheet .notification-entry').allTextContents()).join(' ');
 assert.ok(inboxText.includes('Mousetrap Trainerへようこそ'));
 assert.ok(inboxText.includes('オフライン'));
 assert.equal(await installedPage.locator('.notification-badge').isVisible(),false,'opening inbox immediately clears unread badge');
 assert.equal(await installedPage.locator('#sheet [data-notification-read],#sheet [data-action="all-read"]').count(),0,'no mark-read buttons remain');
 const highlighted=await installedPage.locator('#sheet .notification-entry.is-new').count();
 assert.ok(highlighted>0,'unread at open remains highlighted in the open inbox');
 assert.equal(await installedPage.locator('#sheet .notification-new-label').count(),highlighted,'highlighted items show unread label');
 assert.equal(await installedPage.evaluate(()=>JSON.parse(localStorage.getItem('mt-notifications-read-v1')||'[]').includes('welcome-install-v1')),true,'opening persists read status');
 await installedPage.locator('#sheet .close-sheet').click();
 await bell.click();
 assert.equal(await installedPage.locator('.notification-badge').isVisible(),false,'read state persists after reopening');
 assert.equal(await installedPage.locator('#sheet .notification-entry.is-new').count(),0,'highlight disappears after reopening');
 assert.equal(await installedPage.locator('#sheet .notification-entry.is-read').count(),await installedPage.locator('#sheet .notification-entry').count(),'all entries render normally on reopening');
 const linkedQuote=installedPage.locator('#sheet [data-notification-line="act1-scene1-speech-0040"]');
 assert.ok(await linkedQuote.count()>0,'daily notification shows the linked script quote');
 assert.ok((await linkedQuote.innerText()).includes('seven guineas'),'notification shows sentence containing anchor');
 assert.ok((await installedPage.locator('#sheet .notification-entry-heading').allTextContents()).some(text=>text.includes('聖光祭まであと175日！')),'editorial headline shows correct remaining days');
 await linkedQuote.click();
 assert.equal(new URL(installedPage.url()).hash,'#script','quote opens script route');
 await installedPage.locator('#line-act1-scene1-speech-0040').waitFor({state:'visible',timeout:10000});
 await installedPage.close();
 console.log('PASS: browser inbox read state and quote-to-exact-speech navigation');

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
 await page.locator('.role-menu').waitFor({state:'detached',timeout:3000});
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
 assert.equal(await page.locator('#sheet .management-action').count(),4,'Management options preserved without manual update');
 assert.equal(await page.locator('#sheet [data-action="update"]').count(),0,'Updates are automatic; no redundant settings control');
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
 await page.locator('.role-menu').waitFor({state:'detached',timeout:3000});
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
 assert.equal(await page.locator('#sheet .sheet-heading [data-action="analysis-audio"]').count(),1,'Script detail has upper-right speech audio');
 assert.equal(await page.locator('#sheet .sheet-heading [data-action="analysis-audio"]').getAttribute('aria-label'),'セリフの音声を再生');
 const detailAudio=page.locator('#sheet .sheet-heading [data-action="analysis-audio"]');
 await detailAudio.click();
 await page.locator('#sheet .sheet-heading [data-action="analysis-audio"][data-audio-state="playing"]').waitFor({timeout:12000});
 await detailAudio.click();
 assert.equal(await detailAudio.getAttribute('data-audio-state'),'idle','detail audio stops on second click');
 const headings=await page.locator('#sheet .sheet-body h3').allTextContents();
 const translation=headings.indexOf('日本語訳'),explanation=headings.indexOf('そのセリフの解説'),grammar=headings.indexOf('文法・構文');
 assert.ok(translation>=0&&explanation>translation,'Translation precedes audited explanation');
 if(grammar>=0)assert.ok(grammar>explanation,'Present grammar follows audited explanation');
 assert.equal(await page.locator('#sheet .analysis-neighbor').count(),0,'Audited explanation replaces mechanical neighbor repetition');
 assert.ok(await page.locator('#sheet .analysis-explanation').textContent());

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


 // A manual utterance play action is available only after the chosen role's answer is revealed.
 await page.locator('.bottom-nav a[href="#rehearse"]').click();
 await page.locator('#rehearsal-role').waitFor({state:'attached'});
 const firstOwn=await page.evaluate(async()=>{
  const {normalizeBundle}=await import('./modules/data.js');
  const d=normalizeBundle(await (await fetch('./data/mousetrap.json')).json());
  const role=document.querySelector('#rehearsal-role').value;
  return d.lines.findIndex(line=>line.speaker===role)+1;
 });
 assert.ok(firstOwn>0,'selected role has utterances in the script');
 await page.locator('#range-from').fill(String(firstOwn));
 await page.locator('#range-to').fill(String(firstOwn));
 await page.locator('[data-mode="cloze"]').click();
 const answerAudio=page.locator('[data-action="answer-audio"]');
 assert.equal(await answerAudio.isVisible(),false,'audio button must not reveal a hidden answer');
 await page.locator('.session-controls [data-action="advance"]').click();
 assert.equal(await answerAudio.isVisible(),true,'reveal exposes line-specific playback in cloze rehearsal');
 assert.equal(await answerAudio.getAttribute('aria-label'),'セリフの音声を再生');
 await answerAudio.click();
 await page.locator('[data-action="answer-audio"][data-audio-state="playing"]').waitFor({timeout:12000});
 await answerAudio.click();
 assert.equal(await answerAudio.getAttribute('data-audio-state'),'idle','rehearsal audio stops on second click');
 await page.locator('.session-controls [data-action="advance"]').click();
 assert.equal(await answerAudio.isVisible(),false,'rehearsal completion hides speech playback');
 await page.locator('[data-action="choose"]').click();
 await page.locator('[data-mode="audio"]').click();
 assert.equal(await page.locator('[data-action="answer-audio"]').isVisible(),false);
 await page.locator('.session-controls [data-action="advance"]').click();
 assert.equal(await page.locator('[data-action="answer-audio"]').isVisible(),true,'audio rehearsal answer exposes replay');
 console.log('PASS: analysis sheet and both revealed rehearsal modes have accessible per-line audio buttons');

 const desktop=await browser.newPage({viewport:{width:1280,height:800},locale:'ja-JP'});
 await desktop.goto(base+'/',{waitUntil:'domcontentloaded'});
 await desktop.locator('.home-role-row .app-select-trigger').waitFor({timeout:25000});
 await desktop.locator('.nav-items a[href="#script"]').click();
 const desktopRole=desktop.locator('.reader-role');
 await desktopRole.click();
 assert.ok(await desktop.locator('.role-menu [role=option]').count()>1,'Desktop reader role uses anchored menu');
 assert.equal(await desktop.locator('#sheet').evaluate(el=>el.open),false);
 await desktop.keyboard.press('Escape');
 await desktop.locator('.role-menu').waitFor({state:'detached',timeout:3000});
 assert.equal(await desktop.locator('.role-menu').count(),0);
 await desktop.locator('.nav-items a[href="#home"]').click();
 await desktop.screenshot({path:'test-results/home-desktop.png'});
 console.log('PASS: desktop layout booted');
 await desktop.close();
 await page.bringToFront();
 await page.locator('.bottom-nav a[href="#home"]').click();
 await page.locator('.home-progress-dashboard').waitFor();

 // Verify all 12 combinations, saved preference and pastel-preview/vivid-UI split.
 await page.locator('.global-settings').click();
 await page.locator('.theme-color-choices').waitFor();
 assert.equal(await page.locator('input[name="theme-mode"]').count(),2);
 assert.equal(await page.locator('input[name="theme-color"]').count(),6);
 // Read computed properties from the live SVG on the home page, not merely the stored theme.
 const chartSamples={};
 for(const mode of ['light','dark']){
  await page.locator('input[name="theme-mode"][value="'+mode+'"]').check({force:true});
  chartSamples[mode]={};
  for(const color of ['blue','orange','pink','green','purple','rainbow']){
   await page.locator('input[name="theme-color"][value="'+color+'"]').check({force:true});
   await page.locator('.global-settings').click();
   await page.locator('.home-progress-dashboard').waitFor();
   const sample=await page.evaluate(()=>{
    const value=(selector,key)=>getComputedStyle(document.querySelector(selector))[key];
    return {
     mode:document.documentElement.dataset.themeMode,
     color:document.documentElement.dataset.themeColor,
     completed:value('.home-ring-completed','stroke'),
     practicing:value('.home-ring-practicing','stroke'),
     empty:value('.home-ring-base','stroke'),
     innerEmpty:value('.home-ring-base-inner','stroke'),
     festival:value('.home-festival-ring','stroke'),
     countdownText:value('.home-festival-days','fill'),
     practiceDot:value('.home-progress-dot-practicing','backgroundColor'),
     progressNumber:value('.home-progress-main-value','color'),
     primary:value('.home-actions .primary','backgroundImage'),
     gradients:[...document.querySelectorAll('.home-double-ring linearGradient')].map(el=>el.id)
    };
   });
   assert.equal(sample.mode,mode);
   assert.equal(sample.color,color);
   assert.notEqual(sample.completed,'none','completed ring must be painted');
   assert.notEqual(sample.festival,'none','countdown ring must be painted');
   assert.notEqual(sample.countdownText,'none','countdown text must be painted');
   if(color==='rainbow'){
    for(const id of ['mt-progress-rainbow','mt-practicing-rainbow','mt-festival-rainbow'])
     assert.ok(sample.gradients.includes(id),id+' definition must be mounted');
    for(const key of ['completed','practicing','festival','empty'])
     assert.ok(sample[key].includes('url('),'rainbow '+key+' needs an actual gradient');
   }else{
    assert.equal(sample.completed.includes('url('),false,'standard themes use a solid completed ring');
    assert.equal(sample.empty,sample.innerEmpty,'both uncompleted circles share a themed shade');
   }
   chartSamples[mode][color]=sample;
   await page.locator('.global-settings').click();
   await page.locator('.theme-color-choices').waitFor();
  }
  for(const key of ['completed','practicing','empty','festival','practiceDot']){
   const values=Object.values(chartSamples[mode]).map(sample=>sample[key]);
   assert.equal(new Set(values).size,6,mode+': all 6 colors must change the chart '+key);
  }
 }
 assert.notEqual(chartSamples.light.blue.completed,chartSamples.dark.blue.completed,'blue progress must change in dark mode');
 assert.notEqual(chartSamples.light.blue.festival,chartSamples.dark.blue.festival,'blue countdown must change in dark mode');
 const picker=await page.locator('.theme-color-choice[data-color="rainbow"] .theme-swatch').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.ok(picker.includes('linear-gradient'),'rainbow swatch is a gradient');
 assert.ok(!picker.includes('rgb(255, 43, 109)'),'rainbow picker remains pastel');
 await page.screenshot({path:'test-results/theme-settings-dark-rainbow.png'});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.theme-color-choices').waitFor({timeout:25000});
 assert.equal(await page.locator('input[name="theme-mode"][value="dark"]').isChecked(),true);
 assert.equal(await page.locator('input[name="theme-color"][value="rainbow"]').isChecked(),true);
 await page.locator('.global-settings').click();
 const applied=await page.locator('.home-actions .primary').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.ok(applied.includes('linear-gradient'),'applied rainbow has vivid UI');
 await page.screenshot({path:'test-results/theme-home-dark-rainbow.png'});
 await page.locator('.global-settings').click();
 await page.locator('input[name="theme-mode"][value="light"]').check({force:true});
 await page.locator('input[name="theme-color"][value="blue"]').check({force:true});
 await page.locator('.global-settings').click();
 console.log('PASS: 12 appearance combinations, preview, vivid rainbow and reload');

 // Full real 1,164-file browser cache test, including offline fetch of a previously saved clip.
 await page.locator('.bottom-nav a[href="#home"]').click();
 // Earlier bookmark persistence test reloads the browser tab, clearing the
 // simulated appinstalled event (a real installed PWA launches in standalone).
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
 await page.waitForFunction(()=>document.querySelector('[data-action="home-app-action"]')?.getAttribute('aria-label')==='オフライン音声を保存',null,{timeout:15000});
 console.log('OFFLINE-AUDIO QA quota:',JSON.stringify(await page.evaluate(()=>navigator.storage.estimate())));
 await page.locator('[data-action="home-app-action"]').click();
 await page.locator('#audio-download-bar').waitFor();
 await page.waitForTimeout(8000);
 const initialAudioState=await page.evaluate(async()=>({
  message:document.querySelector('#audio-download-message')?.textContent,
  stored:(await (await caches.open('mousetrap-audio-runtime-v1')).keys()).filter(r=>r.url.endsWith('.mp3')).length,
  controller:!!navigator.serviceWorker.controller
 }));
 console.log('OFFLINE-AUDIO QA initial:',JSON.stringify(initialAudioState));
 let finished=false;
 for(let i=0;i<45;i++){
  const snapshot=await page.evaluate(async()=>({
   message:document.querySelector('#audio-download-message')?.textContent||'',
   stored:(await (await caches.open('mousetrap-audio-runtime-v1')).keys()).filter(r=>r.url.endsWith('.mp3')).length,
   visible:document.visibilityState,
   controlled:!!navigator.serviceWorker.controller
  }));
  if(i%5===0)console.log('OFFLINE-AUDIO QA step '+i+':',JSON.stringify(snapshot));
  if(snapshot.message.includes('全1,164件の音声を保存しました')){finished=true;break;}
  if(snapshot.message.includes('後から続きだけ保存できます')||snapshot.message.includes('保存容量が足りません')||snapshot.message.includes('音声の一覧が不正')||snapshot.message.includes('音声の件数が'))throw Error('Offline download failed: '+JSON.stringify(snapshot));
  await page.waitForTimeout(2000);
 }
 assert.ok(finished,'offline audio package did not finish during browser QA');
 const endMessage=await page.locator('#audio-download-message').textContent();
 assert.ok(endMessage.includes('全1,164件の音声を保存しました'),'offline download did not finish: '+endMessage);
 const storedAudio=await page.evaluate(async()=>{
  const entries=await (await caches.open('mousetrap-audio-runtime-v1')).keys();
  return entries.filter(r=>r.url.endsWith('.mp3')).length;
 });
 assert.equal(storedAudio,1164,'all speech MP3 files are present in browser storage');
 await page.waitForFunction(()=>document.querySelector('[data-action="home-app-action"]')?.hidden===true,null,{timeout:15000});
 assert.equal(await headerAction.isVisible(),false,'header audio save action disappears after complete offline package');
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:20000});
 await page.context().setOffline(true);
 try{
  const offline=await page.evaluate(async()=>{
   const response=await fetch('./audio/lines/act2/act2-speech-0638.mp3');
   return {ok:response.ok,size:(await response.blob()).size};
  });
  assert.equal(offline.ok,true,'audio is retrieved without network');
  assert.ok(offline.size>100,'offline MP3 has full content');
 }finally{
  await page.context().setOffline(false);
 }
 console.log('PASS: stateful install/audio header, all 1,164 hosted MP3s cached and playable offline');

}finally{
 if(browser)await browser.close();
 server.kill();
}
