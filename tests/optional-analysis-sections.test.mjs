import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeBundle} from '../dist/modules/data.js';
import {analysisLanguageSections} from '../dist/modules/reader.js';

test('missing grammar and vocabulary remove whole sections without placeholders or dividers',()=>{
 assert.equal(analysisLanguageSections([],[]),'');
 const grammarOnly=analysisLanguageSections([{pattern:'if + clause',description:'条件を示す'}],[]);
 assert.match(grammarOnly,/<h3>文法・構文<\/h3>/);
 assert.match(grammarOnly,/if \+ clause/);
 assert.doesNotMatch(grammarOnly,/<h3>重要表現<\/h3>/);
 const vocabOnly=analysisLanguageSections([],[{surface:'take care',meaning:'気をつける'}]);
 assert.match(vocabOnly,/<h3>重要表現<\/h3>/);
 assert.match(vocabOnly,/data-vocab="0"/);
 assert.doesNotMatch(vocabOnly,/<h3>文法・構文<\/h3>/);
 const both=analysisLanguageSections([{pattern:'A',description:'B'}],[{surface:'C',meaning:'D'}]);
 assert.equal((both.match(/class="sheet-section"/g)||[]).length,2);
 for(const html of [grammarOnly,vocabOnly,both])assert.doesNotMatch(html,/解説はまだありません|登録された重要表現はありません/);
});

test('all 1164 script lines show optional language sections only when entries exist',()=>{
 const raw=JSON.parse(readFileSync(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));
 const data=normalizeBundle(raw);
 assert.equal(data.lines.length,1164);
 for(const line of data.lines){
  const grammar=data.grammar[line.id]||[],vocab=data.vocabulary[line.id]||[];
  const html=analysisLanguageSections(grammar,vocab);
  assert.equal(html.includes('<h3>文法・構文</h3>'),grammar.length>0,line.id+' grammar');
  assert.equal(html.includes('<h3>重要表現</h3>'),vocab.length>0,line.id+' vocabulary');
  assert.equal((html.match(/class="sheet-section"/g)||[]).length,(grammar.length>0?1:0)+(vocab.length>0?1:0),line.id);
  assert.doesNotMatch(html,/このセリフの文法解説はまだありません|登録された重要表現はありません/);
 }
});
