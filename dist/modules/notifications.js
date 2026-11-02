import {receivedDailyItems} from './daily-notifications.js';
// Per-device notification inbox; announcements are edited in GitHub and published with Pages.
const READ_KEY='mt-notifications-read-v1';
const WELCOME_KEY='mt-welcome-installed-v1';
const CACHE_KEY='mt-notifications-feed-v1';
const welcome={
 id:'welcome-install-v1',
 title:'Mousetrap Trainerへようこそ',
 body:'インストールが完了しました。台本などをオフラインでも使えます。全音声をオフラインで使うには、ホームの「オフライン音声」から保存してください。英語劇の練習、頑張りましょう！',
 date:'',url:'#home'
};
const readStored=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}};
const writeStored=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const validateUrl=url=>typeof url==='string'&&/^#(?:home|script|rehearse|settings)$/.test(url)?url:'#home';

export function normalizeAnnouncements(value){
 if(!value||!Array.isArray(value.items))return [];
 const used=new Set(),items=[];
 for(const raw of value.items.slice(0,100)){
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[-a-zA-Z0-9_]{3,72}$/.test(raw.id)||used.has(raw.id))continue;
  if(typeof raw.title!=='string'||!raw.title.trim()||typeof raw.body!=='string'||!raw.body.trim())continue;
  used.add(raw.id);
  items.push({id:raw.id,title:raw.title.trim().slice(0,90),body:raw.body.trim().slice(0,1100),
   date:typeof raw.date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(raw.date)?raw.date:'',url:validateUrl(raw.url)});
 }
 return items;
}
export function installedWelcome(){
 return readStored(WELCOME_KEY,false)===true;
}
export function recordInstalledWelcome(){
 if(installedWelcome())return false;
 writeStored(WELCOME_KEY,true);
 return true;
}
export function markNotificationRead(id){
 if(!/^[\w-]{3,72}$/.test(String(id)))return;
 const stored=readStored(READ_KEY,[]);
 const ids=new Set(Array.isArray(stored)?stored:[]);
 ids.add(id);
 writeStored(READ_KEY,[...ids].slice(-500));
}
export function markAllNotificationsRead(items){
 const ids=new Set(readStored(READ_KEY,[]));
 for(const item of items)ids.add(item.id);
 writeStored(READ_KEY,[...ids].slice(-500));
}
export function notificationFeed(announcements,showWelcome=installedWelcome()){
 const ids=new Set(readStored(READ_KEY,[]));
 const items=[...normalizeAnnouncements({items:announcements}),...receivedDailyItems()];
 if(showWelcome)items.push(welcome);
 return items.map(item=>({...item,read:ids.has(item.id)})).sort((a,b)=>b.date.localeCompare(a.date));
}
export function unreadNotifications(items){return items.reduce((n,item)=>n+(item.read?0:1),0);}
export async function fetchAnnouncements(){
 const fallback=normalizeAnnouncements({items:readStored(CACHE_KEY,[])});
 try{
  const response=await fetch(new URL('../data/notifications.json',import.meta.url),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const items=normalizeAnnouncements(await response.json());
  writeStored(CACHE_KEY,items);
  return items;
 }catch{return fallback;}
}
