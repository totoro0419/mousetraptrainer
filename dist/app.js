import {sceneName,stats,labels,normalizeBundle,readFiles,plain} from './modules/data.js';
import * as storage from './modules/storage.js';
import {icon,esc,button,el,toast,openSheet,closeSheet,enhanceSelects} from './modules/ui.js';
import {loadStartupScript} from './modules/bundled.js';
let data,small,progress={},cleanup=()=>{},saveFailed=false,renderEpoch=0,updateRequested=false,lastContentRoute='home';
const defaults={role:'',scene:'all',font:20,leading:1.9,stick:true,read:{},sessions:{},range:{scene:'all',from:1,to:0},rate:1};
const app=document.querySelector('#app');
const roles=()=>[...new Set(data.lines.map(l=>l.speaker))];
const key=()=>`mt-state:${data.id}`;
function loadState(){small={...structuredClone(defaults),...storage.loadSmall(key(),{})};progress=storage.loadSmall(`mt-progress:${data.id}`,{});if(!progress||typeof progress!=='object'||Array.isArray(progress))progress={};if(!roles().includes(small.role))small.role=roles()[0];small.font=Math.max(16,Math.min(32,Number(small.font)||20));small.leading=[1.6,1.9,2.2].includes(Number(small.leading))?Number(small.leading):1.9;small.rate=[.75,1,1.25,1.5].includes(Number(small.rate))?Number(small.rate):1;small.stick=small.stick!==false;if(!data.scenes.some(s=>s.id===small.scene))small.scene='all';small.range={scene:small.range?.scene==='all'||data.scenes.some(s=>s.id===small.range?.scene)?small.range.scene:'all',from:Number(small.range?.from)||1,to:Number(small.range?.to)||0};if(!small.read||typeof small.read!=='object')small.read={};if(!small.sessions||typeof small.sessions!=='object'||Array.isArray(small.sessions))small.sessions={};for(const [mode,s] of Object.entries(small.sessions))if(!['cloze','audio'].includes(mode)||!s||!s.range||!Number.isInteger(s.index)||typeof s.lineId!=='string')delete small.sessions[mode];for(const [id,p] of Object.entries(progress))if(!p||![0,1,2].includes(p.level||0))delete progress[id];} 
function save(){try{storage.saveSmall(key(),small);storage.saveSmall(`mt-progress:${data.id}`,progress);if(saveFailed){saveFailed=false;document.querySelector('.save-error')?.remove();}}catch{saveFailed=true;if(!document.querySelector('.save-error')){const b=el(`<div class="save-error" role="alert">端末に保存できません。バックアップを保存してください。${button('バックアップ','export','secondary')}</div>`);b.querySelector('button').onclick=exportBackup;document.body.append(b);}}}
function setProgress(id,value){const old=progress[id]?{...progress[id]}:undefined;progress[id]=value;save();toast(value.review?'復習リストに追加しました':`暗記状況：${labels[value.level||0]}`,()=>{if(old)progress[id]=old;else delete progress[id];save();window.dispatchEvent(new CustomEvent('progresschange',{detail:id}));});window.dispatchEvent(new CustomEvent('progresschange',{detail:id}));}
function navItem(route,text,ico){return `<a class="nav-item" href="#${route}" ${route===(location.hash.slice(1)||'home')?'aria-current="page"':''}>${icon(ico)}<span>${text}</span></a>`;}
document.querySelector('.skip').onclick=e=>{e.preventDefault();const m=document.querySelector('#main .page-scroll')||document.querySelector('#main');m?.setAttribute('tabindex','-1');m?.focus({preventScroll:true});};
function shell(){app.innerHTML=`<div class="app-layout" data-route="${esc(location.hash.slice(1)||'home')}"><aside class="sidebar"><a href="#home" class="brand"><img src="./icon-192.png" alt=""><span>Mousetrap<br>Trainer</span></a><nav class="nav-items" aria-label="メイン">${navItem('home','ホーム','home')}${navItem('script','台本','book')}${navItem('rehearse','練習','play')}</nav></aside><div class="main-shell"><button type="button" class="icon-button global-settings" data-action="open-settings" aria-label="設定を開く" title="設定">${icon('settings')}</button><header class="topbar"><a class="brand mobile-brand" href="#home"><img src="./icon-192.png" alt=""><span>Mousetrap Trainer</span></a><div class="toolbar-actions"><button type="button" class="role-trigger" data-action="choose-role" aria-label="担当する役を変更。現在: ${esc(small.role)}"><span><small>担当する役</small><strong>${esc(small.role)}</strong></span>${icon('down')}</button></div></header><main id="main" class="main-content" style="display:contents"></main></div><nav class="bottom-nav" aria-label="メイン">${navItem('home','ホーム','home')}${navItem('script','台本','book')}${navItem('rehearse','練習','play')}</nav></div>`;}
async function render(){const epoch=++renderEpoch;cleanup();cleanup=()=>{};if(document.querySelector('#sheet').open)closeSheet();shell();const main=app.querySelector('#main'),route=location.hash.slice(1)||'home';
 if(route!=='settings')lastContentRoute=route;
 const gear=app.querySelector('[data-action=open-settings]');
 gear.setAttribute('aria-label',route==='settings'?'設定を閉じる':'設定を開く');
 gear.title=route==='settings'?'閉じる':'設定';
 if(route==='settings')gear.innerHTML=icon('close');
 gear.onclick=()=>{location.hash=route==='settings'?lastContentRoute:'settings';};
 if(route==='script'){const {mountReader}=await import('./modules/reader.js');if(epoch!==renderEpoch)return;cleanup=mountReader(main,context());}
 else if(route==='rehearse'){const {mountRehearsal}=await import('./modules/rehearsal.js');if(epoch!==renderEpoch)return;cleanup=mountRehearsal(main,context());}
 else if(route==='settings')renderSettings(main);else renderHome(main);
 app.querySelector('[data-action=choose-role]')?.addEventListener('click',openRolePicker);
 enhanceSelects(main);
}
function context(){return {data,small,progress,save,setProgress,roles,go:(route)=>{location.hash=route;},openImport,changeRole,openRolePicker,settings:()=>{location.hash='settings';}};}
async function changeRole(next){
 if(!roles().includes(next)||next===small.role)return;
 // Persist/stop the current rehearsal under its original role before changing it.
 cleanup();cleanup=()=>{};small.role=next;save();await render();toast(`担当する役を「${next}」に変更しました`);
}
function openRolePicker(){
 openSheet('担当する役を選ぶ',`<form id="role-form"><fieldset class="role-choices"><legend class="visually-hidden">担当する役</legend>${roles().map((role,i)=>`<label class="role-choice"><input type="radio" name="role" value="${esc(role)}" ${role===small.role?'checked':''}><span><strong>${esc(role)}</strong></span></label>`).join('')}</fieldset><div class="role-confirm"><button type="submit" class="primary">この役にする ${icon('check')}</button></div></form>`,{wide:true,setup:d=>{d.querySelector('#role-form').onsubmit=e=>{e.preventDefault();const next=d.querySelector('input[name=role]:checked')?.value;if(!next)return;closeSheet();changeRole(next);};}});
}
function roleHTML(){return `<select id="home-role" class="role-select" aria-label="自分の役">${roles().map(r=>`<option ${r===small.role?'selected':''}>${esc(r)}</option>`).join('')}</select>`;}
function renderHome(main){
 const st=stats(data,progress,small.role),last=data.lines.find(l=>l.id===small.read.id),active=last?.scene||(small.scene==='all'?data.scenes[0].id:small.scene),sessions=Object.entries(small.sessions).filter(([,session])=>session.role===small.role);
 main.innerHTML=`<div class="page-scroll"><div class="page home-page"><header class="home-heading"><h1>${esc(data.title)}</h1><p>${last?`${esc(sceneName(active))} · 発話 ${last.ordinal} から`:''}</p></header><div class="home-role-row"><label for="home-role">担当する役</label>${roleHTML()}</div><section class="home-actions" aria-label="練習を始める">${button(last?'続きから読む':'台本を読む','read','primary')}${button('練習を始める','practice','secondary')}</section><details class="home-progress"><summary><span>暗記の進捗</span><span>${st.counts[2]} / ${st.total}</span></summary><div class="progress-track" aria-label="暗記済み ${st.percent}%"><span style="background:var(--green);width:${st.percent}%"></span><span style="background:#a4b5dd;width:${st.total?st.counts[1]/st.total*100:0}%"></span></div><div class="progress-legend"><span>練習中 ${st.counts[1]}</span><span>暗記済み ${st.counts[2]}</span>${st.review?`<button class="text-button" data-action="review">復習する ${st.review}件</button>`:''}</div></details><section class="home-scenes"><div class="section-heading"><h2>幕・場面</h2></div><div class="scene-list">${data.scenes.map((scene,i)=>`<button class="scene-link" data-scene="${esc(scene.id)}"><span class="scene-link-text"><strong>${esc(scene.title)}</strong></span>${icon('chevron')}</button>`).join('')}</div></section>${sessions.length?`<section class="home-resume"><h2>練習の続き</h2>${sessions.map(([mode,session])=>`<button class="scene-link" data-action="practice"><span class="scene-link-text"><strong>${mode==='cloze'?'穴埋め練習':'音声練習'}</strong><small>${esc(sceneName(session.range?.scene||'all'))} · ${session.index+1}番目</small></span>${icon('chevron')}</button>`).join('')}</section>`:''}</div></div>`;
 main.querySelector('[data-action=read]').onclick=()=>{if(!last)small.scene=active;save();location.hash='script';};
 main.querySelectorAll('[data-action=practice]').forEach(b=>b.onclick=()=>{location.hash='rehearse';});
 main.querySelector('#home-role').onchange=e=>changeRole(e.target.value);
 main.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{small.scene=b.dataset.scene;small.read={};save();location.hash='script';});
 main.querySelector('[data-action=review]')?.addEventListener('click',()=>{small.scene='all';small.speaker=small.role;small.reviewOnly=true;save();location.hash='script';});
}
function renderSettings(main){
 main.innerHTML=`<div class="page-scroll"><div class="page settings-page">
  <header class="page-intro"><h1>設定</h1></header>
  <section class="setting-group" aria-labelledby="settings-display"><h2 id="settings-display">表示</h2>
   <div class="setting-row"><label for="font-size">文字サイズ</label><div class="setting-control"><output id="font-output" for="font-size">${small.font}px</output><input id="font-size" type="range" min="16" max="32" step="1" value="${small.font}"></div></div>
   <div class="setting-row"><label for="line-height">行間</label><select id="line-height"><option value="1.6">狭い</option><option value="1.9">標準</option><option value="2.2">広い</option></select></div>
   <div class="setting-row"><label for="show-stick">スクロールスティック</label><input id="show-stick" type="checkbox" ${small.stick?'checked':''}></div>
  </section>
  <section class="setting-group" aria-labelledby="settings-audio"><h2 id="settings-audio">音声</h2>
   <div class="setting-row"><label for="playback-rate">再生速度</label><select id="playback-rate">${[.75,1,1.25,1.5].map(n=>`<option value="${n}">${n}倍</option>`).join('')}</select></div>
   <button class="setting-link" type="button" data-action="audio-import"><span>音声を追加</span>${icon('chevron')}</button>
  </section>
  <button class="setting-link setting-manage" type="button" data-action="manage-data"><span>データとアプリ</span>${icon('chevron')}</button>
 </div></div>`;
 main.querySelector('#line-height').value=small.leading;
 main.querySelector('#playback-rate').value=small.rate;
 main.querySelector('#font-size').oninput=e=>{
  small.font=+e.target.value;main.querySelector('#font-output').textContent=small.font+'px';save();
 };
 main.querySelector('#line-height').onchange=e=>{small.leading=+e.target.value;save();};
 main.querySelector('#show-stick').onchange=e=>{small.stick=e.target.checked;save();};
 main.querySelector('#playback-rate').onchange=e=>{small.rate=+e.target.value;save();};
 main.querySelector('[data-action=audio-import]').onclick=async()=>{
  const {openAudioImport}=await import('./modules/audio.js');openAudioImport(context());
 };
 main.querySelector('[data-action=manage-data]').onclick=openDataManagement;
}
function openDataManagement(){
 openSheet('データとアプリ',`<div class="management-list">
  <button class="management-action" type="button" data-action="import"><span>台本・バックアップを読み込む</span>${icon('chevron')}</button>
  <button class="management-action" type="button" data-action="library"><span>保存した台本</span>${icon('chevron')}</button>
  <button class="management-action" type="button" data-action="export"><span>バックアップを保存</span>${icon('chevron')}</button>
  <button class="management-action" type="button" data-action="install"><span>アプリをインストール</span>${icon('chevron')}</button>
  <button class="management-action" type="button" data-action="update"><span>更新を確認</span>${icon('chevron')}</button>
  <p class="management-note">学習記録は端末に保存されます。バックアップに音声ファイルは含まれません。</p>
 </div>`,{setup:d=>{
  const actions={import:openImport,library:showLibrary,export:exportBackup,install:installApp,update:checkUpdate};
  for(const [name,handler] of Object.entries(actions))
   d.querySelector('[data-action='+name+']').onclick=handler;
 }});
}

