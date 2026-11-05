import {normalizeBundle} from './data.js';

export const BUNDLED_SCRIPT={id:'mousetrap-private',revision:'2026-11-05-directions-ja-450',url:'./data/mousetrap.json',lines:1164};


// Extra glossaries supplement, never overwrite, the 578 original dictionary entries.
export const DICTIONARY_ADDONS=['./data/dictionary-nouns.ja.json','./data/dictionary-general.ja.json'];
export function mergeDictionaryEntries(data,packages){
 const originalEntries=data.dictionary||{};
 const originalKeys=new Set(Object.keys(originalEntries).map(key=>key.toLowerCase()));
 const dictionary={...originalEntries};
 for(const pkg of packages){
  if(pkg?.version!==1||!pkg.entries||typeof pkg.entries!=='object'||Array.isArray(pkg.entries))throw Error('追加辞書の形式が正しくありません。');
  for(const [rawKey,item] of Object.entries(pkg.entries)){
   const key=rawKey.toLowerCase();
   if(!/^[a-z][a-z ’'\-]*$/.test(key)||!item||typeof item.coreMeaning!=='string'||!item.coreMeaning.trim()||typeof item.pos!=='string')throw Error('追加辞書の項目が不正です: '+rawKey);
   if(originalKeys.has(key))continue;
   if(dictionary[key]){
    const previous=dictionary[key];
    dictionary[key]={
     ...previous,
     pos:[...new Set([...(previous.pos||'').split('・'),...(item.pos||'').split('・')])].join('・'),
     coreMeaning:previous.coreMeaning===item.coreMeaning?previous.coreMeaning:previous.coreMeaning+'／'+item.coreMeaning,
     contextMeaning:previous.contextMeaning===item.contextMeaning?previous.contextMeaning:previous.contextMeaning+'／'+item.contextMeaning,
     tags:[...new Set([...(previous.tags||[]),...(item.tags||[])])]
    };
   }else dictionary[key]={...item};
  }
 }
 return {...data,dictionary};
}

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
   const [raw,...additions]=await Promise.all([fetchJSON(spec.url),...DICTIONARY_ADDONS.map(url=>fetchJSON(url))]);
   const next=mergeDictionaryEntries(normalizeBundle(raw),additions);
   if(Object.keys(next.dictionary).length<Object.keys(raw.dictionary||{}).length*2)throw Error('追加辞書が元の2倍に達していません。');
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
