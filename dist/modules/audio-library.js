import {scriptFingerprint} from './dramaturgy.js';
import {getClip} from './audio.js';

let pending;
export async function loadAudioManifest(data,fetcher=fetch){
 if(data.id!=='mousetrap-private')return null;
 if(!pending)pending=fetcher(new URL('../data/audio-manifest.json',import.meta.url)).then(async response=>{
  if(!response.ok)throw Error('音声一覧を取得できません。通信を確認して再試行してください。');
  return response.json();
 }).catch(err=>{pending=null;throw err;});
 const manifest=await pending;
 if(manifest.datasetId!==data.id||manifest.total!==data.lines.length||manifest.sourceFingerprint!==await scriptFingerprint(data))return null;
 const map=new Map(manifest.clips.map(c=>[c.id,c]));
 if(map.size!==data.lines.length||data.lines.some((l,i)=>manifest.clips[i]?.id!==l.id||map.get(l.id)?.speaker!==l.speaker))throw Error('音声と台本の対応を確認できません。');
 return map;
}

export function bundledClip(entry){
 if(!entry||!/^audio\/lines\/[a-z0-9-]+\/[a-z0-9-]+\.mp3$/.test(entry.file))return null;
 return {...entry,url:new URL('../'+entry.file,import.meta.url).href,start:0,end:null};
}

export async function resolveClip(data,id,manifest){
 // User imports remain authoritative for this dataset; never replace a learner's recording.
 const local=await getClip(data.id,id);
 if(local)return local;
 const map=manifest??await loadAudioManifest(data);
 return bundledClip(map?.get(id));
}

// One metadata-only media element. Replacing it releases the previous prefetch.
export class NextClipPreloader{
 constructor(factory=()=>new Audio()){this.factory=factory;this.audio=null;this.id=null;}
 set(entry){
  if(this.id===entry?.id)return;
  this.clear();const clip=bundledClip(entry);if(!clip)return;
  this.id=entry.id;this.audio=this.factory();this.audio.preload='auto';this.audio.src=clip.url;this.audio.load?.();
 }
 clear(){if(this.audio){this.audio.removeAttribute('src');this.audio.load?.();}this.audio=null;this.id=null;}
}
