import test from 'node:test';
import assert from 'node:assert/strict';

const store=new Map();
globalThis.localStorage={
 getItem:key=>store.has(key)?store.get(key):null,
 setItem:(key,value)=>{store.set(key,String(value));},
 removeItem:key=>store.delete(key)
};
const {
 normalizeAnnouncements,notificationFeed,unreadNotifications,
 markNotificationRead,markAllNotificationsRead,
 installedWelcome,recordInstalledWelcome,fetchAnnouncements
}=await import('../dist/modules/notifications.js');

test('announcements reject unsafe/duplicate IDs and clean URLs',()=>{
 const items=normalizeAnnouncements({items:[
  {id:'update_001',title:' 更新 ',body:' 修正しました ',date:'2026-11-01',url:'#script'},
  {id:'update_001',title:'dup',body:'duplicate'},
  {id:'broken<>',title:'bad id',body:'should be rejected'},
  {id:'update_002',title:'項目',body:'本文',url:'https://external.example/evil'}
 ]});
 assert.equal(items.length,2);
 assert.equal(items[0].title,'更新');
 assert.equal(items[0].url,'#script');
 assert.equal(items[1].url,'#home');
});

test('installed welcome is created once and badge clears on read',()=>{
 store.clear();
 assert.equal(installedWelcome(),false);
 assert.equal(recordInstalledWelcome(),true);
 assert.equal(recordInstalledWelcome(),false);
 assert.equal(installedWelcome(),true);
 let items=notificationFeed([]);
 assert.equal(items.length,1);
 assert.equal(unreadNotifications(items),1);
 assert.match(items[0].body,/オフライン/);
 markNotificationRead('welcome-install-v1');
 items=notificationFeed([]);
 assert.equal(unreadNotifications(items),0);
});

test('GitHub announcement remains unread until explicitly marked; read history persists',()=>{
 store.clear();
 const news=[{id:'update_002',title:'新機能',body:'リリースしました',date:'2026-11-01'}];
 let items=notificationFeed(news,false);
 assert.equal(unreadNotifications(items),1);
 markNotificationRead('update_002');
 items=notificationFeed(news,false);
 assert.equal(unreadNotifications(items),0);
 const next=notificationFeed([...news,{id:'update_003',title:'もう一つ',body:'変更があります',date:'2026-11-02'}],false);
 assert.equal(unreadNotifications(next),1);
 markAllNotificationsRead(next);
 assert.equal(unreadNotifications(notificationFeed([...news,{id:'update_003',title:'もう一つ',body:'変更があります'}],false)),0);
});

test('feed uses last verified GitHub data when offline; no device notification APIs needed',async()=>{
 store.clear();
 const original=globalThis.fetch;
 const remote={version:1,items:[{id:'release_001',title:'アップデート',body:'修正しました',date:'2026-11-01'}]};
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify(remote),{status:200});
  assert.equal((await fetchAnnouncements())[0].id,'release_001');
  globalThis.fetch=async()=>{throw Error('offline')};
  assert.equal((await fetchAnnouncements())[0].id,'release_001');
 }finally{globalThis.fetch=original;}
});
