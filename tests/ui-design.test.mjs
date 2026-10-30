import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const file=async path=>readFile(new URL('../dist/'+path,import.meta.url),'utf8');
const [css,app,reader,rehearsal,html,manifest,sw]=await Promise.all([
 file('styles.css'),file('app.js'),file('modules/reader.js'),file('modules/rehearsal.js'),
 file('index.html'),file('manifest.webmanifest'),file('sw.js')
]);

test('design v2: consistent light theme and elevation tokens',()=>{
 for(const token of ['--ui-canvas:#f7f9fd','--ui-accent:#4568df','--ui-shadow-1','--ui-shadow-2','--ui-shadow-3','--ui-specular'])assert.ok(css.includes(token),token);
 assert.doesNotMatch(css,/font-family\s*:\s*(?:Georgia|(?:["']?)Times New Roman|serif)\b/i);
 assert.doesNotMatch(css,/#faf9f6|#f1b43f|#fff2d6/i);
 assert.match(css,/\.primary\s*\{[^}]*linear-gradient/i);
 assert.match(css,/\.sheet\s*\{[^}]*shadow/i);
});

test('design v2: full width script, hairline and clickable word indicator',()=>{
 assert.match(css,/\.script-body[^{}]*\{[^}]*max-width:none/i);
 assert.match(css,/\.speech[^{}]*\{[^}]*border-bottom:1px solid var\(--line\)/i);
 assert.match(css,/\.word,\.word\.phrase[^{}]*\{[^}]*dotted/i);
 assert.match(reader,/className='word'/);
 assert.match(reader,/if\(hasMeaning\)/);
 assert.doesNotMatch(reader,/YOU<\/span>|role-monogram/);
});

test('design v2: rehearsal keeps semantics without decorative monogram or audio emblem',()=>{
 assert.doesNotMatch(rehearsal,/class="role-monogram"|class="audio-symbol"|TURN WORDS INTO YOUR VOICE/);
 for(const term of ['createSession','transition(','selectRange(','data-action=advance','data-action=previous','data-resume','getClip('])assert.ok(rehearsal.includes(term),term);
 assert.match(css,/\.stick-base[^{}]*\{[^}]*border-radius:50%/);
 assert.doesNotMatch(css,/\.stick-base[^{}]*\{[^}]*background-image/i);
});

test('design v2: PWA assets and theme use consistent light background',()=>{
 assert.match(html,/name="theme-color" content="#f7f9fd"/);
 const m=JSON.parse(manifest);
 assert.equal(m.theme_color,'#f7f9fd');assert.equal(m.background_color,'#f7f9fd');
 assert.ok(sw.includes('luminous-v2'));
 assert.ok(app.includes('id="home-role"'));
 assert.ok(app.includes('data-action="choose-role"'));
});

test('design v2: basic stylesheet delimiter integrity',()=>{
 let depth=0,inComment=false;
 for(let i=0;i<css.length;i++){
  if(!inComment&&css.slice(i,i+2)==='/*'){inComment=true;i++;continue}
  if(inComment&&css.slice(i,i+2)==='*/'){inComment=false;i++;continue}
  if(inComment)continue;
  if(css[i]==='{')depth++;
  if(css[i]==='}')depth--;
  assert.ok(depth>=0,'unbalanced CSS closing delimiter');
 }
 assert.equal(depth,0,'unbalanced CSS declaration blocks');
});
