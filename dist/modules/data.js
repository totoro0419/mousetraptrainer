export const SCENE_NAMES={'act1-scene1':'第1幕・第1場','act1-scene2':'第1幕・第2場',act2:'第2幕','sample-scene1':'第1場 · 駅の待合室','sample-scene2':'第2場 · 再会','sample-scene3':'第3場 · 帰り道'};
export const sceneName=id=>SCENE_NAMES[id]||id;
export const plain=value=>typeof value==='string'?value:'';
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function normalizeBundle(input){
 const raw=input.script||input.mousetrap_script_data||input;
 if(!record(raw))throw Error('台本の形式が正しくありません。');
 const scenes=[],lines=[],ids=new Set();
 for(const [key,value] of Object.entries(raw)){
  if(!Array.isArray(value?.speeches))continue;
  const scene={id:key,title:sceneName(key),lines:[],direction:value.direction||null};
  for(const s of value.speeches){
   if(!record(s)||!plain(s.id)||!plain(s.speaker)||!plain(s.text).trim())throw Error(`${key}: 発話ID・話者・英文が必要です。`);
   if(ids.has(s.id))throw Error(`発話IDが重複しています: ${s.id}`);
   if(s.text.length>60000||s.id.length>200)throw Error('発話の長さが上限を超えています。');
   ids.add(s.id);const line={id:s.id,speaker:s.speaker,text:s.text,ordinal:s.ordinal||scene.lines.length+1,scene:key,index:lines.length,direction:s.direction||input.directions?.[s.id]||null,context:s.context||'',acting:s.acting||''};
   lines.push(line);scene.lines.push(line.id);
  }
  scenes.push(scene);
 }
 if(!lines.length)throw Error('読み込める発話がありません。台本JSONまたはバックアップZIPを選んでください。');
 if(lines.length>15000)throw Error('1回に読み込める発話は15,000件までです。');
 const map=(name)=>record(input[name])?input[name]:{};
 const translations=map('translations'),vocabulary=map('vocabulary'),grammar=map('grammar'),dictionary=map('dictionary');
 const warnings=[];
 for(const [name,m] of Object.entries({translations,vocabulary,grammar})){
  const missing=lines.filter(l=>!(l.id in m)).length,orphan=Object.keys(m).filter(k=>!ids.has(k)).length;
  if(missing)warnings.push(`${{translations:'訳',vocabulary:'語彙',grammar:'文法'}[name]}なし: ${missing}件`);
  if(orphan)throw Error(`${name}: 台本と一致しない発話IDが${orphan}件あります。`);
 }
 for(const l of lines){
  if(translations[l.id]&&!record(translations[l.id])&&typeof translations[l.id]!=='string')throw Error('翻訳の形式が不正です。');
  for(const m of [vocabulary,grammar])if(l.id in m&&!Array.isArray(m[l.id]))throw Error(`${l.id}: 語彙・文法は配列が必要です。`);
  for(const g of grammar[l.id]||[])if(!record(g)||typeof g.pattern!=='string'||typeof g.description!=='string')throw Error(`${l.id}: 文法項目の形式が不正です。`);
  for(const v of vocabulary[l.id]||[])if(!record(v)||typeof v.surface!=='string'||typeof v.meaning!=='string')throw Error(`${l.id}: 語彙項目の形式が不正です。`);
 }
 for(const d of Object.values(dictionary))if(!record(d))throw Error('辞書項目の形式が不正です。');
 return {version:1,id:plain(input.id)||(lines[0].id.startsWith('act1-scene1-speech-')?'mousetrap-private':'local-'+lines[0].id),title:plain(input.title)||'The Mousetrap',sample:input.sample===true,scenes,lines,translations,vocabulary,grammar,dictionary,warnings,importedAt:Date.now()};
}
export function stats(data,progress,role){
 const mine=data.lines.filter(l=>l.speaker===role),counts=[0,0,0];let review=0;
 for(const l of mine){const p=progress[l.id]||{};counts[Math.min(2,Math.max(0,p.level||0))]++;if(p.review)review++;}
 return {total:mine.length,counts,review,percent:mine.length?Math.round(counts[2]/mine.length*100):0};
}
export const labels=['未着手','練習中','暗記済み'];
export function advanceProgress(old={}){return {...old,level:((old.level||0)+1)%3,updatedAt:Date.now()};}
export function filterLines(data,{scene='all',speaker='all',query='',reviewOnly=false,progress={}}={}){
 const q=query.trim().toLocaleLowerCase();return data.lines.filter(l=>(scene==='all'||l.scene===scene)&&(speaker==='all'||speaker===l.speaker)&&(!reviewOnly||progress[l.id]?.review)&&(!q||`${l.text} ${l.speaker} ${plain(data.translations[l.id]?.translation||data.translations[l.id])}`.toLocaleLowerCase().includes(q)));
}
export function tokenize(text,entries=[]){
 const phrases=entries.filter(e=>plain(e.surface)).slice().sort((a,b)=>b.surface.length-a.surface.length),out=[];
 const pattern=/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;let i=0;
 while(i<text.length){
  const match=phrases.find(e=>text.slice(i,i+e.surface.length).toLowerCase()===e.surface.toLowerCase()&&!/[a-z]/i.test(text[i-1]||'')&&!/[a-z]/i.test(text[i+e.surface.length]||''));
  if(match){out.push({text:text.slice(i,i+match.surface.length),entry:match});i+=match.surface.length;continue;}
  pattern.lastIndex=i;const word=pattern.exec(text);
  if(word?.index===i){out.push({text:word[0],word:true});i+=word[0].length;}else {out.push({text:text[i]});i++;}
 }
 return out;
}
export async function unzipJSON(buffer){
 const v=new DataView(buffer),bytes=new Uint8Array(buffer),decoder=new TextDecoder();let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('ZIPの形式を確認できません。');
 const count=v.getUint16(eocd+10,true);if(count>200)throw Error('ZIP内のファイル数が多すぎます。');
 let p=v.getUint32(eocd+16,true),total=0;const output={};
 for(let i=0;i<count;i++){
  if(v.getUint32(p,true)!==0x02014b50)throw Error('ZIPが破損しています。');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),expanded=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),offset=v.getUint32(p+42,true);
  const name=decoder.decode(bytes.slice(p+46,p+46+nl)).split('/').pop();p+=46+nl+el+cl;
  if(!name?.endsWith('.json'))continue;
  if(flags&1)throw Error('パスワード付きZIPには対応していません。');
  total+=expanded;if(expanded>25000000||total>50000000)throw Error('展開後のデータが大きすぎます。');
  if(v.getUint32(offset,true)!==0x04034b50)throw Error('ZIPが破損しています。');
  const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true),compressed=bytes.slice(start,start+size);
  let content;
  if(method===0)content=compressed;else if(method===8){
   try{const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expanded||length>25000000){await reader.cancel();throw Error('size');}chunks.push(value);}content=new Uint8Array(length);let at=0;for(const c of chunks){content.set(c,at);at+=c.length;}}
   catch{throw Error('ZIPを展開できません。ブラウザーを更新するか、展開済みのJSONをまとめて選んでください。');}
  }else throw Error('対応していないZIP圧縮方式です。JSONを選んでください。');
  if(content.length!==expanded)throw Error('ZIP内のファイルサイズが一致しません。');
  output[name]=JSON.parse(decoder.decode(content));
 }
 return output;
}
export function assemble(files){
 const result={};const names={mousetrap_script_data:'script',mousetrap_line_translations:'translations',mousetrap_line_vocabulary:'vocabulary',mousetrap_line_grammar:'grammar',mousetrap_word_dictionary:'dictionary',mousetrap_directions:'directions'};
 for(const [filename,content] of Object.entries(files)){
  if(content?.format==='mousetrap-backup-v1')return {backup:content};
  if(record(content?.script)&&Object.values(content.script).some(v=>Array.isArray(v?.speeches))){for(const k of ['script','translations','vocabulary','grammar','dictionary','directions','id','title','sample'])if(k in content)result[k]=content[k];continue;}
  const key=Object.keys(names).find(n=>filename.replace(/\(\d+\)/g,'').startsWith(n));if(key)result[names[key]]=content;
  else if(record(content)&&Object.values(content).some(v=>Array.isArray(v?.speeches)))result.script=content;
 }
 return {data:normalizeBundle(result)};
}
export async function readFiles(files){
 let entries={};if(!files.length)throw Error('ファイルを選んでください。');
 for(const f of files){if(f.size>50000000)throw Error('ファイルは50MB以内にしてください。');
  if(f.name.toLowerCase().endsWith('.zip'))Object.assign(entries,await unzipJSON(await f.arrayBuffer()));
  else if(f.name.toLowerCase().endsWith('.json'))entries[f.name]=JSON.parse(await f.text());else throw Error('JSONまたはZIPを選んでください。');
 }return assemble(entries);
}
// Some supplied entries attach an unrelated -ing explanation to perfect forms.
// Repair only that exact known mismatch; preserve the original in imported data.
export function grammarDescription(entry){
 const rules={"'d + 過去分詞（had の縮約）":"'d が had を表す場合、had + 過去分詞で過去完了を作る。過去の基準時より前の出来事・状態を表す。","'s + 過去分詞（has の縮約）":"'s が has を表す場合、has + 過去分詞で現在完了を作る。過去の出来事を現在とのつながりの中で捉える。",'have just + 過去分詞':'have / has just + 過去分詞は、たった今起きたことを表す現在完了。','may/might have + 過去分詞':'may / might have + 過去分詞は、過去の出来事について「〜したかもしれない」と可能性を示す。','would have + 過去分詞':'would have + 過去分詞は、仮定の条件のもとで起きたであろう過去の結果などを表す。','should have + 過去分詞':'should have + 過去分詞は「〜すべきだった」など、過去についての判断を表す。文脈によって「〜したはずだ」という推量にもなる。','could have + 過去分詞':'could have + 過去分詞は、過去に実現できた可能性や「〜だったかもしれない」という推量などを表す。','must have + 過去分詞':'must have + 過去分詞は、過去の出来事について「〜したに違いない」と強く推量する。','why + S + should have + 過去分詞':'why を伴う should have + 過去分詞は、過去の出来事への疑問や意外さを表すことがある。前後の文脈で話者の態度を確認する。'};
 if(entry?.description?.includes('-ing形の役割')&&rules[entry.pattern]){const quote=entry.description.match(/原文では「([^」]+)」/);return {text:rules[entry.pattern]+(quote?` 原文の「${quote[1]}」を確認する。`:''),corrected:true};}
 return {text:plain(entry?.description),corrected:false};
}
