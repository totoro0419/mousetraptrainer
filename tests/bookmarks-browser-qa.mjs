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

 await page.goto(base+'/#script',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="bookmarks"]').waitFor({timeout:30000});
 await page.locator('[data-id="'+act1+'"] [data-action="bookmark"]').click();
 assert.equal(await page.locator('[data-id="'+act1+'"] [data-action="bookmark"]').getAttribute('aria-pressed'),'true');

 // Add a bookmark in another act through the existing scene selector.
 await page.locator('[data-action="scene"]').click();
 await page.locator('#sheet [data-scene="act2"]').click();
 await page.locator('[data-id="'+act2+'"] [data-action="bookmark"]').click();
 await page.locator('[data-action="bookmarks"]').click();
 assert.equal(await page.locator('.bookmark-jump').count(),2);
 await page.locator('.bookmark-jump[data-bookmark-id="'+act1+'"]').click();
 await expectVisibleTarget(act1);
 assert.equal(await page.locator('#line-'+act1).count(),1,'cross-scene bookmark jump');

 // Even an impossible search filter must not block direct bookmark navigation.
 await page.locator('[data-action="search"]').click();
 await page.locator('.reader-filter input[type="search"]').fill('never_matching_bookmark_qa_2026');
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.reader-scroll .speech').count(),0);
 await page.locator('[data-action="bookmarks"]').click();
 await page.locator('.bookmark-jump[data-bookmark-id="'+act2+'"]').click();
 await expectVisibleTarget(act2);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mt-state:mousetrap-private')));
 assert.equal(state.scene,'act2');
 assert.equal(state.query,'');
 assert.equal(state.speaker,'all');
 assert.equal(state.bookmarkOnly,false);
 assert.equal(state.read.id,act2);

 // Home also provides a direct route back to the same saved lines.
 await page.locator('.bottom-nav a[href="#home"]').click();
 await page.locator('.home-bookmarks-shortcut').waitFor();
 assert.match(await page.locator('.home-bookmarks-shortcut').innerText(),/2件/);
 await page.locator('.home-bookmarks-shortcut').click();
 await page.locator('.bookmark-jump[data-bookmark-id="'+act1+'"]').click();
 await page.locator('#line-'+act1).waitFor();
 await expectVisibleTarget(act1);
 assert.equal(new URL(page.url()).hash,'#script');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="bookmarks"]').waitFor({timeout:30000});
 await page.locator('[data-action="bookmarks"]').click();
 assert.equal(await page.locator('.bookmark-jump').count(),2,'bookmarks persist across reload');
 assert.deepEqual(errors,[],'no browser exceptions');
 console.log('PASS: bookmark picker from reader and home, cross-act/filter jump, persisted bookmarks');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
