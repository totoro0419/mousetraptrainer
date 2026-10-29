export function createSession(lines,role,mode,index=0){if(!lines.length)return {index:0,phase:'complete',role,mode};const i=Math.max(0,Math.min(index,lines.length-1));return {index:i,phase:lines[i].speaker===role?'hidden':mode==='audio'?'ready':'cue',role,mode};}
export function transition(state,event,lines){
 if(state.phase==='complete')return state;
 if(event==='reveal'&&state.phase==='hidden')return {...state,phase:'revealed'};
 if(event==='playing'&&['ready','paused','error','missing'].includes(state.phase))return {...state,phase:'playing'};
 if(event==='pause'&&state.phase==='playing')return {...state,phase:'paused'};
 if(event==='ended'&&state.phase==='playing')return {...state,phase:'cue'};
 if(event==='missing'&&state.phase==='ready')return {...state,phase:'missing'};
 if(event==='error'&&state.phase==='playing')return {...state,phase:'error'};
 if(event==='previous')return createSession(lines,state.role,state.mode,Math.max(0,state.index-1));
 if(event==='next'){
  if(state.phase==='hidden')return {...state,phase:'revealed'};
  const index=state.index+1;return index>=lines.length?{...state,index:lines.length,phase:'complete'}:createSession(lines,state.role,state.mode,index);
 }
 return state;
}
export function selectRange(data,range){const list=range.scene==='all'?data.lines:data.lines.filter(l=>l.scene===range.scene);const from=Number(range.from),to=Number(range.to)||list.length;if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>list.length)throw Error(`練習範囲は1〜${list.length}の間で、開始≦終了にしてください。`);return list.slice(from-1,to);}
