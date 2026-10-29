import * as storage from './storage.js';
import {openSheet,esc,button,toast,closeSheet} from './ui.js';
const supported=/\.(mp3|m4a|ogg|wav|webm|aac|flac)$/i;
export function audioEntries(files,manifest,validIds){
 const byName=new Map(files.map(f=>[f.name,f]));const clips=manifest?.clips||{};const output=[],used=new Set();
 for(const [id,spec] of Object.entries(clips)){
  if(!validIds.has(id))throw Error(`音声マップに存在しない発話IDがあります: ${id}`);
  const s=typeof spec==='string'?{file:spec}:spec;if(!s||typeof s.file!=='string'||!byName.has(s.file))throw Error(`${id}: 音声ファイル ${s?.file||''} がありません。`);
  const start=s.start??0,end=s.end??null;if(!Number.isFinite(start)||start<0||(end!==null&&(!Number.isFinite(end)||end<=start)))throw Error(`${id}: 再生区間が不正です。`);
  output.push([id,{blob:byName.get(s.file),name:s.file,start,end}]);used.add(s.file);
 }
 for(const f of files){const id=f.name.replace(/\.[^.]+$/,'');if(!used.has(f.name)&&validIds.has(id)){output.push([id,{blob:f,name:f.name,start:0,end:null}]);used.add(f.name);}}
 return {output,unused:files.filter(f=>!used.has(f.name)).map(f=>f.name)};
}
export const getClip=(dataset,id)=>storage.get(`audio:${dataset}:${id}`);
export async function openAudioImport(ctx){
 openSheet('録音音声を追加',`<p>ファイル名を <strong>発話ID.mp3</strong> などにすると、自動で対応付けます。複数のファイルをまとめて選べます。</p><p class="subtle" style="margin-top:12px">MP3 / M4A / OGG / WAV / WebM / AAC / FLAC。1ファイル100MB、合計500MB以内。音声マップJSONも同時に選べます。</p><div style="margin-top:20px">${button('音声ファイルを選ぶ','pick-audio','primary','audio')}</div><div id="audio-import-result" class="sheet-section"><h3>1つの録音を区切って使う場合</h3><p class="subtle">clips の各発話IDに file・start・end（秒）を指定する音声マップを追加できます。手順はリポジトリの docs/audio.md を参照。</p></div>`,{setup:d=>{d.querySelector('[data-action=pick-audio]').onclick=()=>document.querySelector('#audio-files').click();}});
 const input=document.querySelector('#audio-files');input.onchange=async e=>{const chosen=[...e.target.files];e.target.value='';const result=document.querySelector('#audio-import-result');if(!result||!chosen.length)return;
 try{let manifest=null,files=[],sum=0;for(const f of chosen){if(f.name.endsWith('.json')){if(manifest)throw Error('音声マップは1つだけ選んでください。');if(f.size>2000000)throw Error('音声マップが大きすぎます。');manifest=JSON.parse(await f.text());}else{if(!supported.test(f.name))throw Error(`未対応の音声形式: ${f.name}`);if(f.size>100000000)throw Error('音声は1ファイル100MB以内にしてください。');sum+=f.size;files.push(f);}}if(sum>500000000)throw Error('音声の合計を500MB以内にしてください。');
 const {output,unused}=audioEntries(files,manifest,new Set(ctx.data.lines.map(l=>l.id)));if(!output.length)throw Error('対応する発話がありません。ファイル名か音声マップを確認してください。');
 result.innerHTML=`<p><strong>${output.length} 発話</strong>に音声を対応付けできます。</p><p class="subtle">同じ発話の既存音声は置き換わります。ほかの発話の音声は保持します。</p>${unused.length?`<p class="notice" style="margin-top:12px">未対応の${unused.length}ファイルは保存しません: ${esc(unused.join(', '))}</p>`:''}<div style="margin-top:18px">${button('この対応で保存','save-audio','primary')}</div>`;
 result.querySelector('button').onclick=async()=>{try{await storage.atomicPut(output.map(([id,clip])=>[`audio:${ctx.data.id}:${id}`,clip]));closeSheet();toast(`${output.length}発話の音声を端末に保存しました`);}catch(err){result.innerHTML=`<p class="notice error" role="alert">音声を保存できませんでした。端末の空き容量を確認してください。${esc(err.message)}</p>`;}};
 }catch(err){result.innerHTML=`<p class="notice error" role="alert">${esc(err.message)}</p>`;}};
}
export class AudioPlayer{
 constructor(factory=()=>new Audio()){this.factory=factory;this.audio=null;this.url=null;this.token=0;}
 stop(){this.token++;if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load?.();this.audio=null;}if(this.url){URL.revokeObjectURL(this.url);this.url=null;}}
 pause(){this.audio?.pause();}
 async resume(){if(!this.audio)throw Error('再生する音声がありません。');await this.audio.play();}
 async play(clip,{rate=1,onended=()=>{},onerror=()=>{}}={}){
  this.stop();const token=this.token;const a=this.factory();this.audio=a;this.url=URL.createObjectURL(clip.blob);a.preload='auto';a.playbackRate=rate;a.src=this.url;
  let done=false;const finish=()=>{if(token!==this.token||done)return;done=true;a.pause();onended();};
  a.onended=finish;a.onerror=()=>{if(token===this.token&&!done){done=true;onerror(Error('音声を再生できません。形式・ファイルの破損を確認してください。'));}};
  a.onloadedmetadata=()=>{if(token!==this.token)return;if(clip.start>=a.duration||(clip.end!==null&&clip.end>a.duration+.2)){a.pause();done=true;onerror(Error('音声の再生区間がファイルの長さを超えています。'));return;}a.currentTime=clip.start||0;};
  a.ontimeupdate=()=>{if(clip.end!==null&&a.currentTime>=clip.end)finish();};
  try{await a.play();}catch(err){if(token===this.token){a.pause();throw err;}}
 }
}
