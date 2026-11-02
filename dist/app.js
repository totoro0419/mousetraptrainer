import {sceneName,stats,labels,normalizeBundle,readFiles,plain} from './modules/data.js';
import * as storage from './modules/storage.js';
import {icon,esc,button,el,toast,openSheet,closeSheet,enhanceSelects} from './modules/ui.js';
import {loadStartupScript} from './modules/bundled.js';
import {loadDramaturgy} from './modules/dramaturgy.js';
import {loadQuickContexts} from './modules/quick-context.js';
import {FESTIVAL,festivalCountdown} from './modules/festival-countdown.js';
import {homeProgressRings,festivalRemainingRing} from './modules/home-progress.js';
import {normalizeQuickMemory,currentQuickLine,refreshQuickMemory,ensureQuickMemory,completeQuickMemory,quickMemoryStats} from './modules/quick-memory.js';
async function fetchData(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
import {openRoleMenu,closeRoleMenu} from './modules/role-menu.js';
import {fetchAnnouncements,notificationFeed,unreadNotifications,markAllNotificationsRead,recordInstalledWelcome} from './modules/notifications.js';
import {receiveDailyToday,quoteSentence,festivalDaysRemaining} from './modules/daily-notifications.js';
import {isInstalledPwa,offlineAudioStatus,downloadEntireAudio,isAudioDownloadRunning,OFFLINE_AUDIO_CACHE,OFFLINE_AUDIO_TOTAL} from './modules/offline-audio.js';
import {createUpdateManager} from './modules/update-manager.js';
let data,small,progress={},cleanup=()=>{},saveFailed=false,renderEpoch=0,lastContentRoute='home',announcements=[],pwaJustInstalled=false,headerActionEpoch=0;
const defaults={role:'',scene:'all',font:20,leading:1.9,stick:true,read:{},sessions:{},range:{scene:'all',from:1,to:0},rate:1,bookmarkOnly:false};
const app=document.querySelector('#app');
let quickWasHidden=false,lastQuickDrawAt=0;
const roles=()=>[...new Set(data.lines.map(l=>l.speaker))];
const key=()=>`mt-state:${data.id}`;
function loadState(){small={...structuredClone(defaults),...storage.loadSmall(key(),{})};progress=storage.loadSmall(`mt-progress:${data.id}`,{});if(!progress||typeof progress!=='object'||Array.isArray(progress))progress={};if(!roles().includes(small.role))small.role=roles()[0];small.font=Math.max(16,Math.min(32,Number(small.font)||20));small.leading=[1.6,1.9,2.2].includes(Number(small.leading))?Number(small.leading):1.9;small.rate=[.75,1,1.25,1.5].includes(Number(small.rate))?Number(small.rate):1;small.stick=small.stick!==false;if(!data.scenes.some(s=>s.id===small.scene))small.scene='all';small.range={scene:small.range?.scene==='all'||data.scenes.some(s=>s.id===small.range?.scene)?small.range.scene:'all',from:Number(small.range?.from)||1,to:Number(small.range?.to)||0};if(!small.read||typeof small.read!=='object')small.read={};if(!small.sessions||typeof small.sessions!=='object'||Array.isArray(small.sessions))small.sessions={};for(const [mode,s] of Object.entries(small.sessions))if(!['cloze','audio'].includes(mode)||!s||!s.range||!Number.isInteger(s.index)||typeof s.lineId!=='string')delete small.sessions[mode];for(const [id,p] of Object.entries(progress))if(!p||![0,1,2].includes(p.level||0))delete progress[id];small.quickMemorize=normalizeQuickMemory(small.quickMemorize);} 
function save(){try{storage.saveSmall(key(),small);storage.saveSmall(`mt-progress:${data.id}`,progress);if(saveFailed){saveFailed=false;document.querySelector('.save-error')?.remove();}}catch{saveFailed=true;if(!document.querySelector('.save-error')){const b=el(`<div class="save-error" role="alert">端末に保存できません。バックアップを保存してください。${button('バックアップ','export','secondary')}</div>`);b.querySelector('button').onclick=exportBackup;document.body.append(b);}}}
// Persist quick-memory completion and the next prompt together in mt-state.
// A failure does not advance the in-memory prompt or record a false completion.
function saveQuickMemory(next){
 try{
  storage.saveSmall(key(),{...small,quickMemorize:next});
  small.quickMemorize=next;
  return true;
 }catch{
  toast('「今覚える！」の記録を保存できません。空き容量を確認して再試行してください。');
  return false;
 }
}
function refreshQuickOnLaunch(){
 lastQuickDrawAt=Date.now();
 const next=refreshQuickMemory(data,progress,small.quickMemorize,small.role);
 // Keep a usable prompt for this session even when persistence is unavailable.
 if(!saveQuickMemory(next))small.quickMemorize=next;
}
// An installed PWA may reopen from the background without a new HTML load.
function refreshQuickOnResume(){
 if(!data||!small||Date.now()-lastQuickDrawAt<1000)return;
 refreshQuickOnLaunch();
 const route=location.hash.slice(1)||'home';
 if(route==='home'||route==='quick')void render();
}
function ensureQuickForRole(){
 if(currentQuickLine(data,small.quickMemorize,small.role))return;
 const next=ensureQuickMemory(data,progress,small.quickMemorize,small.role);
 if(!saveQuickMemory(next))small.quickMemorize=next;
}
function completeQuick(lineId){
 const next=completeQuickMemory(data,progress,small.quickMemorize,small.role,lineId);
 return next?saveQuickMemory(next):false;
}
function setProgress(id,value){const old=progress[id]?{...progress[id]}:undefined;progress[id]=value;save();toast(value.bookmarked!==old?.bookmarked?(value.bookmarked?'栞を付けました':'栞を外しました'):value.review!==old?.review?(value.review?'復習リストに追加しました':'復習リストから外しました'):`暗記状況：${labels[value.level||0]}`,()=>{if(old)progress[id]=old;else delete progress[id];save();window.dispatchEvent(new CustomEvent('progresschange',{detail:id}));});window.dispatchEvent(new CustomEvent('progresschange',{detail:id}));}
function navItem(route,text,ico){return `<a class="nav-item" href="#${route}" ${route===(location.hash.slice(1)||'home')?'aria-current="page"':''}>${icon(ico)}<span>${text}</span></a>`;}
document.querySelector('.skip').onclick=e=>{e.preventDefault();const m=document.querySelector('#main .page-scroll')||document.querySelector('#main');m?.setAttribute('tabindex','-1');m?.focus({preventScroll:true});};
function shell(){app.innerHTML=`<div class="app-layout" data-route="${esc(location.hash.slice(1)||'home')}" data-installed="${isInstalledPwa()?'true':'false'}"><aside class="sidebar"><a href="#home" class="brand"><img src="./icon-v2-192.png" alt=""><span>Mousetrap<br>Trainer</span></a><nav class="nav-items" aria-label="メイン">${navItem('home','ホーム','home')}${navItem('script','台本','book')}${navItem('rehearse','練習','play')}</nav></aside><div class="main-shell"><button type="button" class="home-app-action is-install" data-action="home-app-action" hidden></button>${isInstalledPwa()?`<button type="button" class="icon-button global-notifications" data-action="open-notifications" aria-label="お知らせを開く" title="お知らせ">${icon('bell')}<span class="notification-badge" hidden></span></button>`:''}<button type="button" class="icon-button global-settings" data-action="open-settings" aria-label="設定を開く" title="設定">${icon('settings')}</button><header class="topbar"><a class="home-topbar-brand" href="#home" aria-label="Mousetrap Trainer ホームへ"><img src="./icon-v2-512.png" width="36" height="36" alt="" decoding="async"><span class="home-brand-name">Mousetrap<span>Trainer</span></span></a><a class="brand mobile-brand" href="#home"><img src="./icon-v2-192.png" alt=""><span>Mousetrap Trainer</span></a><div class="toolbar-actions"><button type="button" class="role-trigger" data-action="choose-role" aria-haspopup="listbox" aria-expanded="false" aria-label="担当する役を変更。現在: ${esc(small.role)}"><span><small>担当する役</small><strong>${esc(small.role)}</strong></span>${icon('down')}</button></div></header><main id="main" class="main-content" style="display:contents"></main></div><nav class="bottom-nav" aria-label="メイン">${navItem('home','ホーム','home')}${navItem('script','台本','book')}${navItem('rehearse','練習','play')}</nav></div>`;}
async function render(){const epoch=++renderEpoch;closeRoleMenu({immediate:true});cleanup();cleanup=()=>{};if(document.querySelector('#sheet').open)closeSheet({immediate:true});if(location.hash==='#notifications'&&!isInstalledPwa()){location.replace(location.pathname+location.search+'#home');return;}shell();const main=app.querySelector('#main'),route=location.hash.slice(1)||'home';
 if(route!=='settings')lastContentRoute=route;
 const gear=app.querySelector('[data-action=open-settings]');
 gear.setAttribute('aria-label',route==='settings'?'設定を閉じる':'設定を開く');
 gear.title=route==='settings'?'閉じる':'設定';
 if(route==='settings')gear.innerHTML=icon('close');
 gear.onclick=()=>{location.hash=route==='settings'?lastContentRoute:'settings';};
 app.querySelector('[data-action=open-notifications]')?.addEventListener('click',openNotificationInbox);
 app.querySelector('[data-action=home-app-action]').onclick=()=>isInstalledPwa()||pwaJustInstalled?startOfflineAudioDownload():installApp();
 updateNotificationBadge();
 if(route==='quick'){const {mountQuickMemory}=await import('./modules/quick-memory-view.js');if(epoch!==renderEpoch)return;cleanup=mountQuickMemory(main,context());}
 else if(route==='script'){const {mountReader}=await import('./modules/reader.js');if(epoch!==renderEpoch)return;cleanup=mountReader(main,context());}
 else if(route==='rehearse'){const {mountRehearsal}=await import('./modules/rehearsal.js');if(epoch!==renderEpoch)return;cleanup=mountRehearsal(main,context());}
 else if(route==='settings')renderSettings(main);else renderHome(main);
 if(route==='notifications')queueMicrotask(()=>{if(epoch===renderEpoch)openNotificationInbox();});
 app.querySelector('[data-action=choose-role]')?.addEventListener('click',openRolePicker);
 enhanceSelects(main);
 void refreshHeaderAppAction();
}

function currentNotificationFeed(){return notificationFeed(announcements);}
function updateNotificationBadge(){
 const trigger=document.querySelector('[data-action=open-notifications]');
 if(!trigger)return;
 const count=unreadNotifications(currentNotificationFeed());
 const badge=trigger.querySelector('.notification-badge');
 badge.hidden=count===0;
 badge.textContent=count>9?'9+':String(count);
 trigger.setAttribute('aria-label',count?'お知らせ、未読'+count+'件':'お知らせを開く');
 trigger.title=count?'未読のお知らせ '+count+'件':'お知らせ';
}
async function jumpToNotificationLine(id){
 if(!/^act(?:1-scene[12]|2)-speech-\d{4}$/.test(id))return;
 // Stop the current screen before switching scripts, so its scroll saver cannot overwrite the target.
 cleanup();cleanup=()=>{};
 if(data.id!=='mousetrap-private'){
  const bundled=await storage.get('script:mousetrap-private');
  if(!bundled){toast('本編台本を読み込めません。');return;}
  await activate(bundled);
 }
 const target=data.lines.find(item=>item.id===id);
 if(!target){toast('このセリフを見つけられません。');return;}
 // Reveal the target even if a scene, speaker, search, review or bookmark filter was active.
 small.scene=target.scene;small.speaker='all';small.query='';small.reviewOnly=false;small.bookmarkOnly=false;
 small.read={id:target.id,scene:target.scene,highlight:true};
 save();closeSheet();
 if(location.hash==='#script')await render();else location.hash='script';
}
function openNotificationInbox(){
 if(!isInstalledPwa())return;
 const items=currentNotificationFeed();
 // Opening the inbox marks all currently visible notifications read.
 if(items.length)markAllNotificationsRead(items);
 updateNotificationBadge();
 const lineMap=data?.id==='mousetrap-private'?new Map(data.lines.map(line=>[line.id,line])):new Map();
 const content=items.length?'<div class="notification-list">'+items.map(item=>{
  const line=item.lineId?lineMap.get(item.lineId):null;
  const sentence=line?quoteSentence(line.text,item.quoteAnchor||''):null;
  const quote=item.lineId?'<button type="button" class="notification-script-quote" data-notification-line="'+esc(item.lineId)+'" aria-label="台本の該当セリフを開く">'+
    '<span class="notification-quote-label">劇中のセリフ'+(line?' · '+esc(line.speaker):'')+'</span>'+
    (sentence?'<span class="notification-quote-text" lang="en">“'+esc(sentence)+'”</span>':'<span class="notification-quote-text">台本の該当箇所へ</span>')+
    '</button>':'';
  const remaining=item.id?.startsWith('daily-')?festivalDaysRemaining(item.date):null;
  const countdown=remaining===null?null:'聖光祭まであと'+remaining+'日！';
  return '<article class="notification-entry is-read">'+
   '<div class="notification-entry-heading"><strong>'+esc(countdown||item.title)+'</strong></div>'+
   (countdown?'<p class="notification-editorial-title">'+esc(item.title)+'</p>':'')+
   (item.date?'<time class="notification-date">'+esc(item.date.slice(0,10))+'</time>':'')+
   quote+'<p>'+esc(item.body)+'</p>'+
   '</article>';
 }).join('')+'</div>':'<p class="subtle">まだお知らせはありません。</p>';
 openSheet('お知らせ',content,{setup:sheet=>{
  sheet.querySelectorAll('[data-notification-line]').forEach(button=>
   button.addEventListener('click',()=>{void jumpToNotificationLine(button.dataset.notificationLine);}));
 }});
}
async function refreshNotifications(){
 if(!isInstalledPwa()){announcements=[];return;}
 const [feed]=await Promise.all([fetchAnnouncements(),receiveDailyToday()]);
 announcements=feed;
 updateNotificationBadge();
}
function greetInstalledDevice(){
 const first=recordInstalledWelcome();
 updateNotificationBadge();
 if(first){
  toast('インストールしました。お知らせを確認できます。');
 }
}

function context(){return {data,small,progress,save,setProgress,roles,currentQuickLine:()=>currentQuickLine(data,small.quickMemorize,small.role),completeQuick,go:(route)=>{location.hash=route;},openImport,changeRole,openRolePicker,settings:()=>{location.hash='settings';}};}
async function changeRole(next){
 if(!roles().includes(next)||next===small.role)return;
 // Persist/stop the current rehearsal under its original role before changing it.
 cleanup();cleanup=()=>{};small.role=next;ensureQuickForRole();save();await render();toast(`担当する役を「${next}」に変更しました`);
}
function openRolePicker(event){
 const trigger=event?.currentTarget;
 if(!trigger?.isConnected)return;
 openRoleMenu(trigger,roles(),small.role,changeRole);
}
function roleHTML(){return `<select id="home-role" class="role-select" data-role-menu="true" aria-label="自分の役">${roles().map(r=>`<option ${r===small.role?'selected':''}>${esc(r)}</option>`).join('')}</select>`;}
function refreshFestivalCountdown(){
 const dashboard=app.querySelector('.home-progress-dashboard');
 if(!dashboard)return;
 const state=festivalCountdown(),ring=festivalRemainingRing(state);
 dashboard.querySelector('.home-festival-ring').setAttribute('stroke-dasharray',ring.dash);
 dashboard.querySelector('.home-festival-days').textContent=ring.value;
 dashboard.querySelector('.home-festival-days').setAttribute('y',ring.prefix?'82':'76');
 dashboard.querySelector('.home-festival-prefix').textContent=ring.prefix;
 dashboard.querySelector('.home-double-ring').setAttribute('aria-label',dashboard.dataset.progressLabel+'。'+ring.description);
 dashboard.dataset.festivalPhase=state.phase;
}
function openHomeReview(){
 small.scene='all';small.speaker=small.role;small.reviewOnly=true;small.bookmarkOnly=false;save();location.hash='script';
}
function showHomeProgressDetails(st){
 const m=homeProgressRings(st),quick=quickMemoryStats(data,small.quickMemorize,small.role);
 openSheet('暗記の進捗',`<div class="home-progress-breakdown">
  <p>担当する役：<strong>${esc(small.role)}</strong></p>
  <div class="home-progress-breakdown-row"><span>暗記済み</span><strong>${m.completed}件（${m.completedPercent}%）</strong></div>
  <div class="home-progress-breakdown-row"><span>練習中</span><strong>${m.practicing}件（${m.practicingPercent}%）</strong></div>
  <div class="home-progress-breakdown-row"><span>未着手</span><strong>${m.unstarted}件（${m.unstartedPercent}%）</strong></div>
  <p class="subtle">対象：全${m.total}セリフ。割合は項目ごとに四捨五入しています。</p>
  <section class="quick-memory-history" aria-label="今覚える！の履歴">
   <h3>今覚える！</h3>
   <div class="quick-memory-history-counts"><div><span>今日</span><strong>${quick.today}回</strong></div><div><span>累計</span><strong>${quick.total}回</strong></div><div><span>練習したセリフ</span><strong>${quick.unique}件</strong></div></div>
   ${quick.recent.length?'<p class="quick-memory-history-heading">最近練習したセリフ</p>'+quick.recent.map(item=>'<p class="quick-memory-history-line" title="'+esc(item.line.text)+'">'+esc(item.line.speaker)+' · '+esc(item.line.text)+'</p>').join(''):''}
  </section>
  ${st.review?button(`要復習 ${st.review}件を開く`,'review','secondary','book'):''}
 </div>`,{setup:d=>d.querySelector('[data-action=review]')?.addEventListener('click',()=>{closeSheet();openHomeReview();})});
}
function renderHome(main){
 const st=stats(data,progress,small.role),ring=homeProgressRings(st),quickLine=currentQuickLine(data,small.quickMemorize,small.role);
 const festival=festivalCountdown(),remaining=festivalRemainingRing(festival);
 const last=data.lines.find(l=>l.id===small.read.id);
 const active=last?.scene||(small.scene==='all'?data.scenes[0].id:small.scene);
 const sessions=Object.entries(small.sessions).filter(([,session])=>session.role===small.role);
 const label=`暗記済み${ring.completedPercent}%、練習中${ring.practicingPercent}%、未着手${ring.unstartedPercent}%`;
 main.innerHTML=`<div class="page-scroll"><div class="page home-page">
  <section class="home-progress-dashboard" data-progress-label="${esc(label)}" data-festival-phase="${festival.phase}" aria-label="学習の進捗">
   <header class="home-progress-heading"><h1>学習の進捗</h1><button type="button" class="home-progress-more" data-action="progress-details">詳細 ${icon('chevron')}</button></header>
   <div class="home-progress-main">
    <svg class="home-double-ring" width="146" height="146" viewBox="0 0 140 140" role="img" aria-label="${esc(label+'。'+remaining.description)}">
     <circle cx="70" cy="70" r="55" class="home-ring-base home-ring-outer"/>
     <circle cx="70" cy="70" r="55" class="home-ring-completed home-ring-outer" stroke-dasharray="${ring.doneDash}" transform="rotate(-90 70 70)"/>
     <circle cx="70" cy="70" r="55" class="home-ring-practicing home-ring-outer" stroke-dasharray="${ring.doingDash}" stroke-dashoffset="${ring.doingOffset}" transform="rotate(-90 70 70)"/>
     <circle cx="70" cy="70" r="36" class="home-ring-base-inner home-ring-inner"/>
     <circle cx="70" cy="70" r="36" class="home-festival-ring home-ring-inner" stroke-dasharray="${remaining.dash}" transform="rotate(-90 70 70)"/>
     <text x="70" y="63" text-anchor="middle" class="home-festival-prefix">${remaining.prefix}</text>
     <text x="70" y="${remaining.prefix?'82':'76'}" text-anchor="middle" class="home-festival-days">${remaining.value}</text>
    </svg>
    <div class="home-progress-values">
     <div class="home-progress-key home-progress-key-main"><span>暗記済み</span><strong class="home-progress-main-value">${ring.completedPercent}%</strong></div>
     <div class="home-progress-key"><span class="home-progress-dot home-progress-dot-practicing"></span><span>練習中</span><strong>${ring.practicingPercent}%</strong></div>
     <div class="home-progress-key"><span class="home-progress-dot home-progress-dot-unstarted"></span><span>未着手</span><strong>${ring.unstartedPercent}%</strong></div>
     <div class="home-festival-label"><span class="home-progress-dot home-progress-dot-festival"></span><span>聖光祭まで</span><small>${FESTIVAL.dateLabel}</small></div>
    </div>
   </div>
  </section>
  <section class="quick-memory-home" aria-labelledby="quick-memory-home-title">
   <h2 id="quick-memory-home-title">${icon('zap')} 今覚える！</h2>
   <a class="quick-memory-home-link" href="#quick" aria-label="今覚える！：${esc(quickLine?.text||'出題可能なセリフはありません')}">
    <span class="quick-memory-home-text" lang="en">${esc(quickLine?.text||'出題可能なセリフはありません')}</span>${icon('chevron')}
   </a>
  </section>
  <div class="home-role-row"><label for="home-role">担当する役</label>${roleHTML()}</div>
  <section class="home-actions" aria-label="学習を始める">${button(last?'続きから読む':'台本を読む','read','primary','book')}${button('練習を始める','practice','secondary','play')}</section>
  ${sessions.length?`<section class="home-resume"><h2>練習の続き</h2>${sessions.map(([mode,session])=>`<button class="scene-link" data-action="practice"><span class="scene-link-text"><strong>${mode==='cloze'?'穴埋め練習':'音声練習'}</strong><small>${esc(sceneName(session.range?.scene||'all'))} · ${session.index+1}番目</small></span>${icon('chevron')}</button>`).join('')}</section>`:''}
  <section class="home-scenes"><div class="section-heading"><h2>幕・場面</h2></div><div class="scene-list">${data.scenes.map(scene=>`<button class="scene-link" data-scene="${esc(scene.id)}"><span class="scene-link-text"><strong>${esc(scene.title)}</strong></span>${icon('chevron')}</button>`).join('')}</div></section>
 </div></div>`;
 main.querySelector('[data-action=read]').onclick=()=>{if(!last)small.scene=active;save();location.hash='script';};
 main.querySelectorAll('[data-action=practice]').forEach(b=>b.onclick=()=>{location.hash='rehearse';});
 main.querySelector('#home-role').onchange=e=>changeRole(e.target.value);
 main.querySelector('[data-action=progress-details]').onclick=()=>showHomeProgressDetails(st);
 main.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{small.scene=b.dataset.scene;small.read={};save();location.hash='script';});
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
   <p class="subtle">GitHubに音声を配置すると自動で利用できます。アプリでの取り込みは不要です。</p>
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

async function activate(next){await storage.atomicPut([[`script:${next.id}`,next],['active-script',next.id]]);const enriched=await loadDramaturgy(storage,fetchData,next),contextual=await loadQuickContexts(storage,fetchData,enriched.data);data=contextual.data;loadState();refreshQuickOnLaunch();save();if(enriched.warning||contextual.warning)toast(enriched.warning||contextual.warning);}
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
  result.innerHTML=`<h3>読み込む内容</h3><p><strong>${esc(next.title)}</strong></p><div class="data-summary"><div><strong>${next.lines.length}</strong><span>セリフ</span></div><div><strong>${next.scenes.length}</strong><span>場面</span></div><div><strong>${Object.keys(next.dictionary).length}</strong><span>辞書項目</span></div></div>${next.warnings.length?`<p class="notice">${esc(next.warnings.join(' / '))}<br>未収録の項目は「未収録」と表示します。</p>`:''}<p class="subtle">${backup?'バックアップから設定・閲覧位置・練習の続きも復元します。':'同じIDの台本を更新しても、学習記録は引き継ぎます。'}</p><div style="margin-top:20px">${button(backup?'復元して開く':'この台本を使う','confirm-import','primary')}</div>`;
  result.querySelector('button').onclick=async()=>{try{
   if(backup){const existing=storage.loadSmall(`mt-progress:${next.id}`,{});for(const [id,p] of Object.entries(backup.progress||{})){if(!existing[id]||(p.updatedAt||0)>(existing[id].updatedAt||0))existing[id]=p;}storage.saveSmall(`mt-progress:${next.id}`,existing);storage.saveSmall(`mt-state:${next.id}`,{...defaults,...backup.settings});}
   await activate(next);const list=await storage.get('script-list')||[];if(!list.includes(next.id)){list.push(next.id);await storage.put('script-list',list);}await navigator.storage?.persist?.();closeSheet();location.hash='home';await render();toast(`セリフ${next.lines.length}件を読み込みました`);
  }catch(err){result.innerHTML=`<p class="notice error" role="alert">保存できませんでした。${esc(err.message)}</p>`;}};
 }catch(err){result.innerHTML=`<p class="notice error" role="alert">読み込めませんでした。${esc(err.message)}</p>`;}
};
function validateSaved(saved){const script={};for(const scene of saved.scenes||[])script[scene.id]={speeches:saved.lines.filter(l=>l.scene===scene.id)};return normalizeBundle({...saved,script});}
async function exportBackup(){const output={format:'mousetrap-backup-v1',exportedAt:new Date().toISOString(),data,settings:small,progress};downloadJSON(output,'mousetrap-backup.json');toast('バックアップを保存しました');}
function downloadJSON(v,name){const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

const INSTALL_AUDIO_CHOICE_KEY='mt-pwa-audio-offer-v1';
function offeredAudioChoice(){try{return localStorage.getItem(INSTALL_AUDIO_CHOICE_KEY);}catch{return null;}}
function rememberAudioChoice(value){try{localStorage.setItem(INSTALL_AUDIO_CHOICE_KEY,value);}catch{}}
async function refreshHeaderAppAction(){
 const trigger=app.querySelector('[data-action=home-app-action]');
 if(!trigger||!trigger.closest('[data-route=home]'))return;
 const epoch=++headerActionEpoch;
 if(!isInstalledPwa()&&!pwaJustInstalled){
  trigger.hidden=false;
  trigger.className='home-app-action is-install';
  trigger.innerHTML=icon('download')+'<span>インストール</span>';
  trigger.setAttribute('aria-label','アプリをインストール');
  return;
 }
 trigger.hidden=true;
 let complete=false;
 try{complete=(await offlineAudioStatus()).complete;}
 catch{
  if(offeredAudioChoice()==='saved'){
   try{
    const cache=await caches.open(OFFLINE_AUDIO_CACHE);
    const requests=await cache.keys();
    complete=requests.filter(req=>/\/audio\/lines\/.+\.mp3$/.test(req.url)).length===OFFLINE_AUDIO_TOTAL;
   }catch{}
  }
 }
 if(!trigger.isConnected||epoch!==headerActionEpoch)return;
 trigger.hidden=complete;
 if(complete)return;
 trigger.className='home-app-action is-audio';
 trigger.innerHTML=icon('download')+`<span>${isAudioDownloadRunning()?'保存中':'音声を保存'}</span>`;
 trigger.setAttribute('aria-label',isAudioDownloadRunning()?'オフライン音声の保存状況を確認':'オフライン音声を保存');
}
async function startOfflineAudioDownload(){
 try{void navigator.storage?.persist?.().catch(()=>{});}catch{/* storage persist is optional */}
 const html='<p>全1,164件の音声（約33MB）を端末に保存します。保存済みのファイルは再取得しません。</p>'+
  '<p class="subtle">通信が安定した環境で、完了までアプリを開いたままにしてください。中断した場合も、再度実行すると続きから保存できます。</p>'+
  '<div class="offline-download-progress"><progress id="audio-download-bar" max="1164" value="0"></progress>'+
  '<p id="audio-download-message" role="status" aria-live="polite">準備中…</p></div>'+
  '<div class="button-row"><button type="button" class="secondary" data-action="offline-close">閉じる</button>'+
  '<button type="button" class="primary" data-action="offline-retry" hidden>再開する</button></div>';
 const sheet=openSheet('音声をオフラインに保存',html,{setup:d=>{
  d.querySelector('[data-action=offline-close]').onclick=closeSheet;
  d.querySelector('[data-action=offline-retry]').onclick=startOfflineAudioDownload;
 }});
 const display=state=>{
  if(state.downloaded!==undefined){
   if(sheet.open&&sheet.querySelector('#audio-download-bar')){
    sheet.querySelector('#audio-download-bar').value=state.downloaded;
    sheet.querySelector('#audio-download-message').textContent=state.downloaded+' / '+state.total+' 件を保存済み';
   }
  }
  if(state.error&&sheet.open){
   sheet.querySelector('#audio-download-message').textContent=state.error;
   sheet.querySelector('[data-action=offline-retry]').hidden=false;
  }
 };
 try {
  const operation=downloadEntireAudio({onProgress:display});
  void refreshHeaderAppAction();
  const result=await operation;
  rememberAudioChoice('saved');
  void refreshHeaderAppAction();
  const message='全1,164件の音声を保存しました。オフラインでも音声を使えます。練習頑張りましょう！';
  if(sheet.open&&sheet.querySelector('#audio-download-message')){
   sheet.querySelector('#audio-download-message').textContent=message;
   sheet.querySelector('#audio-download-bar').value=result.total;
  } else toast(message);
 }catch(err){
  void refreshHeaderAppAction();
  if(sheet.open&&sheet.querySelector('#audio-download-message')){
   sheet.querySelector('#audio-download-message').textContent=err.message;
   sheet.querySelector('[data-action=offline-retry]').hidden=false;
  }else toast('音声保存を中断しました。ホームから再開できます。');
 }
}
let installPrompt,registration,updateManager;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('appinstalled',()=>{installPrompt=null;pwaJustInstalled=true;if(isInstalledPwa())greetInstalledDevice();void refreshHeaderAppAction();});
async function installApp(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else openSheet('ホーム画面に追加',`<p>Android / Chrome：ブラウザーのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。</p><div class="sheet-section"><p>iPhone / iPad：Safariの共有メニューから「ホーム画面に追加」を選びます。</p></div><div class="sheet-section"><p class="subtle">すでにインストール済みの場合は、そのまま使えます。ブラウザーによってインストール操作は異なります。</p></div>`);}
async function checkUpdate(){
 if(!registration||!updateManager){toast('更新機能を準備中です。ページを再読み込みしてください。');return;}
 const checked=await updateManager.check();
 if(!checked)toast('更新を確認できません。通信状態を確認してください。');
 else if(registration.waiting)toast('更新は準備済みです。次にアプリを開いたとき自動で適用します。');
 else toast('更新を確認しました。新しい版があれば自動で反映されます。');
}
window.addEventListener('hashchange',render);window.addEventListener('pageshow',event=>{if(event.persisted)refreshQuickOnResume();refreshFestivalCountdown();void refreshHeaderAppAction();});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){quickWasHidden=true;save();}else{if(quickWasHidden){quickWasHidden=false;refreshQuickOnResume();}refreshFestivalCountdown();void refreshHeaderAppAction();void refreshNotifications();}});
window.addEventListener('storage',e=>{if(e.key===`mt-progress:${data?.id}`){progress=storage.loadSmall(e.key,{});render();}if(e.key==='mt-notifications-read-v1'||e.key==='mt-welcome-installed-v1')updateNotificationBadge();});
window.addEventListener('offline',()=>toast('オフラインです。端末に保存した台本を使えます。'));
// Keep the same data object alive: reader/rehearsal components may already hold references.
function attachSupplement(target,field,result){
 if(data!==target)return;
 if(result.data?.[field])target[field]=result.data[field];
 if(result.warning)toast(result.warning);
}
function prepareSupplements(target){
 void loadDramaturgy(storage,fetchData,target)
  .then(result=>attachSupplement(target,'dramaturgy',result))
  .catch(()=>toast('解説を読み込めませんでした。'));
 void loadQuickContexts(storage,fetchData,target,{preferSaved:true})
  .then(result=>{
   attachSupplement(target,'quickContexts',result);
   // Cached context is usable immediately; refresh it without blocking the reader.
   if(result.fromCache&&navigator.onLine){
    setTimeout(()=>{if(data!==target)return;void loadQuickContexts(storage,fetchData,target)
     .then(next=>attachSupplement(target,'quickContexts',next)).catch(()=>{});},1200);
   }
  }).catch(()=>toast('状況説明を読み込めませんでした。'));
}
async function registerForUpdates(){
 if(!('serviceWorker'in navigator)||location.hostname==='terminal.local')return;
 try{
  updateManager=createUpdateManager({
   serviceWorker:navigator.serviceWorker,
   doc:document,
   win:window,
   beforeReload:()=>{save();return !saveFailed;},
   reload:()=>location.reload()
  });
  registration=await updateManager.start();
  if(registration&&isInstalledPwa()){greetInstalledDevice();void refreshHeaderAppAction();}
 }catch{ /* A failed update check must not replace an already usable app. */ }
}
try{
 const status=document.querySelector('.boot-status');
 if(status)status.textContent='台本を準備しています';
 const startup=await loadStartupScript(storage,fetchData);
 data=startup.data;
 loadState();refreshQuickOnLaunch();
 await render();
 window.setInterval(refreshFestivalCountdown,60_000);
 void refreshNotifications();
 if(startup.warning)toast(startup.warning);
 prepareSupplements(data);
 void registerForUpdates();
}catch(err){
 app.innerHTML=`<div class="page"><h1>アプリを開けませんでした</h1><p class="notice error" style="margin:24px 0">${esc(err.message)}</p><p>ブラウザーのストレージが利用できるか確認してください。プライベートブラウズでは保存が制限されることがあります。</p><button class="primary" onclick="location.reload()">再試行</button></div>`;
}
