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


test('design v2: PNG PWA icons are valid and match required dimensions',async()=>{
 const zlib=await import('node:zlib');
 for(const size of [192,512]){
  const buf=await readFile(new URL('../dist/icon-'+size+'.png',import.meta.url));
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature');
  let o=8,idat=[],palette,seenIEND=false;
  const crc=(data)=>{let n=0xffffffff;for(const byte of data){n^=byte;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0};
  while(o<buf.length){
   const length=buf.readUInt32BE(o),kind=buf.toString('ascii',o+4,o+8);
   const end=o+12+length;
   assert.ok(end<=buf.length,`PNG chunk fits file: size=${size} chunk=${kind} offset=${o} len=${length} total=${buf.length}`);
   assert.equal(crc(buf.subarray(o+4,o+8+length)),buf.readUInt32BE(o+8+length),'PNG chunk CRC: '+kind);
   if(kind==='IHDR'){
    assert.equal(buf.readUInt32BE(o+8),size);
    assert.equal(buf.readUInt32BE(o+12),size);
   }
   if(kind==='PLTE')palette=buf.subarray(o+8,o+8+length);
   if(kind==='IDAT')idat.push(buf.subarray(o+8,o+8+length));
   if(kind==='IEND')seenIEND=true;
   o=end;
  }
  assert.ok(seenIEND,'PNG IEND');
  assert.ok(zlib.inflateSync(Buffer.concat(idat)).length>=size,'image rows inflate');
  // Require a blue in the palette, guarding against old warm-color launcher icons.
  if(palette){let blue=false;for(let j=0;j<palette.length;j+=3)if(palette[j+2]>palette[j]+30&&palette[j+2]>palette[j+1]+10)blue=true;assert.ok(blue,'blue palette')}
 }
});
