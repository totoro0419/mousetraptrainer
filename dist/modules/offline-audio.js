/** Complete offline audio package: opt-in download, durable per-clip cache, resumable across sessions. */
export const OFFLINE_AUDIO_TOTAL = 1164;
export const OFFLINE_AUDIO_BYTES = 32496480;
export const OFFLINE_AUDIO_CACHE = 'mousetrap-audio-runtime-v1';
const AUDIO_INDEX = new URL('../audio/index.json', import.meta.url).href;
const PATH_RE = /^lines\/(act1-scene1|act1-scene2|act2)\/((?:act1-scene1|act1-scene2|act2)-speech-\d{4})\.mp3$/;
let currentJob = null;
const listeners = new Set();

export function isInstalledPwa() {
 return (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);
}

export function validateHostedAudioIndex(index) {
 const clips = index?.clips;
 if (!clips || typeof clips !== 'object' || Array.isArray(clips))
  throw Error('音声の一覧が不正です。');
 const pairs = Object.entries(clips);
 if (pairs.length !== OFFLINE_AUDIO_TOTAL)
  throw Error('音声の件数が1,164件ではありません。');
 const used = new Set(), urls = [];
 for (const [id, path] of pairs) {
  const match = typeof path === 'string' ? PATH_RE.exec(path) : null;
  if (!match || id !== match[2] || !id.startsWith(match[1] + '-speech-') || used.has(path))
   throw Error('音声とセリフの対応が不正です。');
  used.add(path);
  urls.push(new URL('../audio/' + path, import.meta.url).href);
 }
 return urls;
}

async function readIndex() {
 const response = await fetch(AUDIO_INDEX, {cache:'no-store'});
 if (!response.ok) throw Error('音声一覧を取得できません (HTTP ' + response.status + ')');
 return validateHostedAudioIndex(await response.json());
}

function notify(progress) {
 for (const listener of listeners) {
  try { listener(progress); } catch { /* UI listeners must not interrupt downloads */ }
 }
}

export async function offlineAudioStatus() {
 const urls = await readIndex();
 const cache = await caches.open(OFFLINE_AUDIO_CACHE);
 const stored = new Set((await cache.keys()).map(request => request.url));
 const ready = urls.filter(url => stored.has(url));
 return {total: urls.length, downloaded: ready.length, complete: ready.length === urls.length, urls, cache, stored};
}

export function isAudioDownloadRunning() { return currentJob !== null; }

export function downloadEntireAudio({onProgress} = {}) {
 if (onProgress) listeners.add(onProgress);
 if (currentJob) return currentJob;
 currentJob = (async () => {
  try {
   const {urls,cache,stored} = await offlineAudioStatus();
   let downloaded = urls.filter(url => stored.has(url)).length;
   const total = urls.length;
   // Proactively detect browser-origin storage limits. Installation alone cannot lift quota.
   try{
    const estimate=await navigator.storage?.estimate?.();
    if(Number.isFinite(estimate?.quota)&&Number.isFinite(estimate?.usage)){
     const needed=Math.ceil(OFFLINE_AUDIO_BYTES*(total-downloaded)/total)+2*1024*1024;
     if(estimate.quota-estimate.usage<needed)
      throw Error('保存可能な領域が不足しています。音声の一括保存には約33MBの空きが必要です。ブラウザーの保存領域を確認してください。');
    }
   }catch(error){if(error?.message?.includes('保存可能な領域が不足'))throw error;/* unsupported estimate */}
   notify({downloaded,total,running:true});
   const remaining = urls.filter(url => !stored.has(url));
   let cursor = 0, failures = 0, firstError = null, fatal = false;
   async function worker() {
    while (cursor < remaining.length && !fatal) {
     const url = remaining[cursor++];
     try {
      const response = await fetch(url, {cache:'no-store',headers:{'X-Mousetrap-Bulk-Audio':'1'}});
      if (!response.ok || response.status !== 200) throw Error('HTTP ' + response.status);
      const blob = await response.blob();
      if (blob.size < 100 || blob.size > 2000000) throw Error('不正な音声ファイルサイズ');
      // Some browsers stall rather than reject Cache.put when a per-origin quota is exhausted.
      // Never leave the user at a frozen percentage; let them retry the remainder later.
      let timer;
      try{
       await Promise.race([
        cache.put(url, new Response(blob,{headers:{'Content-Type':'audio/mpeg'}})),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('音声の保存がタイムアウトしました。'),{name:'TimeoutError'})),20000);})
       ]);
      }finally{clearTimeout(timer);}
      downloaded++;
      notify({downloaded,total,running:true});
     } catch (error) {
      failures++;
      firstError ||= error;
      if (error?.name === 'QuotaExceededError' || error?.name === 'TimeoutError') fatal = true;
     }
    }
   }
   await Promise.all(Array.from({length:Math.min(4,remaining.length)},()=>worker()));
   const confirmed = new Set((await cache.keys()).map(request=>request.url));
   const saved = urls.filter(url=>confirmed.has(url)).length;
   if (saved !== total || failures) {
    const suffix = firstError?.name === 'QuotaExceededError' || firstError?.name === 'TimeoutError' ? 'ブラウザーの保存領域が不足している可能性があります。' : '通信状態を確認してください。';
    throw Error('音声 ' + saved + ' / ' + total + ' 件を保存しました。' + suffix + ' 後から続きだけ保存できます。');
   }
   notify({downloaded:total,total,running:false,complete:true});
   return {downloaded:total,total,complete:true};
  } catch(error) {
   notify({running:false,error:error.message});
   throw error;
  } finally {
   currentJob = null;
   // Next download uses its own listener; retaining old sheet callbacks leaks DOM references.
   listeners.clear();
  }
 })();
 return currentJob;
}
