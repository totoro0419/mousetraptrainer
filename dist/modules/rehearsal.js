import {sceneName,tokenize,lookupDictionary,plain} from './data.js';
import {icon,esc,button,openSheet,enhanceSelects} from './ui.js';
import {selectRange} from './session.js';
import {mountReader,showAnalysis,showDictionary} from './reader.js';
import {audioStatus} from './audio-controls.js';
import {speakingSeconds} from './audio-session.js';

export function mountRehearsal(main,ctx){
 const dispose=mountReader(main,ctx);
 openPractice(ctx);
 return ()=>{ctx.audio.pause();dispose();};
}

export function openPractice(ctx,{fromLine=null,resumeActive=false}={}){
 const s=ctx.audio,{small,data}=ctx;
 if(resumeActive&&s.mode==='practice'&&s.line){practiceSheet(ctx);return;}
 s.pause();
 const range=fromLine?{scene:fromLine.scene,from:fromLine.ordinal,to:data.lines.filter(l=>l.scene===fromLine.scene).length}:{...small.range};
 openSheet('セリフの練習',`<div class="practice-chooser"><div class="setting-row"><label for="practice-role">担当する役</label><select id="practice-role" data-role-menu="true">${ctx.roles().map(r=>`<option ${r===small.role?'selected':''}>${esc(r)}</option>`).join('')}</select></div><div class="range-form"><label class="full">幕・場面<select id="range-scene"><option value="all">すべての場面</option>${data.scenes.map(scene=>`<option value="${esc(scene.id)}">${esc(scene.title)}</option>`).join('')}</select></label><label>開始位置<input type="number" id="range-from" min="1" value="${range.from||1}" inputmode="numeric"></label><label>終了位置<input type="number" id="range-to" min="1" value="${range.to||data.lines.length}" inputmode="numeric"></label></div><p id="range-note" class="subtle"></p><p id="range-error" class="notice error" hidden role="alert"></p><div class="mode-options"><button class="mode-option" data-mode="audio">${icon('audio')}<span><strong>音声で稽古する</strong><small>相手役を聴き、自分のセリフを話す</small></span>${icon('chevron')}</button><button class="mode-option" data-mode="cloze">${icon('book')}<span><strong>穴埋め練習</strong><small>相手のセリフを手掛かりに思い出す</small></span>${icon('chevron')}</button></div>${Object.entries(small.sessions||{}).filter(([,v])=>v.role===small.role).map(([mode,v])=>`<button class="scene-link" data-resume="${mode}"><span class="scene-link-text">${mode==='audio'?'音声練習':'穴埋め'}の続き<small>${esc(sceneName(v.range.scene))} · ${v.index+1}番目</small></span>${icon('arrow')}</button>`).join('')}</div>`,{setup:holder=>{
  const scene=holder.querySelector('#range-scene'),from=holder.querySelector('#range-from'),to=holder.querySelector('#range-to');scene.value=range.scene||'all';
  const update=(reset=false)=>{const list=data.lines.filter(l=>scene.value==='all'||l.scene===scene.value);if(reset){from.value=1;to.value=list.length;}from.max=to.max=list.length;const next={scene:scene.value,from:+from.value,to:+to.value};small.range=next;ctx.save();const selected=list.slice(+from.value-1,+to.value);holder.querySelector('#range-note').textContent=`${selected.length}件 · 自分のセリフ ${selected.filter(l=>l.speaker===small.role).length}件`;return next;};
  scene.onchange=()=>update(true);from.oninput=to.oninput=()=>update();if(!range.to)to.value=data.lines.filter(l=>scene.value==='all'||l.scene===scene.value).length;update();
  holder.querySelector('#practice-role').onchange=async e=>{await ctx.changeRole(e.target.value);openPractice(ctx);};
  const start=(mode,range,resume=false)=>{try{selectRange(data,range);s.startPractice(mode,range,{resume});practiceSheet(ctx);}catch(err){const n=holder.querySelector('#range-error');n.hidden=false;n.textContent=err.message;}};
  holder.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>start(b.dataset.mode,update()));
  holder.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>start(b.dataset.resume,small.sessions[b.dataset.resume].range,true));
  enhanceSelects(holder);
 }});
}

