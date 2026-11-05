// Device-wide scroll stick preferences. Legacy script-level switch is migrated once.
export const STICK_STORAGE_KEY='mt-stick-settings-v2';
export const STICK_SCREENS=Object.freeze(['script','cloze','quick','analysis','audio','home','notifications','settings']);
export const DEFAULT_STICK_SETTINGS=Object.freeze({
 master:true,
 screens:{script:true,cloze:true,quick:true,analysis:true,audio:false,home:false,notifications:false,settings:false},
 x:50,bottom:92,size:62,opacity:.7,speed:1
});
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
export function normalizeStickSettings(raw,legacy=true){
 const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const screens={...DEFAULT_STICK_SETTINGS.screens};
 for(const key of STICK_SCREENS)if(typeof src.screens?.[key]==='boolean')screens[key]=src.screens[key];
 return {
  master:typeof src.master==='boolean'?src.master:legacy!==false,
  screens,
  x:bounded(src.x,10,90,50),
  bottom:bounded(src.bottom,24,220,92),
  size:bounded(src.size,44,94,62),
  opacity:bounded(src.opacity,.25,1,.7),
  speed:bounded(src.speed,.3,2.5,1)
 };
}
export function readStickSettings(legacy=true,store=globalThis.localStorage){
 try{return normalizeStickSettings(JSON.parse(store?.getItem(STICK_STORAGE_KEY)||'null'),legacy);}
 catch{return normalizeStickSettings(null,legacy);}
}
export function saveStickSettings(value,store=globalThis.localStorage){
 try{store.setItem(STICK_STORAGE_KEY,JSON.stringify(normalizeStickSettings(value)));return true;}
 catch{return false;}
}
export function stickEnabled(settings,screen){
 return !!(settings?.master&&settings?.screens?.[screen]);
}
