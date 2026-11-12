import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,devices} from 'playwright';

const port=8799,base='http://127.0.0.1:'+port;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
let browser;
const act1='act1-scene1-speech-0001',act2='act2-speech-0001';
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)throw Error('HTTP server terminated');
  try{if((await fetch(base+'/index.html')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(ready,'serve production build');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({...devices['Pixel 7'],locale:'ja-JP'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const expectVisibleTarget=async id=>page.waitForFunction(id=>{
  const node=document.getElementById('line-'+id),scroller=document.querySelector('.reader-scroll');
  if(!node||!scroller)return false;
  const line=node.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
  return line.bottom>viewport.top+5&&line.top<viewport.bottom-5;
 },id,{timeout:12000});
 const setScene=async scene=>{
  const search=page.locator('.reader-top [data-action="search"]');
  if(await search.getAttribute('aria-expanded')!=='true')await search.click();
  await page.locator('.reader-filter [data-action="scene"]').click();
  await page.locator('#sheet [data-scene="'+scene+'"]').click();
 };
 const progressState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mt-progress:mousetrap-private')));

 await page.goto(base+'/#script',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="bookmarks"]').waitFor({timeout:30000});
 assert.equal(await page.locator('.reader-top [data-action="scene"]').count(),0,'scene moved out of crowded toolbar');
 assert.equal(await page.locator('.reader-filter [data-action="scene"]').count(),1,'scene accessible within search');

 // First marker, followed by a marker in Act II, leaves just the second one.
 await page.locator('[data-id="'+act1+'"] [data-action="bookmark"]').click();
 assert.equal((await progressState())[act1].bookmarked,true);
 await setScene('act2');
 await page.locator('[data-id="'+act2+'"] [data-action="bookmark"]').click();
 let progress=await progressState();
 assert.equal(progress[act1].bookmarked,false,'replaces previous bookmark');
 assert.equal(progress[act2].bookmarked,true);
 assert.equal(await page.locator('[data-action="bookmarks"]').getAttribute('aria-label'),'栞に戻る');

 // Return to another scene, then one-tap directly to the latest marker.
 await setScene('act1-scene1');
 await page.locator('[data-action="bookmarks"]').click();
 await expectVisibleTarget(act2);
 assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false,'no bookmark list sheet');
 assert.equal(await page.locator('#line-'+act2).count(),1);

 // Search results can be empty; direct return resets filters and reveals target.
 await page.locator('.reader-top [data-action="search"]').click();
 await page.locator('.reader-filter input[type="search"]').fill('never_matching_bookmark_qa_2026');
 await page.waitForFunction(()=>document.querySelectorAll('.reader-scroll .speech').length===0);
 await page.locator('[data-action="bookmarks"]').click();
 await expectVisibleTarget(act2);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mt-state:mousetrap-private')));
 assert.equal(state.scene,'act2');
 assert.equal(state.query,'');
 assert.equal(state.speaker,'all');
 assert.equal(state.bookmarkOnly,false);
 assert.equal(state.read.id,act2);

 // Home is also a direct, uncluttered one-tap return.
 await page.locator('.bottom-nav a[href="#home"]').click();
 await page.locator('.home-bookmarks-shortcut').waitFor();
 assert.match(await page.locator('.home-bookmarks-shortcut').innerText(),/栞に戻る/);
 await page.locator('.home-bookmarks-shortcut').click();
 await expectVisibleTarget(act2);
 assert.equal(new URL(page.url()).hash,'#script');

 // Persist across reload and migrate legacy multiple bookmarks to the latest.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="bookmarks"]').waitFor({timeout:30000});
 // Exit the app before injecting legacy data, otherwise pagehide saves stale in-memory progress.
 await page.goto(base+'/manifest.webmanifest',{waitUntil:'domcontentloaded'});
 await page.evaluate(([a,b])=>{
  const key='mt-progress:mousetrap-private',p=JSON.parse(localStorage.getItem(key));
  p[a]={...p[a],bookmarked:true,bookmarkAt:100,level:2,review:true};
  p[b]={...p[b],bookmarked:true,bookmarkAt:200};
  localStorage.setItem(key,JSON.stringify(p));
 },[act1,act2]);
 await page.goto(base+'/#script',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="bookmarks"]').waitFor({timeout:30000});
 progress=await progressState();
 assert.equal(progress[act1].bookmarked,false,'migrate old bookmark');
 assert.equal(progress[act1].review,true,'keep review state');
 assert.equal(progress[act1].level,2,'keep mastery state');
 assert.equal(progress[act2].bookmarked,true,'retain latest');

 // Removing the only bookmark leaves no return destination.
 await page.locator('[data-id="'+act2+'"] [data-action="bookmark"]').click();
 assert.equal((await progressState())[act2].bookmarked,false);
 await page.locator('[data-action="bookmarks"]').click();
 assert.match(await page.locator('#toast').innerText(),/栞はまだありません/);
 await page.locator('.bottom-nav a[href="#home"]').click();
 assert.equal(await page.locator('.home-bookmarks-shortcut').count(),0);

 // Narrow mobile layout must not let toolbar buttons overlap the settings control.
 await page.setViewportSize({width:320,height:740});
 await page.locator('.bottom-nav a[href="#script"]').click();
 await page.locator('.reader-top [data-action="search"]').waitFor();
 const overlaps=await page.evaluate(()=>{
  const heading=document.querySelector('.reader-heading').getBoundingClientRect();
  const tools=[...document.querySelectorAll('.reader-top .reader-tools button')].map(e=>e.getBoundingClientRect());
  const settings=document.querySelector('.global-settings').getBoundingClientRect();
  return tools.some(r=>r.right>settings.left+1||r.left<heading.right-1||r.right>innerWidth);
 });
 assert.equal(overlaps,false,'320px reader toolbar has no overlapping controls');
 assert.deepEqual(errors,[],'no browser exceptions');
 console.log('PASS: latest-only bookmark, replacement, migration, direct jumps, compact 320px toolbar');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
