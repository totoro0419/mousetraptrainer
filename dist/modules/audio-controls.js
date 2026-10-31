import {icon} from './ui.js';

export const audioStatus=s=>({idle:'音声を聴く',loading:'読み込み中…',playing:'再生中',paused:'一時停止',ended:'再生終了',own:s.waitPaused?'あなたの番 · 停止中':'あなたの番',missing:'音声なし',error:'再生できません',cue:'セリフを確認',complete:'練習終了'}[s.phase]||'音声を聴く');
export function audioControlsHTML(){return `<div class="line-audio"><div class="audio-transport"><button class="icon-button" data-audio="previous" aria-label="前のセリフ">${icon('back')}</button><button class="primary audio-toggle" data-audio="toggle">${icon('play')}<span>再生</span></button><button class="icon-button" data-audio="replay" aria-label="最初から再生">${icon('refresh')}</button><button class="icon-button" data-audio="next" aria-label="次のセリフ">${icon('arrow')}</button></div><p class="subtle audio-status" role="status"></p><p class="notice error audio-error" role="alert" hidden></p><details class="audio-options"><summary>再生設定</summary><div class="audio-options-body"><label>速度<select data-audio="rate">${[.75,1,1.25,1.5].map(r=>`<option value="${r}">${r}×</option>`).join('')}</select></label><label class="toggle-row"><span>連続再生</span><input type="checkbox" data-audio="continuous"></label><label class="toggle-row"><span>再生位置へスクロール</span><input type="checkbox" data-audio="follow"></label><label class="seek-label">再生位置<input type="range" data-audio="seek" min="0" max="1" step=".1" value="0"><output data-audio="time">0:00 / 0:00</output></label></div></details></div>`;}
const clock=v=>`${Math.floor((v||0)/60)}:${Math.floor((v||0)%60).toString().padStart(2,'0')}`;

export function bindAudioControls(root,ctx,{line=null,onNavigate,onPlay}={}){
 const s=ctx.audio,q=n=>root.querySelector(`[data-audio="${n}"]`);
 const ensure=()=>{if(line&&(s.mode!=='read'||s.line?.id!==line.id))s.select(line);};
 q('toggle').onclick=()=>{ensure();onPlay?.();s.toggle();};
 q('replay').onclick=()=>{ensure();onPlay?.();s.replay();};
 for(const [action,delta] of [['previous',-1],['next',1]])q(action).onclick=()=>{ensure();s.step(delta,false);onNavigate?.(s.line);};
 q('rate').value=ctx.small.rate;q('rate').onchange=e=>s.setRate(+e.target.value);
 q('continuous').onchange=e=>{s.continuous=e.target.checked;s.emit();};
 q('follow').onchange=e=>{s.follow=e.target.checked;s.emit();};
 q('seek').oninput=e=>{ensure();s.seek(+e.target.value);};
 return s.subscribe(()=>{
  if(!root.isConnected)return;
  const selected=!line||s.line?.id===line.id,active=selected&&['playing','loading'].includes(s.phase);
  q('toggle').innerHTML=icon(active?'pause':'play')+`<span>${active?'一時停止':selected&&s.phase==='error'?'再試行':selected&&s.phase==='paused'?'再開':'再生'}</span>`;
  root.querySelector('.audio-status').textContent=selected?audioStatus(s):'このセリフを聴く';
  const error=root.querySelector('.audio-error');error.hidden=!selected||!['error','missing'].includes(s.phase);error.textContent=s.message;
  q('rate').value=ctx.small.rate;q('continuous').checked=s.continuous;q('follow').checked=s.follow;
  q('seek').max=selected?s.duration||1:1;q('seek').value=selected?s.position:0;
  q('time').textContent=selected?`${clock(s.position)} / ${clock(s.duration)}`:'0:00 / 0:00';
  q('previous').disabled=(line||s.line)?.index===0;
  q('next').disabled=(line||s.line)?.index===ctx.data.lines.length-1;
  root.querySelector('[data-audio=rate]')?.closest('label').querySelector('.app-select-value')?.replaceChildren(document.createTextNode(ctx.small.rate+'×'));
 });
}
