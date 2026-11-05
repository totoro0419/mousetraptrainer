import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEME_STORAGE_KEY,THEME_COLORS,THEME_MODES,normalizeTheme,readTheme,saveTheme,applyTheme} from '../dist/modules/theme.js';
test('exactly two appearance modes, six accents, safe defaults',()=>{
 assert.deepEqual(THEME_MODES,['light','dark']);
 assert.deepEqual(THEME_COLORS.map(x=>x.id),['blue','orange','pink','green','purple','rainbow']);
 assert.deepEqual(normalizeTheme(null),{mode:'light',color:'blue'});
 assert.deepEqual(normalizeTheme({mode:'dark',color:'rainbow'}),{mode:'dark',color:'rainbow'});
 assert.deepEqual(normalizeTheme({mode:'other',color:'custom'}),{mode:'light',color:'blue'});
});
test('persist, reload, and recover from inaccessible storage',()=>{
 const items=new Map(),store={getItem:k=>items.get(k),setItem:(k,v)=>items.set(k,v)};
 assert.equal(saveTheme({mode:'dark',color:'purple'},store),true);
 assert.deepEqual(JSON.parse(items.get(THEME_STORAGE_KEY)),{mode:'dark',color:'purple'});
 assert.deepEqual(readTheme(store),{mode:'dark',color:'purple'});
 items.set(THEME_STORAGE_KEY,'not-json');assert.deepEqual(readTheme(store),{mode:'light',color:'blue'});
 const denied={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}};
 assert.deepEqual(readTheme(denied),{mode:'light',color:'blue'});
 assert.equal(saveTheme({mode:'dark',color:'green'},denied),false);
});
test('theme applies to root and browser chrome',()=>{
 const root={dataset:{}},meta={setAttribute:(k,v)=>{assert.equal(k,'content');meta.value=v}};
 const doc={documentElement:root,querySelector:()=>meta};
 applyTheme({mode:'dark',color:'rainbow'},doc);
 assert.deepEqual(root.dataset,{themeMode:'dark',themeColor:'rainbow'});
 assert.equal(meta.value,'#111722');
 applyTheme({mode:'light',color:'pink'},doc);assert.equal(meta.value,'#f7f9fd');
});
test('UI, stylesheet and offline app shell are integrated',async()=>{
 const read=path=>readFile(new URL('../dist/'+path,import.meta.url),'utf8');
 const [app,html,css,sw]=await Promise.all(['app.js','index.html','theme.css','sw.js'].map(read));
 for(const s of ['name="theme-mode"','name="theme-color"','applyTheme(readTheme())','saveTheme(appearance)'])assert.ok(app.includes(s),s);
 for(const s of ['--theme-rainbow-pastel','data-theme-color="rainbow"','.primary','prefers-reduced-motion','data-theme-mode="dark"'])assert.ok(css.includes(s),s);
 assert.ok(html.includes('href="./theme.css"'));
 assert.ok(sw.includes("'./theme.css'"));assert.ok(sw.includes("'./modules/theme.js'"));
});
