// Appearance is device-wide, independent of the selected script and its study backup.
export const THEME_STORAGE_KEY='mt-appearance-v1';
export const THEME_MODES=Object.freeze(['light','dark']);
export const THEME_COLORS=Object.freeze([
 {id:'blue',label:'ブルー'},
 {id:'orange',label:'オレンジ'},
 {id:'pink',label:'ピンク'},
 {id:'green',label:'グリーン'},
 {id:'purple',label:'パープル'},
 {id:'rainbow',label:'レインボー'}
]);
const VALID_COLORS=new Set(THEME_COLORS.map(item=>item.id));
export function normalizeTheme(value){
 return {
  mode:THEME_MODES.includes(value?.mode)?value.mode:'light',
  color:VALID_COLORS.has(value?.color)?value.color:'blue'
 };
}
export function readTheme(store=globalThis.localStorage){
 try{return normalizeTheme(JSON.parse(store?.getItem(THEME_STORAGE_KEY)||'null'));}
 catch{return normalizeTheme(null);}
}
export function saveTheme(value,store=globalThis.localStorage){
 try{
  if(!store)return false;
  store.setItem(THEME_STORAGE_KEY,JSON.stringify(normalizeTheme(value)));
  return true;
 }catch{return false;}
}
export function applyTheme(value,doc=globalThis.document){
 const theme=normalizeTheme(value);
 const root=doc?.documentElement;
 if(root){
  root.dataset.themeMode=theme.mode;
  root.dataset.themeColor=theme.color;
 }
 const meta=doc?.querySelector?.('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',theme.mode==='dark'?'#111722':'#f7f9fd');
 return theme;
}
