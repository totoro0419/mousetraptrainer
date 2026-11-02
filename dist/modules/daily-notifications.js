// In-app daily editorial notifications. Never request OS notification permission.
const RECEIVED_KEY='mt-daily-received-v1';
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
const speechId=/^act(?:1-scene[12]|2)-speech-\d{4}$/;

export function todayInTokyo(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=type=>parts.find(part=>part.type===type)?.value;
 return [value('year'),value('month'),value('day')].join('-');
}

export const FESTIVAL_DATE='2027-04-27';
export const DAILY_START_DATE='2026-11-03';
export function festivalDaysRemaining(date){
 if(!isoDate.test(date))return null;
 const end=Date.parse(FESTIVAL_DATE+'T00:00:00Z');
 const day=Date.parse(date+'T00:00:00Z');
 const diff=(end-day)/86400000;
 return Number.isInteger(diff)&&diff>=0?diff:null;
}

function normalize(item){
 if(!item||!isoDate.test(item.date||'')||typeof item.title!=='string'||typeof item.body!=='string')return null;
 if(!['trivia','theory','milestone'].includes(item.type)||!item.title.trim()||!item.body.trim())return null;
 const lineId=typeof item.lineId==='string'&&speechId.test(item.lineId)?item.lineId:null;
 return {id:'daily-'+item.date,date:item.date,title:item.title.slice(0,90),body:item.body.slice(0,1100),
  category:String(item.category||'今日のお知らせ').slice(0,40),type:item.type,url:lineId?'#script':'#home',
  ...(lineId?{lineId,quoteAnchor:String(item.quoteAnchor||'').slice(0,120)}:{})};
}

export function receivedDailyItems(){
 try{
  const stored=JSON.parse(localStorage.getItem(RECEIVED_KEY)||'[]');
  if(!Array.isArray(stored))return [];
  return stored.map(normalize).filter(Boolean);
 }catch{return [];}
}

export async function receiveDailyToday(now=new Date()){
 const date=todayInTokyo(now);
 if(date<DAILY_START_DATE||date>FESTIVAL_DATE)return false;
 const prior=receivedDailyItems();
 if(prior.some(item=>item.date===date))return false;
 try{
  const response=await fetch(new URL('../data/daily-editorial.json',import.meta.url),{cache:'no-store'});
  if(!response.ok)return false;
  const feed=await response.json();
  const raw=Array.isArray(feed.items)?feed.items.find(item=>item.date===date):null;
  const next=normalize(raw);
  if(!next)return false; // No retroactive claim: only today's entry can be received.
  localStorage.setItem(RECEIVED_KEY,JSON.stringify([...prior,next]));
  return true;
 }catch{return false;}
}

// Extract the complete sentence containing the source anchor. When long, retain
// the anchor and a little context on each side, with at most maxWords words.
export function quoteSentence(text,anchor,maxWords=25){
 if(typeof text!=='string'||typeof anchor!=='string'||!anchor.trim())return '';
 if(!text.toLowerCase().includes(anchor.toLowerCase()))return '';
 const protectedText=text.replace(/\b(Mrs|Mr|Dr|St)\./g,'$1§');
 const sentences=protectedText.split(/(?<=[.!?])\s+(?=[A-Z"'“(])/).map(part=>part.replaceAll('§','.').trim()).filter(Boolean);
 let sentence=sentences.find(part=>part.toLowerCase().includes(anchor.toLowerCase()));
 if(!sentence)sentence=text; // Handles an anchor spanning short adjacent sentences.
 const words=sentence.split(/\s+/).filter(Boolean),limit=Math.max(1,Math.floor(maxWords));
 if(words.length<=limit)return sentence;
 const position=sentence.toLowerCase().indexOf(anchor.toLowerCase());
 const prefixWords=sentence.slice(0,position).split(/\s+/).filter(Boolean).length;
 const anchorWords=anchor.trim().split(/\s+/).length;
 const start=Math.max(0,Math.min(prefixWords-Math.floor((limit-anchorWords)/2),words.length-limit));
 const end=Math.min(words.length,start+limit);
 return (start?'… ':'')+words.slice(start,end).join(' ')+(end<words.length?' …':'');
}
