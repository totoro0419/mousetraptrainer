// Editorial practice divisions. These are NOT original printed scene labels.
// Global positions were cross-checked against 1,164 production speech IDs and speaker order.
// Section boundaries include their first/last speech; associated stage directions remain linked.
const ROWS=[["S01","act1-scene1","開幕と殺人事件の報道","舞台設定とラジオ報道",1,2],["S02","act1-scene1","モリーとジャイルズの開業準備","雪への心配と宿泊客を迎える準備",3,44],["S03","act1-scene1","最初の宿泊客・レン","レンが到着し夫妻と会話する",45,74],["S04","act1-scene1","ボイル夫人の到着","宿と設備への不満",75,97],["S05","act1-scene1","メトカーフ少佐と客室問題","少佐の到着と客室割り",98,125],["S06","act1-scene1","ケースウェルの来訪","ケースウェルが到着する",126,134],["S07","act1-scene1","新聞が伝える事件","ロンドンの事件についての会話",135,151],["S08","act1-scene1","夕食準備と宿泊客への疑念","料理の提案と宿泊客への疑問",152,173],["S09","act1-scene1","パラヴィチーニの突然の到着","突然の訪問者",174,190],["S10","act1-scene2","翌日の宿の様子","翌日の宿と客たち",191,214],["S11","act1-scene2","ボイル夫人とケースウェル","二人の言い合い",215,242],["S12","act1-scene2","レンとケースウェルの会話","過去をうかがわせる会話",243,266],["S13","act1-scene2","警察からの電話","警察からの連絡",267,284],["S14","act1-scene2","ボイル夫人の詮索","宿泊客への疑い",285,303],["S15","act1-scene2","パラヴィチーニの忠告","宿泊客への警戒",304,333],["S16","act1-scene2","トロッターの到着","警官の到着と連絡不通",334,360],["S17","act1-scene2","過去の事件と警察の警告","事件の背景を説明する",361,394],["S18","act1-scene2","三匹の盲目のネズミ","童謡の手掛かり",395,411],["S19","act1-scene2","宿泊客の身元確認","関係者の確認",412,426],["S20","act1-scene2","レンの挑発とボイル夫人の過去","過去との関係",427,457],["S21","act1-scene2","モリーとケースウェルの幼少期","子ども時代の記憶",458,486],["S22","act1-scene2","電話線と屋敷内の疑惑","連絡断絶と内部への疑い",487,522],["S23","act1-scene2","ボイル夫人が一人になる","第一幕終盤の事件",523,526],["S24","act2","第二幕・事件直後","事件後の状況確認",527,550],["S25","act2","ジャイルズとレンの行動確認","二人の動きを検証",551,586],["S26","act2","ケースウェルと少佐の行動確認","二人の居場所を検証",587,618],["S27","act2","レンへの疑いとモリーの擁護","疑いと反論",619,628],["S28","act2","モリーとトロッターの個別面談","二人での確認",629,673],["S29","act2","モリーとジャイルズへの疑念","夫妻の秘密が浮かぶ",674,705],["S30","act2","レンの偽名と過去","本名と過去の事情",706,751],["S31","act2","ジャイルズへの疑念","夫への疑い",752,769],["S32","act2","ジャイルズの嫉妬と夫婦の衝突","夫婦間の不信",770,836],["S33","act2","パラヴィチーニの介入とスキー消失","介入とスキーの消失",837,893],["S34","act2","第三の犠牲者への警告","再度の警戒",894,909],["S35","act2","パラヴィチーニへの尋問","素性を問いただす",910,949],["S36","act2","ケースウェルへの尋問","経歴を問いただす",950,1015],["S37","act2","違和感の発覚と再集合","全員が広間に戻る",1016,1041],["S38","act2","犯行時の行動を再現","行動の再現実験",1042,1091],["S39","act2","再現実験から真相へ","核心への対話",1092,1119],["S40","act2","事件の収束と結末","真相整理と結末",1120,1164]];
export const PRACTICE_SCENES=Object.freeze(ROWS.map(([id,group,title,summary,start,end])=>Object.freeze({id,group,title,summary,start,end})));
export const PRACTICE_GROUPS=Object.freeze([
 {id:'act1-scene1',title:'第1幕・第1場',start:1,end:190},
 {id:'act1-scene2',title:'第1幕・第2場',start:191,end:526},
 {id:'act2',title:'第2幕',start:527,end:1164}
]);
const pad=i=>String(i).padStart(4,'0');
export function hasPracticeSource(data){
 if(data?.id!=='mousetrap-private'||data?.lines?.length!==1164)return false;
 // Do not apply editorial offsets to a modified or imported script.
 return PRACTICE_GROUPS.every(group=>data.lines.slice(group.start-1,group.end).every((line,i)=>
  line.scene===group.id&&line.id===group.id+'-speech-'+pad(i+1)));
}
export function practicePartForRange(range){
 if(!range)return null;
 const part=PRACTICE_SCENES.find(p=>p.id===range.practiceId);
 if(!part||part.group!==range.scene)return null;
 const group=PRACTICE_GROUPS.find(g=>g.id===part.group);
 return +range.from===part.start-group.start+1&&+range.to===part.end-group.start+1?part:null;
}
export function practiceRangeLabel(range,fallback){
 const part=practicePartForRange(range);
 return part?part.id+' · '+part.title:fallback;
}
export function getPracticeParts(data,role,progress={}){
 if(!hasPracticeSource(data))return [];
 return PRACTICE_SCENES.map(part=>{
  const group=PRACTICE_GROUPS.find(g=>g.id===part.group);
  const lines=data.lines.slice(part.start-1,part.end);
  const mine=lines.filter(line=>line.speaker===role);
  const mastered=mine.filter(line=>progress[line.id]?.level===2).length;
  const review=mine.filter(line=>progress[line.id]?.review).length;
  return {...part,from:part.start-group.start+1,to:part.end-group.start+1,
   length:lines.length,ownCount:mine.length,mastered,review,
   ownedPercent:Math.round(mine.length/lines.length*100),
   memorizedPercent:mine.length?Math.round(mastered/mine.length*100):0};
 });
}
