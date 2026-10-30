import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const DATA_URL=new URL('../dist/data/mousetrap-dramaturgy.ja.json',import.meta.url);
export const SOURCE_URL=new URL('../dist/data/mousetrap.json',import.meta.url);
export const SOURCE_SHA256='022dc48dd68c85773e9ce8307a7d3f1e2a3bceafc20a4a9b8db83e472a81a7b6';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
const stringFields=new Set(['explanation','premise','cause','emotion','intention','subtext','spoiler','acting']);
const arrayFields=new Set(['devices','relatedLineIds']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

// JSON.parse alone silently accepts duplicate keys. Inspect decoded keys at every object depth.
export function parseUniqueJson(text){
 const value=JSON.parse(text),stack=[];
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='{'||c==='[')stack.push(c==='{'?new Set():null);
  else if(c==='}'||c===']')stack.pop();
  else if(c==='"'){
   const start=i++;
   for(;i<text.length;i++){
    if(text[i]==='\\'){i++;continue;}
    if(text[i]==='"')break;
   }
   let next=i+1;while(/\s/.test(text[next]||'')&&next<text.length)next++;
   if(text[next]===':'){
    const key=JSON.parse(text.slice(start,i+1)),keys=stack.at(-1);
    if(keys?.has(key))throw Error(`Duplicate JSON key: ${key}`);
    keys?.add(key);
   }
  }
 }
 return value;
}

export function validateDramaturgy(source,data){
 const errors=[],warnings=[],fields={},scenes={},seenExplanations=new Map();
 if(!record(data))return {errors:['Dataset root must be an ID-keyed object'],warnings};
 const lines=Object.entries(source.script).flatMap(([scene,v])=>v.speeches.map(s=>({...s,scene})));
 const ids=lines.map(s=>s.id),idSet=new Set(ids),keys=Object.keys(data);
 if(lines.length!==1164||idSet.size!==1164)errors.push('Source must contain exactly 1164 unique speech IDs');
 if(JSON.stringify(keys)!==JSON.stringify(ids))errors.push('Dataset IDs or insertion order differ from source');
 const byId=new Map(lines.map(s=>[s.id,s]));let referenceCount=0;
 for(const [id,entry] of Object.entries(data)){
  if(!idSet.has(id)){errors.push(`${id}: unknown speech ID`);continue;}
  if(!record(entry)){errors.push(`${id}: entry must be an object`);continue;}
  scenes[byId.get(id).scene]=(scenes[byId.get(id).scene]||0)+1;
  if(!own(entry,'explanation'))errors.push(`${id}: explanation missing`);
  for(const [field,value] of Object.entries(entry)){
   fields[field]=(fields[field]||0)+1;
   if(stringFields.has(field)){
    if(typeof value!=='string'||!value.trim()||value!==value.trim())errors.push(`${id}.${field}: nonempty trimmed string required`);
    else if(!/[ぁ-んァ-ヶ一-龠]/u.test(value))errors.push(`${id}.${field}: Japanese text required`);
   }else if(arrayFields.has(field)){
    if(!Array.isArray(value)||!value.length||value.some(v=>typeof v!=='string'||!v.trim()||v!==v.trim())){errors.push(`${id}.${field}: nonempty string array required`);continue;}
    if(new Set(value).size!==value.length)errors.push(`${id}.${field}: duplicate values`);
    if(field==='relatedLineIds')for(const ref of value){referenceCount++;if(!idSet.has(ref)||ref===id)errors.push(`${id}: invalid reference ${ref}`);}
   }else errors.push(`${id}: unsupported field ${field}`);
  }
  const e=entry.explanation;
  if(typeof e!=='string')continue;
  if(e.length<15)errors.push(`${id}: explanation too short for useful context`);
  if(seenExplanations.has(e))errors.push(`${id}: identical explanation to ${seenExplanations.get(e)}`);
  seenExplanations.set(e,id);
  if(/(?:これはジョークではない|伏線ではない|特に皮肉ではない|会話を進めるための発言|気持ちを表現している|相手に自分の考えを伝えている)/u.test(e))errors.push(`${id}: generic/empty explanation pattern`);
  if(e===source.translations[id]?.translation)errors.push(`${id}: explanation equals translation`);
  if(own(entry,'spoiler')&&(!Array.isArray(entry.relatedLineIds)||!entry.relatedLineIds.length))errors.push(`${id}: spoiler needs specific reference IDs`);
  for(const name of ['translations','vocabulary','grammar'])if(!own(source[name],id))errors.push(`${id}: source ${name} missing`);
 }
 return {entries:keys.length,scenes,fields,referenceCount,errors,warnings};
}

export async function inspect(){
 const [sourceText,dataText]=await Promise.all([readFile(SOURCE_URL,'utf8'),readFile(DATA_URL,'utf8')]);
 const report=validateDramaturgy(parseUniqueJson(sourceText),parseUniqueJson(dataText));
 report.sourceSha256=sha256(sourceText);report.datasetSha256=sha256(dataText);
 if(report.sourceSha256!==SOURCE_SHA256)report.errors.push('Original bundle changed from audited baseline');
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await inspect();
 console.log(JSON.stringify(report,null,2));
 const i=process.argv.indexOf('--report');
 if(i>=0){if(!process.argv[i+1])throw Error('--report requires a path');await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');}
 if(report.errors.length)process.exitCode=1;
}
