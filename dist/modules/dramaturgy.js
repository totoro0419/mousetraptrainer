// A versioned sidecar: never rewrite script IDs or the learner's stored records.
export const DRAMATURGY={
 id:'mousetrap-private',
 revision:'492b0822db008d4cb126f87410701a74146660bc991abfd8b42b9b302c5cbc39',
 contentFingerprint:'18cb3f680796f3e712eed86b85d8723e001af9dbd4d4b5ff40aaf461062ffa8b',
 sourceFingerprint:'7704be159524eedd2c32bd9b3c6cfc29cb18e2d7b498ec6fbfa8ce041d026f5f',
 url:'./data/mousetrap-dramaturgy.ja.json',
 key:'dramaturgy:mousetrap-private'
};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const strings=new Set(['explanation','premise','cause','emotion','intention','subtext','spoiler','acting']);
const arrays=new Set(['devices','relatedLineIds']);
// WebCrypto needs a secure context. Keep local/offline HTTP previews functional too.
export function sha256Bytes(bytes){
 const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=0x80;
 const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(padded.length-4,(bytes.length*8)>>>0);
 const rotate=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
 for(let offset=0;offset<padded.length;offset+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
  for(let i=16;i<64;i++){
   const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;
  }
  let [a,b,c,d,e,f,g,j]=h;
  for(let i=0;i<64;i++){
   const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+w[i])>>>0;
   const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  for(const [i,n] of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+n)>>>0;
 }
 return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export async function fingerprint(value){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 if(typeof crypto!=='undefined'&&crypto.subtle)return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return sha256Bytes(bytes);
}
export async function scriptFingerprint(data){
 return fingerprint(data.lines.map(l=>[l.id,l.speaker,l.text]));
}
export function validateDramaturgyEntries(entries,data){
 const ids=data.lines.map(l=>l.id),idSet=new Set(ids);
 if(!record(entries)||JSON.stringify(Object.keys(entries))!==JSON.stringify(ids))throw Error('解説の発話IDが台本と一致しません。');
 for(const [id,entry] of Object.entries(entries)){
  if(!record(entry)||typeof entry.explanation!=='string'||!entry.explanation.trim())throw Error('セリフの解説がありません。');
  for(const [field,value] of Object.entries(entry)){
   if(strings.has(field)){
    if(typeof value!=='string'||!value.trim())throw Error('解説の文章形式が不正です。');
   }else if(arrays.has(field)){
    if(!Array.isArray(value)||!value.length||value.some(v=>typeof v!=='string'||!v.trim())||new Set(value).size!==value.length)throw Error('解説の補足形式が不正です。');
    if(field==='relatedLineIds'&&value.some(ref=>!idSet.has(ref)||ref===id))throw Error('解説の参照先が不正です。');
   }else throw Error('解説の項目が不正です。');
  }
 }
 return entries;
}
export async function loadDramaturgy(storage,fetchJSON,data){
 // Matching IDs alone are insufficient: an imported/edited script may reuse them.
 if(data.id!==DRAMATURGY.id||data.lines.length!==1164||await scriptFingerprint(data)!==DRAMATURGY.sourceFingerprint)return {data,warning:''};
 let saved;
 try{
  saved=await storage.get(DRAMATURGY.key);
  if(saved){
   validateDramaturgyEntries(saved.entries,data);
   if(saved.revision===DRAMATURGY.revision&&await fingerprint(saved.entries)!==DRAMATURGY.contentFingerprint)saved=null;
  }
 }catch{saved=null;}
 if(saved?.revision===DRAMATURGY.revision)return {data:{...data,dramaturgy:saved.entries},warning:''};
 let entries;
 try{
  entries=validateDramaturgyEntries(await fetchJSON(DRAMATURGY.url),data);
  if(await fingerprint(entries)!==DRAMATURGY.contentFingerprint)throw Error('解説の版が一致しません。');
 }
 catch{
  return {data:saved?{...data,dramaturgy:saved.entries}:data,warning:saved?'セリフの解説を更新できませんでした。保存済みの解説を表示します。':'セリフの解説を取得できませんでした。通信できる状態で再読み込みしてください。'};
 }
 let warning='';
 try{await storage.atomicPut([[DRAMATURGY.key,{revision:DRAMATURGY.revision,entries}]]);}
 catch{warning='セリフの解説を端末に保存できませんでした。現在の画面では表示できます。';}
 return {data:{...data,dramaturgy:entries},warning};
}