async function activate(next){await storage.atomicPut([[`script:${next.id}`,next],['active-script',next.id]]);data=next;loadState();save();}
async function showLibrary(){const ids=await storage.get('script-list')||[];const items=[];for(const id of ids){const d=await storage.get(`script:${id}`);if(d&&!d.sample)items.push(d);}openSheet('保存した台本',items.length?items.map(d=>`<button class="scene-link" data-work="${esc(d.id)}"><span class="scene-link-text"><strong>${esc(d.title)}</strong><small>${d.lines.length}件のセリフ</small></span>${icon('chevron')}</button>`).join(''):'<p>保存された台本はありません。</p>',{setup:d=>{d.querySelectorAll('[data-work]').forEach(b=>b.onclick=async()=>{const next=await storage.get(`script:${b.dataset.work}`);await activate(next);closeSheet();render();});}});}
function openImport(){
 openSheet('台本を読み込む',`<p class="import-hint">JSON・ZIPファイルを選択してください。複数のJSONもまとめて選べます。</p>
  <div class="import-select">${button('ファイルを選ぶ','choose-files','primary','upload')}</div>
  <div id="import-result" class="sheet-section" aria-live="polite"></div>`,{
  setup:d=>{d.querySelector('[data-action=choose-files]').onclick=()=>document.querySelector('#data-files').click();}
 });
}

