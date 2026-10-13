import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { IonApp, IonContent, IonIcon, IonToggle, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, checkmark, close, refresh, settingsOutline, play, pause, trophyOutline, sparklesOutline, checkmarkCircle, closeCircle, layersOutline } from 'ionicons/icons';

type View = 'home' | 'game' | 'scoring' | 'between' | 'timeout' | 'roundResult' | 'settings' | 'finished';
type SettingsTab = 'general' | 'visual' | 'players' | 'categories';
type AccentId = 'green' | 'blue' | 'red' | 'yellow' | 'orange';
type CharacterNameSize = 'normal' | 'large' | 'huge';
type SoundKind = 'beep' | 'midpoint' | 'success' | 'error' | 'flip' | 'gear' | 'save' | 'timerToggle' | 'celebration' | 'newGame';
interface Player {name:string;score:number;roundScore:number;correct:number;errors:number;}
interface Character {id:number;name:string;category:string;franchise?:string;nationality:string;birthday:string|null;deathDate:string|null;gender:string;isAlive:boolean;}
interface Category {name:string;color:string;light:string;icon:string;}
const CATEGORY_DATA:Category[] = [
 {name:'Actores de Hollywood',color:'#d990ff',light:'#36234e',icon:'🎬'},
 {name:'Cantantes',color:'#ffb86b',light:'#473124',icon:'🎤'},
 {name:'Personajes históricos',color:'#f1ce78',light:'#423b26',icon:'🏛️'},
 {name:'Superhéroes y villanos',color:'#ff7f9e',light:'#472538',icon:'🦸'},
 {name:'Deportistas',color:'#7ee5ae',light:'#1d433a',icon:'🏆'},
 {name:'Videojuegos',color:'#7db7ff',light:'#203856',icon:'🎮'},
 {name:'Personajes animados',color:'#c3a3ff',light:'#342c53',icon:'🧸'},
 {name:'TV chilena',color:'#79e1e2',light:'#21434a',icon:'📺'}
];
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,IonApp,IonContent,IonIcon,IonToggle,IonSpinner],templateUrl:'./app.component.html',styleUrls:['./app.component.scss']})
export class AppComponent implements OnInit, OnDestroy {
 @ViewChild('rerollDialog',{static:true}) private rerollDialog!:ElementRef<HTMLDialogElement>;
 @ViewChild('homeDialog',{static:true}) private homeDialog!:ElementRef<HTMLDialogElement>;
 private http=inject(HttpClient);
 private revealTimer:ReturnType<typeof setInterval>|null=null;
 private turnTimer:ReturnType<typeof setTimeout>|null=null;
 private turnDeadline=0;
 private pausedTurnRemainingMs=0;
 private halfTimeVibrated=false;
 private fifteenSecondsVibrated=false;
 private lastBeepSecond:number|null=null;
 private soundContext:AudioContext|null=null;
 private soundBuffers:Record<SoundKind,AudioBuffer>|null=null;
 private soundSources=new Map<SoundKind,AudioBufferSourceNode>();
 private soundAudio:Record<SoundKind,HTMLAudioElement>|null=null;
 private soundUrls:Record<SoundKind,string>|null=null;
 private settingsWriteQueue:Promise<void>=Promise.resolve();
 private expiredPlayerIndex:number|null=null;
 private rerollExcludedId:number|null=null;
 private scoringPlayerIndex=0;
 correctingExpiredTurn=false;
 private scoreReturnView:View='between';
 readonly categories=CATEGORY_DATA;
 readonly allCategoryNames=CATEGORY_DATA.map(c=>c.name);
 readonly roundOptions=[1,2,3,5,7,8,10,15];
 readonly timeOptions=[30,60,90,120];
 readonly revealDelayOptions=[1,3,5,10];
 readonly bonusScoreOptions=[1,2,3];
 readonly bonusQuestionOptions=[1,3,5,8];
 readonly baseScoreOptions=[1,2,3,5];
 readonly cluePenaltyOptions=[0,-1,-2,-3];
 readonly characterNameSizeOptions=[{id:'normal',label:'Normal',size:36},{id:'large',label:'Grande',size:52},{id:'huge',label:'Gigante',size:68}] as const;
 readonly accentOptions=[
  {id:'green',label:'Verde',color:'#b4fa66',soft:'#72ce9b'},
  {id:'blue',label:'Azul',color:'#79baff',soft:'#7898ed'},
  {id:'red',label:'Rojo',color:'#ff7f8f',soft:'#e45c75'},
  {id:'yellow',label:'Amarillo',color:'#ffd76d',soft:'#e9aa63'},
  {id:'orange',label:'Naranjo',color:'#ffae68',soft:'#ee8069'}
 ] as const;
 accentId:AccentId='green';
 characterNameSize:CharacterNameSize='normal';
 view:View='home'; characters:Character[]=[]; enabled:string[]=[...this.allCategoryNames];
 settingsTab:SettingsTab='general';
 showStartRequirements=false;
 current:Character|null=null; cardFlipped=false; hasTurnStarted=false; remaining:number[]=[]; skipped=0;loading=true;error=''; countdown=0;
 playerNames:string[]=[];newPlayerName='';roundCount=3;turnDuration=60;revealDelay=5;
 players:Player[]=[];roundNumber=1;playerIndex=0;timeLeft=0;
 bonusScore=1;bonusQuestions=3;baseScore=2;cluePenalty=-1;
 soundEnabled=true;vibrationEnabled=true;
 showFinalRanking=false;
 constructor(){addIcons({arrowBack,checkmark,close,refresh,settingsOutline,play,pause,trophyOutline,sparklesOutline,checkmarkCircle,closeCircle,layersOutline});}
 async ngOnInit():Promise<void>{
  await this.restoreSettings();
  this.http.get<Character[]>('assets/character.json').subscribe({next:(people)=>{this.characters=people;this.loading=false;},error:()=>{this.loading=false;this.error='No se pudo cargar el listado de personajes.';}});
 }
 private async restoreSettings():Promise<void>{
  try{
   const storedCategories=await this.readSetting('adivina.categories');
   if(storedCategories){const stored=JSON.parse(storedCategories);if(Array.isArray(stored))this.enabled=this.allCategoryNames.filter(category=>stored.includes(category));}
   const storedPlayers=await this.readSetting('adivina.players');
   if(storedPlayers){const stored=JSON.parse(storedPlayers);if(Array.isArray(stored))this.playerNames=stored.filter((name):name is string=>typeof name==='string'&&!!name.trim()).map(name=>name.trim());}
   const rounds=Number(await this.readSetting('adivina.rounds'));if(this.roundOptions.includes(rounds))this.roundCount=rounds;
   const duration=Number(await this.readSetting('adivina.duration'));if(this.timeOptions.includes(duration))this.turnDuration=duration;
   const revealDelay=Number(await this.readSetting('adivina.revealDelay'));if(this.revealDelayOptions.includes(revealDelay))this.revealDelay=revealDelay;
   const bonusScore=Number(await this.readSetting('adivina.bonusScore'));if(this.bonusScoreOptions.includes(bonusScore))this.bonusScore=bonusScore;
   const bonusQuestions=Number(await this.readSetting('adivina.bonusQuestions'));if(this.bonusQuestionOptions.includes(bonusQuestions))this.bonusQuestions=bonusQuestions;
   const baseScore=Number(await this.readSetting('adivina.baseScore'));if(this.baseScoreOptions.includes(baseScore))this.baseScore=baseScore;
   const cluePenalty=Number(await this.readSetting('adivina.cluePenalty'));if(this.cluePenaltyOptions.includes(cluePenalty))this.cluePenalty=cluePenalty;
   this.soundEnabled=(await this.readSetting('adivina.soundEnabled'))!=='false';
   this.vibrationEnabled=(await this.readSetting('adivina.vibrationEnabled'))!=='false';
   const storedAccent=await this.readSetting('adivina.accent');if(this.accentOptions.some(option=>option.id===storedAccent))this.accentId=storedAccent as AccentId;
   const storedNameSize=await this.readSetting('adivina.characterNameSize');if(this.characterNameSizeOptions.some(option=>option.id===storedNameSize))this.characterNameSize=storedNameSize as CharacterNameSize;
  }catch{
   this.error='No se pudo cargar toda la configuración guardada.';
  }
 }
 private async readSetting(key:string):Promise<string|null>{
  if(!Capacitor.isNativePlatform())return localStorage.getItem(key);
  try{
   const {value}=await Preferences.get({key});
   if(value!==null)return value;
  }catch{
   this.error='No se pudo leer la configuración nativa; se intentará recuperar la copia local.';
  }
  const legacyValue=localStorage.getItem(key);
  if(legacyValue!==null){
   try{await Preferences.set({key,value:legacyValue});}
   catch{this.error='No se pudo migrar toda la configuración al almacenamiento nativo.';}
  }
  return legacyValue;
 }
 private saveSetting(key:string,value:string):void{
  let localCopySaved=false;
  try{localStorage.setItem(key,value);localCopySaved=true;}catch{}
  if(!Capacitor.isNativePlatform()){
   if(!localCopySaved)this.error='No se pudo guardar la configuración en el dispositivo.';
   return;
  }
  this.settingsWriteQueue=this.settingsWriteQueue.then(async()=>{await Preferences.set({key,value});}).catch(()=>{
   this.error=localCopySaved?'No se pudo guardar en almacenamiento nativo; se conserva la copia local.':'No se pudo guardar la configuración en el dispositivo.';
  });
 }
 ngOnDestroy():void{
  this.clearRevealTimer();this.clearTurnTimer();
  if(this.soundUrls)Object.values(this.soundUrls).forEach(url=>URL.revokeObjectURL(url));
 }
 get categoryCount():number{return this.enabled.length;}
 get accentColor(){return this.accentOptions.find(option=>option.id===this.accentId)!;}
 get availableCount():number{return this.characters.filter(p=>this.enabled.includes(p.category)).length;}
 get canStart():boolean{return this.playerNames.length>=2&&this.categoryCount>0&&this.availableCount>0;}
 get answered():number{return this.players.reduce((total,player)=>total+player.correct+player.errors,0);}
 get category():Category|undefined{return this.categories.find(c=>c.name===this.current?.category);}
 get turnTimerRunning():boolean{return this.turnTimer!==null;}
 get progress():number{return this.players.length?Math.round(((this.roundNumber-1)*this.players.length+this.playerIndex)/(this.roundCount*this.players.length)*100):0;}
 get activePlayer():Player|undefined{return this.players[this.playerIndex];}
 get activePlayerRank():number{
  const player=this.activePlayer;
  return player?1+this.players.filter(other=>other.score>player.score).length:0;
 }
 get scoringPlayer():Player|undefined{return this.players[this.scoringPlayerIndex];}
 get expiredPlayer():Player|undefined{return this.expiredPlayerIndex===null?undefined:this.players[this.expiredPlayerIndex];}
 get roundWinners():Player[]{const highest=Math.max(...this.players.map(p=>p.roundScore));return this.players.filter(p=>p.roundScore===highest);}
 get finalWinners():Player[]{const highest=Math.max(...this.players.map(p=>p.score));return this.players.filter(p=>p.score===highest);}
 get rankedPlayers():Player[]{return [...this.players].sort((a,b)=>b.score-a.score);}
 get roundWinnerNames():string{return this.roundWinners.map(p=>p.name).join(' y ');}
 get finalWinnerNames():string{return this.finalWinners.map(p=>p.name).join(' y ');}
 get formattedTime():string{return `${Math.floor(this.timeLeft/60)}:${String(this.timeLeft%60).padStart(2,'0')}`;}
 signedScore(score:number):string{return score>0?`+${score}`:String(score);}
 get characterAge():number|null{
  const birthday=this.current?.birthday;
  if(!birthday)return null;
  const [year,month,day]=birthday.split('-').map(Number);
  if(!year||!month||!day)return null;
  const endDate=this.current?.isAlive?new Date():this.current?.deathDate?new Date(`${this.current.deathDate}T12:00:00`):null;
  if(!endDate||Number.isNaN(endDate.getTime()))return null;
  const age=endDate.getFullYear()-year-(endDate.getMonth()+1<month||(endDate.getMonth()+1===month&&endDate.getDate()<day)?1:0);
  return age>=0?age:null;
 }
 get vibrationUnavailable():boolean{return !Capacitor.isNativePlatform()&&typeof navigator.vibrate!=='function';}
 get flag():string{
  const raw=this.current?.nationality||'';
  const match:[string,string][]=[['Chile','🇨🇱'],['Estados Unidos','🇺🇸'],['Japón','🇯🇵'],['Italia','🇮🇹'],['Reino Unido','🇬🇧'],['Francia','🇫🇷'],['Alemania','🇩🇪'],['España','🇪🇸'],['Canadá','🇨🇦'],['México','🇲🇽'],['Argentina','🇦🇷'],['Brasil','🇧🇷'],['Australia','🇦🇺'],['Suecia','🇸🇪'],['Polonia','🇵🇱'],['Corea del Sur','🇰🇷'],['Puerto Rico','🇵🇷'],['Colombia','🇨🇴'],['Portugal','🇵🇹'],['Egipto','🇪🇬'],['India','🇮🇳'],['China','🇨🇳'],['Rusia','🇷🇺'],['Países Bajos','🇳🇱'],['Jamaica','🇯🇲'],['Barbados','🇧🇧'],['Serbia','🇷🇸'],['Austria','🇦🇹'],['Grecia','🇬🇷'],['Sudáfrica','🇿🇦'],['Noruega','🇳🇴'],['Suiza','🇨🇭'],['Bélgica','🇧🇪'],['Croacia','🇭🇷'],['Egipto antiguo','🇪🇬'],['Georgia','🇬🇪'],['Cabo Verde','🇨🇻'],['Uruguay','🇺🇾'],['Perú','🇵🇪'],['Nigeria','🇳🇬'],['Irlanda','🇮🇪'],['Nueva Zelanda','🇳🇿']];
  const found=match.find(([country])=>raw.startsWith(country));return found?found[1]:'🌐';
 }
 get countryLabel():string{return this.current?.nationality||'No especificada';}
 isEnabled(name:string):boolean{return this.enabled.includes(name);}
 toggle(name:string,on:boolean):void{
  if(on){if(!this.enabled.includes(name))this.enabled=[...this.enabled,name];}
  else this.enabled=this.enabled.filter(c=>c!==name);
  this.saveSetting('adivina.categories',JSON.stringify(this.enabled));
 }
 selectAll():void{this.enabled=[...this.allCategoryNames];this.saveSetting('adivina.categories',JSON.stringify(this.enabled));}
 deselectAll():void{this.enabled=[];this.saveSetting('adivina.categories',JSON.stringify(this.enabled));}
 addPlayer():void{
  const name=this.newPlayerName.trim();if(!name)return;
  this.playerNames=[...this.playerNames,name];this.newPlayerName='';this.savePlayers();
 }
 removePlayer(index:number):void{this.playerNames=this.playerNames.filter((_,i)=>i!==index);this.savePlayers();}
 movePlayer(index:number,direction:number):void{
  const target=index+direction;if(target<0||target>=this.playerNames.length)return;
  [this.playerNames[index],this.playerNames[target]]=[this.playerNames[target],this.playerNames[index]];
  this.playerNames=[...this.playerNames];this.savePlayers();
 }
 private savePlayers():void{
  this.saveSetting('adivina.players',JSON.stringify(this.playerNames));
  this.prepareAudio();this.playSound('save');
 }
 setRounds(value:number):void{if(this.roundOptions.includes(value)){this.roundCount=value;this.saveSetting('adivina.rounds',String(value));}}
 setDuration(value:number):void{if(this.timeOptions.includes(value)){this.turnDuration=value;this.saveSetting('adivina.duration',String(value));}}
 setRevealDelay(value:number):void{if(this.revealDelayOptions.includes(value)){this.revealDelay=value;this.saveSetting('adivina.revealDelay',String(value));}}
 setBonusScore(value:number):void{if(this.bonusScoreOptions.includes(value)){this.bonusScore=value;this.saveSetting('adivina.bonusScore',String(value));}}
 setBonusQuestions(value:number):void{if(this.bonusQuestionOptions.includes(value)){this.bonusQuestions=value;this.saveSetting('adivina.bonusQuestions',String(value));}}
 setBaseScore(value:number):void{if(this.baseScoreOptions.includes(value)){this.baseScore=value;this.saveSetting('adivina.baseScore',String(value));}}
 setCluePenalty(value:number):void{if(this.cluePenaltyOptions.includes(value)){this.cluePenalty=value;this.saveSetting('adivina.cluePenalty',String(value));}}
 setSoundEnabled(enabled:boolean):void{
  this.soundEnabled=enabled;this.saveSetting('adivina.soundEnabled',String(enabled));
  if(enabled)this.prepareAudio();
  else{
   for(const kind of this.soundSources.keys())this.stopSoundSource(kind);
   if(this.soundAudio)Object.values(this.soundAudio).forEach(audio=>audio.pause());
  }
 }
 setVibrationEnabled(enabled:boolean):void{
  this.vibrationEnabled=enabled;this.saveSetting('adivina.vibrationEnabled',String(enabled));
 }
 setAccent(id:AccentId):void{this.accentId=id;this.saveSetting('adivina.accent',id);}
 setCharacterNameSize(size:CharacterNameSize):void{this.characterNameSize=size;this.saveSetting('adivina.characterNameSize',size);}
 timeLabel(seconds:number):string{return seconds===30?'30 seg':seconds===60?'1 min':seconds===90?'1 min 30 seg':'2 min';}
 requestHome():void{
  if(this.homeDialog.nativeElement.open)return;
  if(this.view==='settings'){this.goHome();return;}
  if(this.view==='game'&&this.cardFlipped){
   this.pauseTurnTimer();
   if(this.pausedTurnRemainingMs===0){this.finishTurn(false,true);return;}
  }
  this.homeDialog.nativeElement.showModal();
 }
 cancelHome():void{
  if(!this.homeDialog.nativeElement.open)return;
  this.homeDialog.nativeElement.close();
  if(this.view==='game'&&this.cardFlipped)this.resumeTurnTimer();
 }
 confirmHome():void{
  if(!this.homeDialog.nativeElement.open)return;
  this.homeDialog.nativeElement.close();
  this.goHome();
 }
 goHome():void{this.clearRevealTimer();this.clearTurnTimer();this.showStartRequirements=false;this.view='home';}
 openSettings():void{this.settingsTab='general';this.view='settings';this.prepareAudio();this.playSound('gear');}
 start():void{
  if(!this.canStart){this.showStartRequirements=true;return;}
  this.showStartRequirements=false;
  this.clearRevealTimer();this.clearTurnTimer();
  this.skipped=0;
  this.players=this.playerNames.map(name=>({name,score:0,roundScore:0,correct:0,errors:0}));
  this.showFinalRanking=false;
  this.roundNumber=1;this.playerIndex=0;this.current=null;
  this.rerollExcludedId=null;
  this.expiredPlayerIndex=null;this.correctingExpiredTurn=false;
  this.remaining=this.characters.filter(p=>this.enabled.includes(p.category)).map(p=>p.id);
  this.view='between';this.beginReveal();this.playSound('newGame',false);
 }
 private pickNext(excludeId?:number):boolean{
  let candidates=this.remaining.filter(id=>id!==excludeId);
  if(candidates.length===0){
   this.remaining=this.characters.filter(p=>this.enabled.includes(p.category)&&p.id!==excludeId).map(p=>p.id);
   candidates=this.remaining;
  }
  if(candidates.length===0)return false;
  const id=candidates[Math.floor(Math.random()*candidates.length)];
  const character=this.characters.find(p=>p.id===id);
  if(!character)return false;
  this.remaining.splice(this.remaining.indexOf(id),1);
  this.current=character;
  this.cardFlipped=false;
  return true;
 }
 flipCard():void{
  if(this.view!=='game'||!this.current)return;
  if(this.cardFlipped){
   this.pauseTurnTimer();
   if(this.pausedTurnRemainingMs===0){this.finishTurn(false,true);return;}
   this.cardFlipped=false;
  }else{
   this.cardFlipped=true;
   this.resumeTurnTimer();
  }
  this.playSound('flip',false);
 }
 toggleTurnTimer():void{
  if(this.view!=='game'||!this.current||!this.cardFlipped)return;
  if(this.turnTimerRunning)this.pauseTurnTimer();
  else{
   if(this.pausedTurnRemainingMs<=0)return;
   this.resumeTurnTimer();
  }
  this.playSound('timerToggle');
 }
 openScoring():void{
  if(this.view!=='game'||!this.current)return;
  if(this.cardFlipped)this.pauseTurnTimer();
  if(this.pausedTurnRemainingMs===0){this.finishTurn(false,true);return;}
  this.scoringPlayerIndex=this.playerIndex;
  this.correctingExpiredTurn=false;
  this.view='scoring';
 }
 scoreIncorrect():void{
  if(this.view!=='scoring'||this.correctingExpiredTurn)return;
  this.pausedTurnRemainingMs=0;
  this.finishTurn(false);
 }
 scoreCorrect(points:number):void{
  const player=this.scoringPlayer;
  if(this.view!=='scoring'||!player)return;
  if(this.correctingExpiredTurn){
   player.errors--;
   this.expiredPlayerIndex=null;
  }
  player.score+=points;player.roundScore+=points;player.correct++;
  this.playSound('success');
  if(this.correctingExpiredTurn){
   this.correctingExpiredTurn=false;this.view=this.scoreReturnView;
  }else{this.pausedTurnRemainingMs=0;this.finishTurn(true);}
 }
 closeScoring():void{
  if(this.view!=='scoring')return;
  if(this.correctingExpiredTurn){
   this.correctingExpiredTurn=false;
   this.view=this.scoreReturnView;
   return;
  }
  this.view='game';
  if(this.cardFlipped)this.resumeTurnTimer();
 }
 correctExpiredTurn():void{
  if(this.expiredPlayerIndex===null||this.countdown>0||!['between','roundResult'].includes(this.view))return;
  const player=this.players[this.expiredPlayerIndex];
  if(!player)return;
  this.scoringPlayerIndex=this.expiredPlayerIndex;
  this.correctingExpiredTurn=true;
  this.scoreReturnView=this.view;
  this.view='scoring';
 }
 private finishTurn(isCorrect:boolean,timedOut=false):void{
  if(!isCorrect){const player=this.activePlayer;if(player)player.errors++;this.playSound('error');}
  this.expiredPlayerIndex=timedOut?this.playerIndex:null;
  if(timedOut){this.view='timeout';return;}
  this.current=null;
  if(this.playerIndex===this.players.length-1){this.view='roundResult';}
  else{this.playerIndex++;this.view='between';}
 }
 continueAfterTimeout():void{
  if(this.view!=='timeout')return;
  this.current=null;
  if(this.playerIndex===this.players.length-1){this.view='roundResult';}
  else{this.playerIndex++;this.view='between';}
 }
 beginReveal():void{
  if(this.view!=='between'||this.revealTimer!==null)return;
  this.prepareAudio();
  this.playBeep();
  this.countdown=this.revealDelay;
  this.revealTimer=setInterval(()=>{
   this.countdown--;
   if(this.countdown===0){
    this.clearRevealTimer();this.expiredPlayerIndex=null;
    const excludedId=this.rerollExcludedId??undefined;
    this.rerollExcludedId=null;
    if(!this.pickNext(excludedId)){this.error='No hay otro personaje disponible.';this.goHome();return;}
    this.view='game';this.prepareTurnTimer();
   }
  },1000);
 }
 private prepareTurnTimer():void{
  this.timeLeft=this.turnDuration;this.pausedTurnRemainingMs=this.turnDuration*1000;this.turnDeadline=0;
  this.hasTurnStarted=false;
  this.halfTimeVibrated=false;this.fifteenSecondsVibrated=false;this.lastBeepSecond=null;
 }
 private resumeTurnTimer():void{
  this.turnDeadline=performance.now()+this.pausedTurnRemainingMs;
  this.pausedTurnRemainingMs=0;
  if(!this.hasTurnStarted)this.hasTurnStarted=true;
  this.scheduleTurnTick();
 }
 private pauseTurnTimer():void{
  this.pausedTurnRemainingMs=Math.max(0,this.turnDeadline-performance.now());
  this.timeLeft=Math.ceil(this.pausedTurnRemainingMs/1000);
  this.clearTurnTimer();
 }
 private scheduleTurnTick():void{
  const nextBoundary=this.turnDeadline-(this.timeLeft-1)*1000;
  this.turnTimer=setTimeout(()=>this.updateTurnTimer(),Math.max(1,nextBoundary-performance.now()+2));
 }
 private updateTurnTimer():void{
  this.turnTimer=null;
  const remaining=Math.max(0,Math.ceil((this.turnDeadline-performance.now())/1000));
  if(remaining===this.timeLeft){this.scheduleTurnTick();return;}
  this.timeLeft=remaining;
  const atHalf=!this.halfTimeVibrated&&remaining<=this.turnDuration/2;
  const atFifteen=!this.fifteenSecondsVibrated&&remaining<=15;
  if(atHalf)this.halfTimeVibrated=true;
  if(atFifteen)this.fifteenSecondsVibrated=true;
  if(remaining>0&&(atHalf||atFifteen)&&this.vibrationEnabled&&!this.vibrationUnavailable)void Haptics.vibrate({duration:atFifteen?500:250}).catch(()=>{});
  if(remaining>0&&atHalf)this.playSound('midpoint');
  if(remaining>0&&remaining<=10&&this.lastBeepSecond!==remaining){
   this.lastBeepSecond=remaining;this.playBeep();
  }
  if(remaining===0){this.clearTurnTimer();this.finishTurn(false,true);}
  else this.scheduleTurnTick();
 }
 private prepareAudio():void{
  if(!this.soundEnabled)return;
  try{
   const session=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;
   if(session)session.type='playback';
  }catch{}
  try{
   const AudioContextConstructor=window.AudioContext;
   if(AudioContextConstructor){
    if(!this.soundContext){
     this.soundContext=new AudioContextConstructor();
     this.soundBuffers={
      beep:this.createSoundBuffer([{frequency:880,duration:0.14}]),
      midpoint:this.createSoundBuffer([{frequency:880,duration:0.14},{frequency:0,duration:0.14},{frequency:880,duration:0.14}]),
      success:this.createSoundBuffer([{frequency:523,duration:0.13},{frequency:659,duration:0.13},{frequency:784,duration:0.23}]),
      error:this.createSoundBuffer([{frequency:280,duration:0.2},{frequency:210,duration:0.3}],true),
      flip:this.createSoundBuffer([{frequency:720,duration:0.07},{frequency:520,duration:0.07},{frequency:360,duration:0.09}]),
      gear:this.createSoundBuffer([{frequency:620,duration:0.045},{frequency:460,duration:0.055},{frequency:560,duration:0.045},{frequency:380,duration:0.075}],true),
      save:this.createSoundBuffer([{frequency:660,duration:0.08},{frequency:880,duration:0.12}]),
       timerToggle:this.createSoundBuffer([{frequency:520,duration:0.06},{frequency:390,duration:0.06}]),
       celebration:this.createSoundBuffer([{frequency:523,duration:0.3},{frequency:659,duration:0.3},{frequency:784,duration:0.3},{frequency:1047,duration:0.6},{frequency:784,duration:0.3},{frequency:1047,duration:0.6},{frequency:1318,duration:0.6},{frequency:1047,duration:0.3},{frequency:1318,duration:1.7}]),
       newGame:this.createSoundBuffer([{frequency:392,duration:0.09},{frequency:523,duration:0.09},{frequency:659,duration:0.13},{frequency:784,duration:0.22}])
     };
    }
    void this.soundContext.resume().catch(()=>{});
    return;
   }
  }catch{}
  try{
   if(!this.soundAudio){
    this.soundUrls={
     beep:this.createSound([{frequency:880,duration:0.14}]),
     midpoint:this.createSound([{frequency:880,duration:0.14},{frequency:0,duration:0.14},{frequency:880,duration:0.14}]),
     success:this.createSound([{frequency:523,duration:0.13},{frequency:659,duration:0.13},{frequency:784,duration:0.23}]),
     error:this.createSound([{frequency:280,duration:0.2},{frequency:210,duration:0.3}],true),
     flip:this.createSound([{frequency:720,duration:0.07},{frequency:520,duration:0.07},{frequency:360,duration:0.09}]),
     gear:this.createSound([{frequency:620,duration:0.045},{frequency:460,duration:0.055},{frequency:560,duration:0.045},{frequency:380,duration:0.075}],true),
     save:this.createSound([{frequency:660,duration:0.08},{frequency:880,duration:0.12}]),
     timerToggle:this.createSound([{frequency:520,duration:0.06},{frequency:390,duration:0.06}]),
     celebration:this.createSound([{frequency:523,duration:0.3},{frequency:659,duration:0.3},{frequency:784,duration:0.3},{frequency:1047,duration:0.6},{frequency:784,duration:0.3},{frequency:1047,duration:0.6},{frequency:1318,duration:0.6},{frequency:1047,duration:0.3},{frequency:1318,duration:1.7}]),
     newGame:this.createSound([{frequency:392,duration:0.09},{frequency:523,duration:0.09},{frequency:659,duration:0.13},{frequency:784,duration:0.22}])
    };
    this.soundAudio={
     beep:new Audio(this.soundUrls.beep),
     midpoint:new Audio(this.soundUrls.midpoint),
     success:new Audio(this.soundUrls.success),
     error:new Audio(this.soundUrls.error),
     flip:new Audio(this.soundUrls.flip),
     gear:new Audio(this.soundUrls.gear),
     save:new Audio(this.soundUrls.save),
     timerToggle:new Audio(this.soundUrls.timerToggle),
     celebration:new Audio(this.soundUrls.celebration),
     newGame:new Audio(this.soundUrls.newGame)
    };
    for(const audio of Object.values(this.soundAudio)){audio.preload='auto';audio.load();}
   }
  }catch{}
 }
 private createSoundBuffer(notes:{frequency:number;duration:number}[],horn=false):AudioBuffer{
  const context=this.soundContext!;
  const sampleRate=context.sampleRate;
  const sampleCount=Math.round(notes.reduce((total,note)=>total+note.duration,0)*sampleRate);
  const buffer=context.createBuffer(1,sampleCount,sampleRate);
  const samples=buffer.getChannelData(0);
  let offset=0;
  for(const note of notes){
   const length=Math.round(note.duration*sampleRate);
   for(let i=0;i<length&&offset+i<sampleCount;i++){
    const fade=Math.min(1,i/(sampleRate*0.01),(length-i)/(sampleRate*0.03));
    const phase=2*Math.PI*note.frequency*i/sampleRate;
    const wave=horn?Math.sin(phase)+0.45*Math.sin(2*phase)+0.2*Math.sin(3*phase):Math.sin(phase);
    samples[offset+i]=wave*fade*(horn?14000/32768:16000/32768);
   }
   offset+=length;
  }
  return buffer;
 }
 private createSound(notes:{frequency:number;duration:number}[],horn=false):string{
  const sampleRate=16000;
  const sampleCount=Math.round(notes.reduce((total,note)=>total+note.duration,0)*sampleRate);
  const wav=new ArrayBuffer(44+sampleCount*2);
  const view=new DataView(wav);
  const writeText=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  writeText(0,'RIFF');view.setUint32(4,36+sampleCount*2,true);writeText(8,'WAVE');
  writeText(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  writeText(36,'data');view.setUint32(40,sampleCount*2,true);
  let offset=0;
  for(const note of notes){
   const length=Math.round(note.duration*sampleRate);
   for(let i=0;i<length&&offset+i<sampleCount;i++){
    const fade=Math.min(1,i/(sampleRate*0.01),(length-i)/(sampleRate*0.03));
    const phase=2*Math.PI*note.frequency*i/sampleRate;
    const wave=horn?Math.sin(phase)+0.45*Math.sin(2*phase)+0.2*Math.sin(3*phase):Math.sin(phase);
    view.setInt16(44+(offset+i)*2,Math.round(wave*fade*(horn?14000:16000)),true);
   }
   offset+=length;
  }
  return URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
 }
 private playBeep():void{this.playSound('beep');}
 private playSound(kind:SoundKind,exclusive=true):void{
  if(!this.soundEnabled)return;
  const context=this.soundContext;
  const buffer=this.soundBuffers?.[kind];
  if(context&&buffer){
   try{
    if(context.state==='suspended')void context.resume().catch(()=>{});
    if(exclusive)for(const sourceKind of this.soundSources.keys())this.stopSoundSource(sourceKind);
    else this.stopSoundSource(kind);
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.connect(context.destination);
    this.soundSources.set(kind,source);
    source.onended=()=>{if(this.soundSources.get(kind)===source)this.soundSources.delete(kind);};
    source.start();
   }catch{}
   return;
  }
  const players=this.soundAudio;
  if(!players)return;
  const audio=players[kind];
  try{
   if(exclusive)for(const other of Object.values(players))if(other!==audio)other.pause();
   if(audio.readyState>0)audio.currentTime=0;
   void audio.play().catch(()=>{});
  }catch{}
 }
 private stopSoundSource(kind:SoundKind):void{
  const source=this.soundSources.get(kind);
  if(!source)return;
  this.soundSources.delete(kind);
  source.onended=null;
  try{source.stop();}catch{}
 }
 private clearTurnTimer():void{
  if(this.turnTimer!==null){clearTimeout(this.turnTimer);this.turnTimer=null;}
  for(const kind of this.soundSources.keys())this.stopSoundSource(kind);
  if(this.soundAudio)Object.values(this.soundAudio).forEach(audio=>audio.pause());
 }
 nextRound():void{
  if(this.view!=='roundResult')return;
  if(this.roundNumber===this.roundCount){this.view='finished';this.playSound('celebration');return;}
  this.expiredPlayerIndex=null;
  this.roundNumber++;this.playerIndex=0;
  this.players.forEach(player=>player.roundScore=0);
  this.view='between';
 }
 private clearRevealTimer():void{
  if(this.revealTimer!==null){clearInterval(this.revealTimer);this.revealTimer=null;}
  this.countdown=0;
 }
 reroll():void{
  if(this.view!=='game'||!this.current)return;
  if(this.rerollDialog.nativeElement.open)return;
  const previousId=this.current.id;
  if(!this.characters.some(p=>this.enabled.includes(p.category)&&p.id!==previousId))return;
  const wasRunning=this.cardFlipped;
  if(wasRunning)this.pauseTurnTimer();
  if(this.pausedTurnRemainingMs===0){this.finishTurn(false,true);return;}
  this.rerollDialog.nativeElement.showModal();
 }
 cancelReroll():void{
  if(!this.rerollDialog.nativeElement.open)return;
  this.rerollDialog.nativeElement.close();
  if(this.cardFlipped)this.resumeTurnTimer();
 }
 confirmReroll():void{
  if(!this.rerollDialog.nativeElement.open||this.view!=='game'||!this.current)return;
  this.rerollDialog.nativeElement.close();
  this.skipped++;
  this.clearTurnTimer();
  this.pausedTurnRemainingMs=0;
  this.rerollExcludedId=this.current.id;
  this.current=null;
  this.cardFlipped=false;
  this.view='between';
  this.beginReveal();
 }
}
