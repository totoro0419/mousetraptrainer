import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeBundle} from '../dist/modules/data.js';
import {scriptFingerprint} from '../dist/modules/dramaturgy.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function validateAudio(){
 const data=normalizeBundle(JSON.parse(await readFile('dist/data/mousetrap.json')));
 const manifest=JSON.parse(await readFile('dist/data/audio-manifest.json'));
 if(manifest.sourceFingerprint!==await scriptFingerprint(data))throw Error('Audio source text, IDs or speakers changed');
 if(manifest.total!==1164||manifest.clips.length!==data.lines.length)throw Error('Audio coverage mismatch');
 const files=[];for(const dir of await readdir('dist/audio/lines'))for(const file of await readdir('dist/audio/lines/'+dir))files.push(`audio/lines/${dir}/${file}`);
 if(files.length!==manifest.clips.length)throw Error('Unexpected or missing audio files');
 let bytes=0,seconds=0;const ids=new Set(),paths=new Set();
 for(const [i,line] of data.lines.entries()){
  const c=manifest.clips[i];
  if(c.id!==line.id||c.speaker!==line.speaker||c.scene!==line.scene||c.ordinal!==line.ordinal||c.textSha256!==hash(line.text))throw Error('Audio assignment mismatch: '+line.id);
  if(ids.has(c.id)||paths.has(c.file)||!files.includes(c.file)||!/^audio\/lines\/[a-z0-9-]+\/[a-z0-9-]+\.mp3$/.test(c.file))throw Error('Duplicate or invalid audio reference');
  const file=await readFile('dist/'+c.file);
  if(file.length!==c.bytes||hash(file)!==c.sha256||!(c.duration>0)||!(c.decodedSeconds>0)||c.rmsDbFS<-70)throw Error('Invalid audio evidence: '+line.id);
  ids.add(c.id);paths.add(c.file);bytes+=file.length;seconds+=c.duration;
 }
 if(bytes!==manifest.totalBytes||Math.abs(seconds-manifest.totalSeconds)>.01)throw Error('Audio totals mismatch');
 return {total:ids.size,bytes,seconds:Math.round(seconds*1000)/1000,missing:data.lines.length-ids.size};
}
if(process.argv[1]?.endsWith('validate-audio.mjs'))console.log(await validateAudio());