document.querySelector('#data-files').onchange=async e=>{
 const files=[...e.target.files];e.target.value='';if(!files.length)return;const result=document.querySelector('#import-result');if(!result)return;result.innerHTML='<p role="status">データの対応を確認しています…</p>';
 try{const read=await readFiles(files);let next=read.data,backup=read.backup;
  if(backup){if(!backup.data?.lines)throw Error('バックアップの台本がありません。');next=validateSaved(backup.data);}
  result.innerHTML=`<h3>読み込む内容</h3><p><strong>${esc(next.title)}</strong></p><div class="data-summary"><div><strong>${next.lines.length}</strong><span>セリフ</span></div><div><strong>${next.scenes.length}</strong><span>場面</span></div><div><strong>${Object.keys(next.dictionary).length}</strong><span>辞書項目</span></div></div>${next.warnings.length?`<p class="notice">${esc(next.warnings.join(' / '))}<br>未収録の項目は「未収録」と表示します。</p>`:''}<p class="subtle">${backup?'バックアップの設定・閲覧位置・稽古の続きを復元します。':'同じIDの台本を更新しても、学習記録は引き継ぎます。'}</p><div style="margin-top:20px">${button(backup?'復元して開く':'この台本を使う','confirm-import','primary')}</div>`;
  result.querySelector('button').onclick=async()=>{try{
   if(backup){const existing=storage.loadSmall(`mt-progress:${next.id}`,{});for(const [id,p] of Object.entries(backup.progress||{})){if(!existing[id]||(p.updatedAt||0)>(existing[id].updatedAt||0))existing[id]=p;}storage.saveSmall(`mt-progress:${next.id}`,existing);storage.saveSmall(`mt-state:${next.id}`,{...defaults,...backup.settings});}
   await activate(next);const list=await storage.get('script-list')||[];if(!list.includes(next.id)){list.push(next.id);await storage.put('script-list',list);}await navigator.storage?.persist?.();closeSheet();location.hash='home';await render();toast(`セリフ${next.lines.length}件を読み込みました`);
  }catch(err){result.innerHTML=`<p class="notice error" role="alert">保存できませんでした。${esc(err.message)}</p>`;}};
 }catch(err){result.innerHTML=`<p class="notice error" role="alert">読み込めませんでした。${esc(err.message)}</p>`;}
};
function validateSaved(saved){const script={};for(const scene of saved.scenes||[])script[scene.id]={speeches:saved.lines.filter(l=>l.scene===scene.id)};return normalizeBundle({...saved,script});}
async function exportBackup(){const output={format:'mousetrap-backup-v1',exportedAt:new Date().toISOString(),data,settings:small,progress};downloadJSON(output,'mousetrap-backup.json');toast('バックアップを保存しました');}
function downloadJSON(v,name){const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
let installPrompt,registration;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('appinstalled',()=>{installPrompt=null;toast('インストールしました');});
async function installApp(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else openSheet('ホーム画面に追加',`<p>Android / Chrome：ブラウザーのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。</p><div class="sheet-section"><p>iPhone / iPad：Safariの共有メニューから「ホーム画面に追加」を選びます。</p></div><div class="sheet-section"><p class="subtle">すでにインストール済みの場合は、そのまま使えます。ブラウザーによってインストール操作は異なります。</p></div>`);}
async function checkUpdate(){if(!registration){toast('更新機能を準備中です。ページを再読み込みしてください。');return;}try{await registration.update();if(registration.waiting)openSheet('更新を適用',`<p>閲覧位置と学習記録を保存して更新します。</p>${button('保存して更新','apply-update','primary')}`,{setup:d=>d.querySelector('button[data-action]').onclick=()=>{save();updateRequested=true;registration.waiting.postMessage('activate');}});else toast('更新を確認しました。新しい更新はありません。');}catch{toast('更新を確認できません。通信状態を確認してください。');}}
window.addEventListener('hashchange',render);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('storage',e=>{if(e.key===`mt-progress:${data?.id}`){progress=storage.loadSmall(e.key,{});render();}});
window.addEventListener('offline',()=>toast('オフラインです。端末に保存した台本を使えます。'));
try{const startup=await loadStartupScript(storage,async url=>{const response=await fetch(url);if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();});data=startup.data;loadState();await render();if(startup.warning)toast(startup.warning);
 if('serviceWorker'in navigator && location.hostname!=='terminal.local'){const hadController=!!navigator.serviceWorker.controller;registration=await navigator.serviceWorker.register('./sw.js');registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast('アプリの更新があります。設定から適用できます。');});});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing&&(hadController||updateRequested)){refreshing=true;save();location.reload();}});}
}catch(err){app.innerHTML=`<div class="page"><h1>アプリを開けませんでした</h1><p class="notice error" style="margin:24px 0">${esc(err.message)}</p><p>ブラウザーのストレージが利用できるか確認してください。プライベートブラウズでは保存が制限されることがあります。</p><button class="primary" onclick="location.reload()">再試行</button></div>`;}
