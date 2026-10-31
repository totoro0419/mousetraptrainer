import {AudioPlayer} from './audio.js';
import {loadAudioManifest,resolveClip,NextClipPreloader} from './audio-library.js';
import {selectRange,createSession,transition} from './session.js';

export function speakingSeconds(duration,rate,extra=2){return Math.max(3,Math.min(600,(duration||3)/rate*1.25+extra));}
export class AudioSession{
 constructor(ctx,{player=new AudioPlayer(),resolve=resolveClip,manifest=loadAudioManifest,preloader=new NextClipPreloader()}={}){
  this.ctx=ctx;this.player=player;this.resolve=resolve;this.preloader=preloader;
  this.listeners=new Set();this.epoch=0;this.phase='idle';this.mode='read';this.line=null;
  this.position=0;this.duration=0;this.message='';this.follow=true;this.continuous=false;
  this.prefs=ctx.small.audioPractice={auto:false,extra:2,repeat:false,showOwn:false,...ctx.small.audioPractice};
  this.manifest=manifest(ctx.data).then(m=>{
   this.map=m;
   if(this.mode==='practice'&&this.line){this.duration=m?.get(this.line.id)?.duration||this.duration;if(this.phase==='own'&&this.timer){this.clearTimer();this.armOwn();}this.emit(false);}
   return m;
  }).catch(err=>{this.manifestError=err;return null;});
  this.hide=()=>{if(document.hidden)this.pause();};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.hide);
 }
 subscribe(fn){this.listeners.add(fn);fn(this);return()=>this.listeners.delete(fn);}
 emit(persist=true){if(persist||Date.now()-(this.lastSaved||0)>1000){this.persist();this.lastSaved=Date.now();}for(const fn of this.listeners)fn(this);}
 persist(){
  const {small,save}=this.ctx;
  if(this.line&&this.mode==='read')small.audioRead={id:this.line.id,position:this.player.audio?this.player.position:this.position,continuous:this.continuous,follow:this.follow};
  if(this.mode==='practice'&&this.line){
   const mode=this.practiceMode;small.sessions[mode]={role:this.role,range:this.range,index:this.index,lineId:this.line.id,position:this.player.audio?this.player.position:this.position,revealed:this.revealed};
  }
  save();
 }
 clearTimer(){clearTimeout(this.timer);this.timer=null;this.deadline=null;}
 cancel(){this.epoch++;this.clearTimer();this.player.stop();this.preloader.clear();}
 stop(){this.persist();this.cancel();if(this.mode==='practice'){this.mode='read';this.line=null;}this.phase='idle';this.emit();}
 pause(){
  if(this.phase==='own'&&this.timer){this.remaining=Math.max(0,(this.deadline-Date.now())/1000);this.clearTimer();this.waitPaused=true;this.emit();return;}
  if(['playing','loading'].includes(this.phase)){this.position=this.player.position;this.epoch++;this.player.pause();this.phase='paused';this.emit();}
 }
 setRate(rate){if(![.75,1,1.25,1.5].includes(+rate))return;this.ctx.small.rate=+rate;this.player.setRate(+rate);this.emit();}
 setPrefs(prefs){Object.assign(this.prefs,prefs);this.ctx.save();if(this.phase==='own'){this.clearTimer();this.waitPaused=false;this.armOwn();}this.emit();}
 select(line,{play=false,continuous=this.continuous}={}){
  this.cancel();this.mode='read';this.line=line;this.phase='idle';this.position=0;this.duration=this.map?.get(line.id)?.duration||0;this.continuous=continuous;this.message='';this.emit();if(play)return this.play();
 }
 restoreRead(){const saved=this.ctx.small.audioRead,line=this.ctx.data.lines.find(l=>l.id===saved?.id);if(line){this.select(line,{continuous:!!saved.continuous});this.position=saved.position||0;this.follow=saved.follow!==false;this.phase='paused';this.emit();}}
 async play({model=false,restart=false}={}){
  if(!this.line)return;
  const token=++this.epoch,id=this.line.id;
  this.clearTimer();this.player.stop();this.preloader.clear();this.model=model;
  this.phase='loading';this.message='';if(restart)this.position=0;this.emit();
  try{
   const map=await this.manifest;
   if(token!==this.epoch)return;
   const clip=await this.resolve(this.ctx.data,id,map);
   if(token!==this.epoch)return;
   if(!clip){this.phase='missing';this.message=this.manifestError?.message||'このセリフの音声は未収録です。手動で次へ進めます。';this.emit();return;}
   this.duration=clip.duration||0;
   await this.player.play(clip,{rate:this.ctx.small.rate,position:this.position,
    onready:()=>{if(token!==this.epoch)return;this.phase='playing';this.emit();},
    onwaiting:()=>{if(token!==this.epoch)return;this.phase='loading';this.emit();},
    ontime:(p,d)=>{if(token!==this.epoch)return;this.position=p;this.duration=Number.isFinite(d)?d:this.duration;this.emit(false);},
    onended:()=>{if(token!==this.epoch)return;this.position=0;
     if(this.model){this.model=false;this.player.stop();this.phase='own';this.waitPaused=true;this.emit();return;}
     if(this.mode==='practice'||this.continuous){this.step(1,true);}
     else{this.player.stop();this.phase='ended';this.emit();}
    },onerror:err=>{if(token===this.epoch)this.fail(err);}});
   if(token===this.epoch&&this.phase==='loading'){this.phase='playing';this.emit();}
   if(token===this.epoch){const next=this.mode==='practice'?this.lines[this.index+1]:this.ctx.data.lines[this.line.index+1];if(next&&!(this.mode==='practice'&&next.speaker===this.role))this.preloader.set(map?.get(next.id));}
  }catch(err){if(token===this.epoch)this.fail(err);}
 }
 fail(err){this.phase='error';this.message=err.name==='NotAllowedError'?'再生ボタンを押して音声を開始してください。':`音声を再生できません。通信を確認して再試行してください。${err.message}`;this.emit();}
 async toggle(){
  if(['playing','loading'].includes(this.phase)){this.pause();return;}
  if(this.phase==='own'){this.waitPaused=false;this.armOwn();this.emit();return;}
  return this.play();
 }
 replay(){return this.play({model:this.mode==='practice'&&this.line?.speaker===this.role,restart:true});}
 seek(seconds){this.position=Math.max(0,Math.min(+seconds||0,this.duration||Infinity));if(this.player.audio)this.player.seek(this.position);this.emit();}
 startPractice(mode,range,{resume=false}={}){
  const lines=selectRange(this.ctx.data,range);this.cancel();this.mode='practice';this.practiceMode=mode;this.lines=lines;this.range=range;this.role=this.ctx.small.role;
  const saved=resume?this.ctx.small.sessions[mode]:null;
  const i=saved?.role===this.role?lines.findIndex(l=>l.id===saved.lineId):0;
  this.enter(Math.max(0,i),{position:saved?.position||0,revealed:!!saved?.revealed,autoplay:!resume});
 }
 enter(index,{position=0,revealed=false,autoplay=true}={}){
  this.cancel();this.index=index;this.line=this.lines[index];this.position=position;this.revealed=revealed;this.model=false;this.waitPaused=!autoplay;
  if(index>=this.lines.length){this.line=null;this.phase='complete';delete this.ctx.small.sessions[this.practiceMode];this.emit();return;}
  const state=createSession(this.lines,this.role,this.practiceMode==='audio'?'audio':'cloze',index);
  this.practiceState=state;
  if(state.phase==='complete'){this.line=null;this.phase='complete';delete this.ctx.small.sessions[this.practiceMode];this.emit();return;}
  this.duration=this.map?.get(this.line.id)?.duration||0;this.message='';
  this.phase=this.line.speaker===this.role?'own':this.practiceMode==='audio'?'paused':'cue';this.emit();
  if(this.phase==='own'&&autoplay)this.armOwn();
  else if(autoplay&&this.practiceMode==='audio')this.play();
 }
 armOwn(){if(this.mode!=='practice'||this.practiceMode!=='audio'||!this.prefs.auto||this.waitPaused)return;
  const seconds=this.remaining??speakingSeconds(this.duration,this.ctx.small.rate,Number(this.prefs.extra)||0);this.remaining=null;
  this.deadline=Date.now()+seconds*1000;this.timer=setTimeout(()=>{this.timer=null;this.step(1,true);},seconds*1000);
 }
 reveal(){const wasShown=this.revealed||this.prefs.showOwn;this.prefs.showOwn=false;this.revealed=!wasShown;this.practiceState=transition(this.practiceState,'reveal',this.lines);this.emit();}
 step(delta=1,autoplay=false){
  if(this.mode==='read'){
   const line=this.ctx.data.lines[this.line.index+delta];if(!line){this.cancel();this.phase='ended';this.emit();return;}
   this.select(line,{play:autoplay,continuous:this.continuous});return;
  }
  const next=this.index+delta;this.remaining=null;
  if(next<0)return;
  if(next>=this.lines.length&&this.prefs.repeat){this.enter(0);return;}
  this.enter(next,{autoplay:autoplay||delta>0});
 }
 dispose(){this.persist();this.cancel();this.listeners.clear();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.hide);}
}