function practiceSheet(ctx){
 const s=ctx.audio;
 openSheet(s.practiceMode==='audio'?'音声練習':'穴埋め練習',`<div class="practice-panel"><div class="practice-topline"><span class="subtle practice-counter"></span><button class="text-button" data-action="choose-range">範囲を変更</button></div><div class="practice-body"><p class="practice-status" role="status"></p><h3 class="practice-speaker"></h3><div class="practice-text" lang="en"></div><p class="notice error practice-error" hidden role="alert"></p></div><div class="practice-actions"><button class="icon-button" data-action="previous" aria-label="前のセリフ">${icon('back')}</button><button class="secondary" data-action="reveal">正解を表示</button><button class="primary" data-action="advance">次へ ${icon('arrow')}</button></div><div class="practice-tools"><button class="text-button" data-action="transport">再生</button><button class="text-button" data-action="model">模範音声</button><button class="text-button" data-action="analysis">文章詳細</button><button class="text-button" data-action="mastered">覚えた</button><button class="text-button" data-action="review">要復習</button></div><details class="practice-options"><summary>練習設定</summary><div class="audio-options-body"><label>再生速度<select data-practice="rate">${[.75,1,1.25,1.5].map(r=>`<option value="${r}">${r}×</option>`).join('')}</select></label><label class="toggle-row"><span>自分のセリフを表示</span><input type="checkbox" data-practice="showOwn"></label><label class="toggle-row"><span>自分の番も自動で進む</span><input type="checkbox" data-practice="auto"></label><label>発話の余裕（秒）<input type="number" data-practice="extra" min="0" max="60" step="1"></label><label class="toggle-row"><span>範囲を繰り返す</span><input type="checkbox" data-practice="repeat"></label><p class="subtle practice-wait"></p></div></details><div class="practice-complete" hidden><h3>練習が終わりました</h3><p class="subtle">同じ範囲をもう一度練習できます。</p><div class="button-row">${button('もう一度','again','primary','refresh')}${button('範囲を変更','choose-again','secondary')}</div></div></div>`,{
  onclose:()=>s.pause(),onrestore:()=>s.emit(false),setup:sheet=>{
   const panel=sheet.querySelector('.practice-panel'),q=action=>panel.querySelector(`[data-action="${action}"]`);
   q('choose-range').onclick=q('choose-again').onclick=()=>{s.pause();openPractice(ctx);};
   q('previous').onclick=()=>s.step(-1);q('advance').onclick=()=>s.step(1,true);q('reveal').onclick=()=>s.reveal();
   q('transport').onclick=()=>{if(s.phase==='own'&&s.timer)s.pause();else s.toggle();};
   q('model').onclick=()=>s.replay();q('analysis').onclick=()=>{s.pause();showAnalysis(s.line,ctx,{nested:true});};
   q('mastered').onclick=()=>ctx.setProgress(s.line.id,{...ctx.progress[s.line.id],level:2,updatedAt:Date.now()});
   q('review').onclick=()=>ctx.setProgress(s.line.id,{...ctx.progress[s.line.id],review:!ctx.progress[s.line.id]?.review,updatedAt:Date.now()});
   q('again').onclick=()=>s.startPractice(s.practiceMode,s.range);
   panel.querySelectorAll('[data-practice]').forEach(input=>{const name=input.dataset.practice;if(name==='rate'){input.value=ctx.small.rate;input.onchange=e=>s.setRate(+e.target.value);}else{input[input.type==='checkbox'?'checked':'value']=s.prefs[name];input.onchange=()=>s.setPrefs({[name]:input.type==='checkbox'?input.checked:Math.max(0,Math.min(60,+input.value||0))});}});
   let painted='';
   const unsubscribe=s.subscribe(()=>{
    if(!panel.isConnected)return;
    const complete=s.phase==='complete';panel.querySelector('.practice-complete').hidden=!complete;
    for(const selector of ['.practice-body','.practice-actions','.practice-tools','.practice-options'])panel.querySelector(selector).hidden=complete;
    if(complete)return;
    const line=s.line,own=line.speaker===s.role,show=!own||s.revealed||s.prefs.showOwn;
    panel.querySelector('.practice-counter').textContent=`${s.index+1} / ${s.lines.length} · ${s.role}`;
    panel.querySelector('.practice-status').textContent=audioStatus(s);
    panel.querySelector('.practice-speaker').textContent=line.speaker;
    const text=panel.querySelector('.practice-text'),key=`${line.id}:${show}`;
    if(key!==painted){painted=key;text.replaceChildren();
     if(show){for(const token of tokenize(line.text,ctx.data.vocabulary[line.id]||[])){const d=lookupDictionary(ctx.data.dictionary,token);if(plain(token.entry?.meaning)||plain(d?.coreMeaning)||plain(d?.contextMeaning)){const b=document.createElement('button');b.className='word';b.textContent=token.text;b.setAttribute('aria-label',`${token.text} の意味`);b.onclick=()=>{s.pause();showDictionary(line,token,ctx,{nested:true});};text.append(b);}else text.append(document.createTextNode(token.text));}}
     else text.textContent='自分のセリフを声に出してください。';
    }
    q('reveal').hidden=!own;q('reveal').textContent=show?'セリフを隠す':'正解を表示';q('previous').disabled=s.index===0;
    q('transport').hidden=s.practiceMode==='cloze'||(own&&!s.prefs.auto);q('transport').textContent=['playing','loading'].includes(s.phase)||(own&&s.timer)?'一時停止':s.phase==='error'?'再試行':'再開';
    q('model').hidden=!own||s.practiceMode!=='audio';
    const e=panel.querySelector('.practice-error');e.hidden=!['error','missing'].includes(s.phase);e.textContent=s.message;
    panel.querySelector('.practice-wait').textContent=s.prefs.auto?`自分の番は音声の長さを基準に約${speakingSeconds(s.duration,ctx.small.rate,+s.prefs.extra).toFixed(1)}秒。詳細を開くと停止します。`:'自分の番で停止します。「次へ」で進みます。';
   });
   const key=e=>{if(!panel.isConnected||e.target.closest('button,input,select,textarea,summary,a'))return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(s.line?.speaker===s.role&&!s.revealed)s.reveal();else s.step(1,true);}else if(e.key==='ArrowLeft'){e.preventDefault();s.step(-1);}};
   window.addEventListener('keydown',key);return()=>{unsubscribe();window.removeEventListener('keydown',key);};
  }
 });
}
