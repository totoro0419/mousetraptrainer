import {scriptFingerprint,DRAMATURGY} from './dramaturgy.js';

// A standalone sidecar for objective scene/lead-in context, separate from
// psychological and acting notes. Never attach to a different script reusing IDs.
export const QUICK_CONTEXT={
 id:'mousetrap-private',revision:1,
 url:'./data/mousetrap-context.ja.json',
 key:'quick-context:mousetrap-private:v1',
 sourceFingerprint:DRAMATURGY.sourceFingerprint
};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateQuickContexts(bundle,data){
 if(!record(bundle)||bundle.version!==QUICK_CONTEXT.revision||bundle.scriptId!==QUICK_CONTEXT.id||
    bundle.sourceFingerprint!==QUICK_CONTEXT.sourceFingerprint||!record(bundle.entries))
  throw Error('状況データの形式・台本版が一致しません。');
 const ids=data.lines.map(line=>line.id);
 if(JSON.stringify(Object.keys(bundle.entries))!==JSON.stringify(ids))
  throw Error('状況データの発話IDが台本と一致しません。');
 const map=new Map(data.lines.map((line,index)=>[line.id,index]));
 for(const [id,entry] of Object.entries(bundle.entries)){
  if(!record(entry)||['setting','phase','cue','situation'].some(field=>typeof entry[field]!=='string'||!entry[field].trim()))
   throw Error('状況データの本文が不足しています: '+id);
  const n=map.get(id),line=data.lines[n];
  if(entry.scene!==line.scene)throw Error('状況データの場面が一致しません: '+id);
  const previous=data.lines[n-1];
  const expected=previous?.scene===line.scene?previous.id:null;
  if(entry.previousLineId!==expected)throw Error('状況データの前後関係が一致しません: '+id);
 }
 return bundle.entries;
}
export async function loadQuickContexts(storage,fetchJSON,data){
 if(data.id!==QUICK_CONTEXT.id||data.lines.length!==1164||
    await scriptFingerprint(data)!==QUICK_CONTEXT.sourceFingerprint)
  return {data,warning:''};
 let bundle;
 try{
  bundle=await fetchJSON(QUICK_CONTEXT.url);
  const entries=validateQuickContexts(bundle,data);
  try{await storage.put(QUICK_CONTEXT.key,bundle);}catch{}
  return {data:{...data,quickContexts:entries},warning:''};
 }catch{
  try{
   bundle=await storage.get(QUICK_CONTEXT.key);
   const entries=validateQuickContexts(bundle,data);
   return {data:{...data,quickContexts:entries},warning:'状況データを更新できませんでした。保存済みの情報を表示します。'};
  }catch{
   return {data,warning:'状況データを読み込めませんでした。接続を確認して再読み込みしてください。'};
  }
 }
}
