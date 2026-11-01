// Presentation-only metrics for the compact home dashboard.
export const HOME_RING_OUTER_LENGTH=2*Math.PI*55;
export const HOME_RING_INNER_LENGTH=2*Math.PI*36;
// The ring represents days remaining in the year ending on 2027-04-27.
export const FESTIVAL_RING_WINDOW_DAYS=365;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const fraction=(value,total)=>total>0?value/total:0;

export function homeProgressRings(stats) {
 const total=Math.max(0,Number(stats.total)||0);
 const completed=clamp(Number(stats.counts?.[2])||0,0,total);
 const practicing=clamp(Number(stats.counts?.[1])||0,0,total-completed);
 const unstarted=total-completed-practicing;
 const doneRatio=fraction(completed,total);
 const doingRatio=fraction(practicing,total);
 const doneLength=HOME_RING_OUTER_LENGTH*doneRatio;
 const doingLength=HOME_RING_OUTER_LENGTH*doingRatio;
 return {
  completed,practicing,unstarted,total,
  completedPercent:Math.round(doneRatio*100),
  practicingPercent:Math.round(doingRatio*100),
  unstartedPercent:Math.round(fraction(unstarted,total)*100),
  doneDash:`${doneLength.toFixed(3)} ${HOME_RING_OUTER_LENGTH.toFixed(3)}`,
  doingDash:`${doingLength.toFixed(3)} ${HOME_RING_OUTER_LENGTH.toFixed(3)}`,
  doingOffset:(-doneLength).toFixed(3)
 };
}

export function festivalRemainingRing(state) {
 const days=Number(state.days);
 const remaining=Number.isFinite(days)?clamp(days,0,FESTIVAL_RING_WINDOW_DAYS):0;
 const length=HOME_RING_INNER_LENGTH*remaining/FESTIVAL_RING_WINDOW_DAYS;
 return {
  dash:`${length.toFixed(3)} ${HOME_RING_INNER_LENGTH.toFixed(3)}`,
  prefix:days>0?'残り':'',
  value:days>0?`${days}日`:days===0?'本日':'終了',
  description:days>0?`聖光祭まで残り${days}日`:days===0?'聖光祭は本日開催':'聖光祭は終了しました'
 };
}
