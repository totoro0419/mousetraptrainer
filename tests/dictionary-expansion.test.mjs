import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle,tokenize,lookupDictionary} from '../dist/modules/data.js';
import {DICTIONARY_ADDONS,mergeDictionaryEntries} from '../dist/modules/bundled.js';
import {matchingDictionaryPhrases} from '../dist/modules/reader.js';

const readJSON=async path=>JSON.parse(await readFile(new URL('../dist/'+path.replace(/^\.\//,''),import.meta.url),'utf8'));
const source=await readJSON('./data/mousetrap.json');
const packages=await Promise.all(DICTIONARY_ADDONS.map(readJSON));
const original=normalizeBundle(source);
const merged=mergeDictionaryEntries(original,packages);

test('dictionary coverage at least doubles without replacing existing headwords',()=>{
 assert.equal(Object.keys(original.dictionary).length,578);
 assert.equal(Object.keys(merged.dictionary).length,1721);
 assert.ok(Object.keys(merged.dictionary).length>=2*Object.keys(original.dictionary).length);
 for(const [key,oldEntry] of Object.entries(original.dictionary))assert.deepEqual(merged.dictionary[key],oldEntry);
 assert.equal(merged.id,original.id);
 assert.deepEqual(merged.lines.map(line=>line.id),original.lines.map(line=>line.id));
});

test('curated 300 new attested headwords and expressions are distinct and not filler variants',()=>{
 const latest=packages.slice(-2),keys=latest.flatMap(pkg=>Object.keys(pkg.entries));
 assert.equal(keys.length,300);
 assert.equal(new Set(keys).size,300);
 const previous=mergeDictionaryEntries(original,packages.slice(0,2));
 assert.equal(Object.keys(previous.dictionary).length,1421);
 assert.ok(keys.every(key=>!Object.hasOwn(previous.dictionary,key)));
 for(const key of ['creak','snick','rubbish','crypt',"shan't",'hooked it','mixed up in','minced beef','drawing room','quite so']){
  assert.ok(merged.dictionary[key]?.coreMeaning?.length>=3,key+' missing');
 }
});
test('noun expansion and native everyday vocabulary are available',()=>{
 const nouns=Object.values(merged.dictionary).filter(entry=>entry.pos.includes('名詞')).length;
 const originalNouns=Object.values(original.dictionary).filter(entry=>entry.pos.includes('名詞')).length;
 assert.ok(nouns>originalNouns+350,{nouns,originalNouns});
 for(const word of ['cupboard','sergeant','boiler','butcher','postman','rasher','piano','gloves','blanket','torch','perhaps','sensible','pretend','unpleasant','actually']){
  const def=lookupDictionary(merged.dictionary,{text:word});
  assert.ok(def?.coreMeaning?.trim(),word+' must have a definition');
 }
});

test('each added term occurs in the actual dialogue and duplicate classes are combined',()=>{
 const corpus=merged.lines.map(line=>line.text).join(' ');
 for(const pkg of packages)for(const key of Object.keys(pkg.entries)){
  assert.match(corpus,new RegExp('(^|[^a-z])'+key.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'($|[^a-z])','i'),key+' must be attested');
 }
 const sense=merged.dictionary.mind;
 assert.match(sense.pos,/名詞/);
 assert.match(sense.pos,/動詞/);
 const segmented=tokenize('Cupboard, perhaps.').filter(item=>item.word);
 assert.ok(segmented.every(item=>lookupDictionary(merged.dictionary,item)));
});

test('malformed expansion data fails rather than silently reducing coverage',()=>{
 assert.throws(()=>mergeDictionaryEntries(original,[{version:1,entries:{bad:{pos:'名詞'}}}]),/不正/);
 assert.throws(()=>mergeDictionaryEntries(original,[{version:2,entries:{}}]),/形式/);
});

test('multiword dictionary nouns are detectable from the script without per-line vocabulary',()=>{
 const phrases=matchingDictionaryPhrases(merged.dictionary,'Scotland Yard has sent a message from Monkswell Manor.');
 assert.ok(phrases.some(entry=>entry.lemma==='scotland yard'));
 assert.ok(phrases.some(entry=>entry.lemma==='monkswell manor'));
});
