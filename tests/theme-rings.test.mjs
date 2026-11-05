import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('all six colors and both modes define chart palette tokens and SVG styles',async()=>{
 const css=await readFile(new URL('../dist/theme.css',import.meta.url),'utf8');
 for(const color of ['blue','orange','pink','green','purple','rainbow']){
  for(const prefix of [':root[data-theme-color="'+color+'"]',':root[data-theme-mode="dark"][data-theme-color="'+color+'"]']){
   const index=css.lastIndexOf(prefix+'{');
   assert.ok(index>=0,prefix);
   const rule=css.slice(index,css.indexOf('}',index));
   for(const token of ['--home-ring-blue:','--home-ring-light:','--home-festival-navy:'])assert.ok(rule.includes(token),prefix+' '+token);
  }
 }
 for(const selector of ['.home-ring-completed','.home-ring-practicing','.home-festival-ring','.home-progress-dot-practicing','.home-progress-dot-festival','.home-progress-main-value']){
  assert.ok(css.includes(selector),selector);
 }
});
