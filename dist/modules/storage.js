let promise;
export function database(){
 if(!promise)promise=new Promise((resolve,reject)=>{const r=indexedDB.open('mousetrap-trainer',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('ほかのタブを閉じて再試行してください。'));});return promise;
}
export async function get(key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function put(key,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('保存が中断されました。'));});}
export async function atomicPut(entries){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');for(const [k,v] of entries)t.objectStore('records').put(v,k);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('保存が中断されました。'));});}
export function loadSmall(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
export function saveSmall(key,value){localStorage.setItem(key,JSON.stringify(value));}
