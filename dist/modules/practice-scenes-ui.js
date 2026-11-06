import {esc} from './ui.js';
import {PRACTICE_GROUPS} from './practice-scenes.js';

const rangeMatches=(p,range)=>range?.scene===p.group&&Number(range.from)===p.from&&Number(range.to)===p.to;

export function practicePickerMarkup(parts,range){
 if(!parts.length)return '';
 const selected=parts.find(p=>rangeMatches(p,range));
 return `<section class="practice-picker" aria-label="練習パート">
  <div class="practice-picker-heading"><h2>シーンから選ぶ</h2><p>担当する役の出番があるパートを強調しています。</p></div>
  ${PRACTICE_GROUPS.map((group,i)=>{
   const rows=parts.filter(p=>p.group===group.id),own=rows.reduce((n,p)=>n+p.ownCount,0);
   const opened=selected?selected.group===group.id:i===0;
   return `<details class="practice-group" ${opened?'open':''}>
    <summary><span>${esc(group.title)}<small>${rows.length}パート · 自分のセリフ ${own}件</small></span><span class="practice-disclosure" aria-hidden="true">⌄</span></summary>
    <div class="practice-list">${rows.map(p=>{
     const mine=p.ownCount>0,chosen=selected?.id===p.id;
     return `<button type="button" class="practice-part${mine?' has-role':''}${chosen?' is-selected':''}" data-practice-id="${esc(p.id)}"
        data-role-density="${p.ownedPercent>=30?'high':p.ownedPercent>=10?'medium':'low'}"
        aria-pressed="${chosen}" aria-label="${esc(p.id+' '+p.title+'、自分のセリフ'+p.ownCount+'件')}">
      <span class="practice-part-number">${esc(p.id.slice(1))}</span>
      <span class="practice-part-main"><strong>${esc(p.title)}</strong><small>${esc(p.summary)}</small>
      ${mine?`<span class="practice-meter" aria-label="暗記済み ${p.memorizedPercent}%"><span style="width:${p.memorizedPercent}%"></span></span>`:''}</span>
      <span class="practice-part-status">${mine?`<strong>${p.ownCount}件</strong><small>暗記済 ${p.memorizedPercent}%${p.review?' · 要復習'+p.review+'件':''}</small>`:'<small>出番なし</small>'}</span>
    </button>`;
    }).join('')}</div>
   </details>`;
  }).join('')}
 </section>`;
}
