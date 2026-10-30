import {normalizeBundle} from './data.js';

export const BUNDLED_SCRIPT={id:'mousetrap-private',revision:'2026-10-30-builtin-1',url:'./data/mousetrap.json',lines:1164};

// Keep stable script/line IDs: learning records and recordings use those keys.
// Old sample selections migrate to the actual script; no sample is shipped.
export async function loadStartupScript(storage,fetchJSON){
 const spec=BUNDLED_SCRIPT;
 const active=await storage.get('active-script');
 const current=active?await storage.get(`script:${active}`):null;
 const revision=await storage.get('bundled-script-revision');
 let bundled=await storage.get(`script:${spec.id}`),warning='';
 const useDefault=!current||current.sample;
 const entries=[];
 if(revision!==spec.revision||!bundled){
  try{
   const next=normalizeBundle(await fetchJSON(spec.url));
   if(next.id!==spec.id||next.sample||next.lines.length!==spec.lines||next.warnings.length)throw Error('収録台本の対応を確認できません。');
   bundled=next;
   entries.push([`script:${spec.id}`,next],['bundled-script-revision',spec.revision]);
  }catch(err){
   if(useDefault&&!bundled)throw Error(`収録台本を読み込めませんでした。通信した状態で再試行してください。${err.message}`);
   warning='収録台本の更新を確認できませんでした。保存済みの台本を開きます。';
  }
 }
 if(bundled){
  const previousList=await storage.get('script-list')||[];
  const list=previousList.filter(id=>id!=='open-sample-v1');
  if(!list.includes(spec.id))list.push(spec.id);
  if(list.length!==previousList.length||list.some((id,i)=>id!==previousList[i]))entries.push(['script-list',list]);
  if(useDefault)entries.push(['active-script',spec.id]);
 }
 if(entries.length)await storage.atomicPut(entries);
 return {data:useDefault||current?.id===spec.id?bundled:current,warning};
}
