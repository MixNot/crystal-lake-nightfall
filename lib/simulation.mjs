import{WORLD,ROOM,ROLE_NAMES,ITEM_NAMES,createWorld,rng,clamp,dist,within,nearPoint,door,windowPoint,windowInside,houseWindows,hideable,fuseBox,blocked,move,motionStep,clearLine,route}from'./world.mjs';
const NAMES=['Алекс','Морган','Рэй','Крис','Сэм','Тейлор','Джесси','Кэмерон','Дрю','Робин','Джордан','Кейси'];
const alive=a=>!a.dead&&!a.escaped;
export function createGame(players,seed=Date.now()>>>0){
 const map=createWorld(seed),g={seed,t:0,score:0,kills:0,escaped:0,total:12,ended:false,winner:null,random:seed>>>0,houses:map.houses.map(h=>({...h,windows:houseWindows(h.id),power:true,locked:[1,2,7].includes(h.id),barricade:0,checked:[false,false,false,false]})),actors:[],items:[],projects:[],traps:[],sounds:[],effects:[],events:[],nextEvent:1};
 g.projects=[{id:0,name:'Машина',x:490,y:940,scene:-1,needs:['battery','fuel','keys'],installed:{},progress:0,ready:false,departed:false,board:0,passengers:[]},{id:1,name:'Лодка',x:2080,y:1020,scene:-1,needs:['fuel','propeller','rope'],installed:{},progress:0,ready:false,departed:false,board:0,passengers:[]},{id:2,name:'Радио',x:1880,y:300,scene:-1,needs:['fuse','radio','battery'],installed:{},progress:0,ready:false,departed:false,rescue:0,passengers:[]}];
 const killer=baseActor('jason','Джейсон','jason',-1,990,420);Object.assign(killer,{hp:100,maxHp:100,stamina:1,knives:3,trapStock:3,rage:0,patrol:1});g.actors.push(killer);
 const spots=[{x:286,y:343},{x:465,y:130},{x:650,y:337},{x:310,y:470}];
 for(let i=0;i<12;i++){const role=['mechanic','scout','guard','medic'][i%4],team=Math.floor(i/4),home=(i*2+team)%9,p=spots[(i+1)%4],a=baseActor('n'+i,NAMES[i],role,home,p.x,p.y);Object.assign(a,{team,home,hp:2,maxHp:2,medkits:role==='medic'?2:0,weapon:role==='guard'?['rifle','bat','flare'][team]:null,ammo:role==='guard'?(team===0?2:team===1?4:1):0,decide:i*.07,tripwires:role==='guard'?2:0});g.actors.push(a);}
 for(const p of g.projects)for(let j=0;j<p.needs.length;j++)for(let copy=0;copy<2;copy++){const s=(p.id*3+j*2+copy+1)%9,point=spots[(j+copy)%4];g.items.push({id:'item'+g.items.length,kind:p.needs[j],plan:p.id,scene:s,...point,taken:false,destroyed:false,claim:null});}
 for(let i=0;i<6;i++)g.items.push({id:'weapon'+i,kind:'weapon',scene:[1,7,0,3,6,8][i],x:310,y:130,taken:false,destroyed:false,claim:null});
 for(let i=0;i<4;i++)g.items.push({id:'med'+i,kind:'medkit',scene:[5,5,3,8][i],x:460+i*25,y:475,taken:false,destroyed:false,claim:null});
 for(const p of players){let a=p.role==='jason'?killer:g.actors.find(a=>a.role===p.role&&!a.human);if(a){a.human=p.id;a.name=p.role==='jason'?'Джейсон · '+p.name:p.name;p.actorId=a.id;}}
 return g;
}
function baseActor(id,name,role,scene,x,y){return{id,name,role,scene,x,y,fx:0,fy:1,lx:0,ly:1,flashlight:true,moveAck:0,moveEpoch:0,recoverDelay:0,walk:0,moving:false,dead:false,escaped:false,hidden:false,hideSlot:null,stamina:1,hp:2,maxHp:2,stun:0,immune:0,block:0,swing:0,hit:false,crouch:false,exhausted:false,recoverAt:0,bag:null,human:null,nav:[],goal:null,repath:0,job:null,action:0,decide:0,aware:0,fear:0,weapon:null,ammo:0,shotCD:0,windup:0,aim:null,medkits:0,tripwires:0,trapCD:12,lastAttack:-99,lastHit:-99,cooldowns:{},sense:0,dash:0,fury:0,repair:null,task:null,input:{dx:0,dy:0,run:false},inputAt:0,message:null};}
function random(g){g.random=(Math.imul(g.random,1664525)+1013904223)>>>0;return g.random/4294967296;}
function ownMessage(g,a,text){a.message={text,until:g.t+3.5};}
function event(g,text,type='info'){g.events.push({id:g.nextEvent++,t:g.t,text,type});g.events=g.events.slice(-18);}
function sound(g,a,type='step',radius=350){g.sounds.push({id:g.nextEvent++,actor:a.id??null,x:a.x,y:a.y,scene:a.scene,type,radius,t:g.t});g.sounds=g.sounds.slice(-35);}
function effect(g,a,b,type){g.effects.push({id:g.nextEvent++,x:a.x,y:a.y-25,tx:b.x,ty:b.y-25,scene:a.scene,type,t:g.t});g.effects=g.effects.slice(-15);}
function isKiller(a){return a.role==='jason';}
function windows(h){return h.windows||(h.windows=houseWindows(h.id));}
export function vision(g,a){return isKiller(a)?a.scene<0?270:g.houses[a.scene].power?235:175:a.hidden||a.flashlight===false?65:390;}
export function illuminated(g,a,b){
 if(a.scene!==b.scene)return false;const d=dist(a,b);if(d>vision(g,a))return false;
 if(!isKiller(a)&&d>62){const lx=a.lx??a.fx??0,ly=a.ly??a.fy??1;if(((b.x-a.x)*lx+(b.y-a.y)*ly)/Math.max(1,d)<Math.cos(Math.PI*.26))return false;}
 return clearLine(createWorld(g.seed),a,b);
}
export function canSee(g,a,b){return !b.hidden&&illuminated(g,a,b);}
function unhide(g,a){
 if(!a.hidden)return;const slot=a.hideSlot;a.hidden=false;a.hideSlot=null;const map=createWorld(g.seed),p=a.hideReturn;
 if(p&&!blocked(map,p.x,p.y,10,a.scene)){a.x=p.x;a.y=p.y;}
 else{const f=map.layouts[a.scene]?.find(f=>f.slot===slot);if(f){a.x=f.x+f.w/2;a.y=f.y+f.h+22;}}
 a.hideReturn=null;a.moveEpoch=(a.moveEpoch||0)+1;a.input={dx:0,dy:0,run:false};sound(g,a,'unhide',100);
}
function activeHuman(room,a,now){return a.human&&room.players.some(p=>p.id===a.human&&now-p.last<12000);}
function approach(g,a,target,dt){
 const map=createWorld(g.seed);let p=target;
 if(a.scene!==target.scene){if(a.scene>=0){const h=g.houses[a.scene];const w=windows(h).find(w=>w.state==='open'||w.state==='broken');p=h.barricade>0&&w?windowInside(w):{x:380,y:500};if(dist(a,p)<29){const out=h.barricade>0&&w?windowPoint(h,w.id):door(h);enter(g,a,-1,{x:out.x,y:out.y+17},h.barricade>0&&w?'vault':'door');a.repath=0;return false;}}
 else{p=door(g.houses[target.scene]);if(dist(a,p)<29){enter(g,a,target.scene,{x:380,y:485});a.repath=0;return false;}}}
 if(a.scene===target.scene&&dist(a,target)<32)return true;
 a.repath-=dt;if(a.repath<=0||!a.nav.length||a.navScene!==a.scene){a.nav=route(map,p,a,a.scene);a.repath=1.7;a.navScene=a.scene;}
 if(a.nav.length){const goal=a.nav[0],d=dist(a,goal);if(d<7)a.nav.shift();else{a.fx=(goal.x-a.x)/d;a.fy=(goal.y-a.y)/d;const speed=(a.role==='scout'?115:103)*(a.hp===1?.85:1);move(map,a,a.fx*speed,a.fy*speed,dt);a.walk+=dt*12;a.moving=true;}}
 return false;
}
function setJob(a,type,target){const old=a.job;if(old?.type===type&&(old.target===target.id||old.target===target||(typeof old.target==='object'&&old.target.scene===target.scene&&dist(old.target,target)<8)))return;a.job={type,target:target.id??target};a.nav=[];a.repath=0;a.action=0;}
function release(g,a){for(const i of g.items)if(i.claim===a.id)i.claim=null;}
function drop(g,a){if(a.bag){g.items.push({...a.bag,id:'drop'+g.nextEvent++,x:a.x,y:a.y,scene:a.scene,taken:false,destroyed:false,claim:null});a.bag=null;}release(g,a);}
function projectFull(p){return p.needs.every(k=>p.installed[k]);}
function cost(g,a,b){if(a.scene===b.scene)return dist(a,b);const p=a.scene<0?a:door(g.houses[a.scene]),q=b.scene<0?b:door(g.houses[b.scene]);return dist(p,q)+300;}
function chooseJob(g,a){
 const p=g.projects[a.team],radio=g.projects[2];
 if(radio.ready&&radio.rescue<=0){setJob(a,'rescue',{x:48,y:940,scene:-1});return;}
 const mate=a.role==='medic'&&a.medkits>0?g.actors.filter(n=>!isKiller(n)&&n!==a&&alive(n)&&(n.hp<2||n.stun>1.5)).sort((x,y)=>cost(g,a,x)-cost(g,a,y))[0]:null;
 if(mate&&cost(g,a,mate)<500){setJob(a,'heal',mate);return;}
 if(a.bag){setJob(a,'deliver',g.projects[a.bag.plan??a.team]);return;}
 if(p.ready&&!p.departed&&p.id<2){setJob(a,'board',p);return;}
 if(p.departed){a.team=2;a.job=null;return;}
 if(a.role==='guard'&&!a.weapon){const item=g.items.find(i=>i.kind==='weapon'&&!i.taken&&!i.destroyed&&(!i.claim||i.claim===a.id));if(item){item.claim=a.id;setJob(a,'collect',item);return;}}
 if(p.id===2&&!g.houses[2].power){setJob(a,'power',{...fuseBox(g.houses[2]),y:fuseBox(g.houses[2]).y+34});return;}
 const needed=g.items.filter(i=>i.plan===p.id&&!p.installed[i.kind]&&!i.taken&&!i.destroyed&&(!i.claim||i.claim===a.id));
 if(needed.length&&(a.role!=='guard'||!g.actors.some(n=>n.team===a.team&&n.role!=='guard'&&alive(n)))){const item=needed.sort((x,y)=>cost(g,a,x)-cost(g,a,y))[0];release(g,a);item.claim=a.id;setJob(a,'collect',item);return;}
 if(projectFull(p)){setJob(a,a.role==='guard'?'guard':'repair',a.role==='guard'?{x:p.x+65,y:p.y+35,scene:-1}:p);return;}
 setJob(a,'guard',{x:p.x+(a.role==='guard'?65:-50),y:p.y+35,scene:-1});
}
function jobTarget(g,a){const j=a.job;if(!j)return null;if(typeof j.target==='object')return j.target;if(['deliver','repair','board'].includes(j.type))return g.projects[j.target];if(j.type==='heal')return g.actors.find(n=>n.id===j.target);return g.items.find(i=>i.id===j.target);}
function botSurvivor(g,a,dt){
 const map=createWorld(g.seed),killer=g.actors[0],same=a.scene===killer.scene,d=same?dist(a,killer):Infinity;
 if(a.hidden){a.hideTime-=dt;if(a.hideTime>0&&same&&d<350)return;unhide(g,a);}
 a.decide-=dt;a.trapCD-=dt;a.shotCD=Math.max(0,a.shotCD-dt);
 const detected=same&&d<(a.scene<0||g.houses[a.scene].power?230:130)*(killer.crouch?.5:1)&&clearLine(map,a,killer);
 if(detected){a.aware=1;a.fear=2;}
 else a.fear=Math.max(0,a.fear-dt);
 if(a.windup>0){a.windup-=dt;if(a.windup<=0&&a.aim){effect(g,a,{...a.aim,scene:a.scene},a.weapon);sound(g,a,a.weapon==='rifle'?'shot':'hit',600);if(killer.scene===a.scene&&dist(killer,a.aim)<(a.weapon==='flare'?65:35)&&clearLine(map,a,killer)){damage(g,killer,a.weapon==='rifle'?16:8,a.weapon==='flare'?2:1.2,a);}a.ammo--;if(a.ammo<=0)a.weapon=null;a.shotCD=4;}return;}
 if(detected&&a.weapon&&a.ammo>0&&a.shotCD<=0&&d<(a.weapon==='rifle'?235:a.weapon==='flare'?180:62)){a.windup=a.weapon==='rifle'?.6:.35;a.aim={x:killer.x,y:killer.y};return;}
 if(detected&&d<155&&a.role!=='guard'){
  a.repair=null;release(g,a);
  if(a.scene>=0&&a.hp<2&&d>90&&!a.bag){const f=map.layouts[a.scene].filter(hideable).sort((x,y)=>dist(a,nearPoint(a,x))-dist(a,nearPoint(a,y)))[0];if(f&&dist(a,nearPoint(a,f))<35){a.hideReturn={x:a.x,y:a.y};a.hidden=true;a.hideSlot=f.slot;a.hideTime=15;g.houses[a.scene].checked[f.slot]=false;sound(g,a,'hide',100);return;}}
  if(a.scene>=0){approach(g,a,{...door(g.houses[a.scene]),y:door(g.houses[a.scene]).y+55},dt);}
  else{const angle=Math.atan2(a.y-killer.y,a.x-killer.x);for(const off of[0,.7,-.7,1.4,-1.4]){const x=a.x+Math.cos(angle+off)*20,y=a.y+Math.sin(angle+off)*20;if(!blocked(map,x,y,10,a.scene)){a.fx=Math.cos(angle+off);a.fy=Math.sin(angle+off);move(map,a,a.fx*117,a.fy*117,dt);a.moving=true;a.walk+=dt*14;break;}}}
  a.decide=.7;return;
 }
 if(a.boarded!==null&&a.boarded!==undefined){const p=g.projects[a.boarded];if(p.ready&&!p.departed)return;a.boarded=null;a.job=null;}
 if(a.decide<=0||!a.job){a.decide=1.3;chooseJob(g,a);}
 const target=jobTarget(g,a);if(!target)return;if(!approach(g,a,target,dt)){a.action=0;return;}a.action+=dt;
 const type=a.job.type;
 if(type==='collect'&&a.action>1.3){if(target.taken||target.destroyed){a.job=null;return;}target.taken=true;target.claim=null;if(target.kind==='weapon'){a.weapon='rifle';a.ammo=2;}else if(target.kind==='medkit')a.medkits+=2;else a.bag={kind:target.kind,plan:target.plan};event(g,a.name+' нашёл: '+ITEM_NAMES[target.kind]);sound(g,a,'work',180);a.job=null;}
 else if(type==='deliver'&&a.action>.8&&a.bag){target.installed[a.bag.kind]=true;event(g,a.name+' доставил '+ITEM_NAMES[a.bag.kind].toLowerCase()+'.');a.bag=null;a.job=null;}
 else if(type==='repair'){if(target.id===2&&!g.houses[2].power){a.job=null;return;}target.progress=clamp(target.progress+dt*(a.role==='mechanic'?.005:.002),0,1);if((a.workSound=(a.workSound||0)-dt)<=0){a.workSound=3;sound(g,a,'repair',400);}readyProject(g,target);}
 else if(type==='power'&&a.action>4){g.houses[2].power=true;event(g,'Питание радиорубки восстановлено.');a.job=null;}
 else if(type==='heal'&&a.action>2&&!target.dead){target.hp=2;target.stun=0;a.medkits--;a.job=null;event(g,a.name+' помог напарнику.');}
 else if(type==='board'&&a.action>1&&!target.passengers.includes(a.id)){target.passengers.push(a.id);a.boarded=target.id;}
 else if(type==='rescue'&&a.action>1)escape(g,a,'помощь');
 else if(type==='guard'&&a.role==='guard'&&a.tripwires>0&&a.trapCD<=0&&a.action>2){g.traps.push({id:'trap'+g.nextEvent++,x:a.x-15,y:a.y-15,scene:a.scene,owner:'survivor',spent:false});a.tripwires--;a.trapCD=35;}
}
function readyProject(g,p){if(p.progress>=1&&!p.ready){p.ready=true;p.board=0;p.rescue=p.id===2?40:0;event(g,p.id===2?'Вызвана помощь. До прибытия 40 секунд.':p.name+' готова к побегу.');sound(g,p,p.id===2?'radio':'engine',850);}}
function escape(g,a,how){if(!alive(a))return;a.escaped=true;a.repair=null;a.task=null;a.boarded=null;g.escaped++;drop(g,a);event(g,a.name+' покинул лагерь: '+how+'.');sound(g,a,'engine',900);}
function damage(g,a,amount,stun,source){if(a.immune>0||!alive(a))return;const killer=isKiller(a),factor=a.block>0?.25:a.fury>0?.5:1;a.hp=Math.max(0,a.hp-amount*factor);a.stun=a.fury>0?0:Math.max(a.stun,stun*(a.block>0?.2:1));a.immune=killer?1.1:.55;a.lastHit=g.t;a.task=null;a.repair=null;if(killer)a.rage=clamp(a.rage+18,0,100);sound(g,a,'hit',400);if(a.hp<=0){a.dead=true;drop(g,a);if(!killer){g.kills++;g.score+=100;for(const p of g.projects)p.passengers=p.passengers.filter(id=>id!==a.id);event(g,a.name+' пойман.');}else{g.ended=true;g.winner='survivors';event(g,'Выжившие дали Джейсону отпор.');}}else if(!killer){unhide(g,a);event(g,a.name+' ранен.');}}
function actorAttack(g,a){
 if(!alive(a)||a.hidden||a.stun>0||a.swing>0||a.shotCD>0)return;a.repair=null;a.task=null;const map=createWorld(g.seed);
 if(isKiller(a)){a.swing=.45;a.hit=false;const n=g.actors.filter(n=>!isKiller(n)&&alive(n)&&canSee(g,a,n)&&dist(a,n)<80).sort((x,y)=>dist(a,x)-dist(a,y))[0];a.ambush=n&&a.crouch&&n.aware<1?n.id:null;if(n){const d=dist(a,n)||1;a.fx=(n.x-a.x)/d;a.fy=(n.y-a.y)/d;}sound(g,a,'swing',180);}
 else if(a.weapon&&a.ammo>0){const n=g.actors[0],range=a.weapon==='rifle'?245:a.weapon==='flare'?185:65;if(n.scene!==a.scene||dist(a,n)>range||!canSee(g,a,n)){ownMessage(g,a,'Для удара нужна видимая цель.');return;}a.ammo--;a.shotCD=a.weapon==='rifle'?3.5:2;a.swing=.35;effect(g,a,n,a.weapon);damage(g,n,a.weapon==='rifle'?18:8,a.weapon==='flare'?2.5:1.3,a);sound(g,a,a.weapon==='rifle'?'shot':a.weapon==='bat'?'bat':'flare',650);if(a.ammo<=0)a.weapon=null;}
 else ownMessage(g,a,'Нужно найти оружие.');
}
function contextPoint(g,a,c){
 const map=createWorld(g.seed),h=g.houses[c.id];
 if(['search','hide'].includes(c.type)){const f=map.layouts[a.scene]?.find(f=>f.slot===c.id);if(f)return nearPoint(a,f);}
 if(['enter','breach'].includes(c.type))return door(h);
 if(c.type==='exit')return{x:380,y:505,scene:a.scene};
 if(['openWindow','vaultIn','vaultOut'].includes(c.type)){const w=windows(h).find(w=>w.id===c.window);return a.scene<0?windowPoint(h,w.id):{...windowInside(w),scene:a.scene};}
 if(['powerOn','powerOff'].includes(c.type))return fuseBox(h);
 if(c.type==='loot')return g.items.find(i=>i.id===c.id);
 if(c.type==='disarm')return g.traps.find(i=>i.id===c.id);
 if(c.type==='heal')return g.actors.find(i=>i.id===c.id);
 if(['install','board','sabotage','repair','missing','rescueInfo'].includes(c.type))return g.projects[c.id];
 return a;
}
export function getContext(g,a,hints=false){
 const map=createWorld(g.seed),killer=isKiller(a);if(a.hidden)return hints?[]:{type:'unhide',label:'Выйти из укрытия · E',x:a.x,y:a.y};let best=57,result=null,candidates=[];const offer=(d,c)=>{const p=contextPoint(g,a,c);if(!p||!clearLine(map,a,p,a.scene))return;if(hints&&d<120&&illuminated(g,a,{...p,scene:a.scene}))candidates.push({...c,x:p.x,y:p.y,distance:d});if(d<best){best=d;result={...c,x:p.x,y:p.y};}};
 for(const t of g.traps)if(!t.spent&&t.scene===a.scene&&t.owner===(killer?'survivor':'jason'))offer(dist(a,t),{type:'disarm',id:t.id,label:'Обезвредить ловушку · E',duration:.8});
 for(const i of g.items)if(i.scene===a.scene&&!i.taken&&!i.destroyed)offer(dist(a,i),{type:'loot',id:i.id,label:(killer?'Уничтожить: ':a.bag&&!['weapon','medkit'].includes(i.kind)?'Руки заняты: ': 'Взять: ')+ITEM_NAMES[i.kind]+' · E',duration:.7});
 if(!killer)for(const n of g.actors)if(n!==a&&!isKiller(n)&&alive(n)&&n.scene===a.scene&&(n.stun>1||n.hp<2)&&a.medkits>0)offer(dist(a,n),{type:'heal',id:n.id,label:'Помочь: '+n.name+' · E',duration:2.2});
 if(a.scene<0){for(const h of g.houses){offer(dist(a,door(h)),{type:killer&&(h.locked||h.barricade)?'breach':'enter',id:h.id,label:(killer&&(h.locked||h.barricade)?'Взломать дверь':'Войти: '+h.name)+' · E',duration:h.barricade?3:1.5});for(const w of windows(h))if(w.state!=='barred')offer(dist(a,windowPoint(h,w.id)),windowContext(h,w,true,killer));if(killer&&h.power)offer(dist(a,fuseBox(h)),{type:'powerOff',id:h.id,label:'Выключить щиток · E',duration:.9});if(!killer&&!h.power)offer(dist(a,fuseBox(h)),{type:'powerOn',id:h.id,label:'Починить щиток · E',duration:a.role==='mechanic'?3:5});}
 for(const p of g.projects)if(!p.departed){const missing=p.needs.filter(k=>!p.installed[k]);const type=killer?'sabotage':a.bag&&missing.includes(a.bag.kind)?'install':p.ready?(p.id<2?'board':'rescueInfo'):projectFull(p)?'repair':'missing';const label={sabotage:'Повредить: '+p.name,install:'Установить '+ITEM_NAMES[a.bag?.kind],board:'Ждать напарников',rescueInfo:'Помощь: '+Math.ceil(p.rescue)+' с',repair:'Ремонт: '+p.name,missing:'Нужны: '+missing.map(k=>ITEM_NAMES[k]).join(', ')}[type];offer(dist(a,p),{type,id:p.id,label:label+' · E',duration:type==='sabotage'?1.6:.8});}}
 else{offer(dist(a,{x:380,y:505}),{type:'exit',id:a.scene,label:'Выйти · E'});for(const w of windows(g.houses[a.scene]))if(w.state!=='barred')offer(dist(a,windowInside(w)),windowContext(g.houses[a.scene],w,false,killer));for(const f of map.layouts[a.scene])if(killer&&f.slot!==undefined&&!g.houses[a.scene].checked[f.slot])offer(dist(a,nearPoint(a,f)),{type:'search',id:f.slot,label:'Осмотреть: '+f.name+' · E',duration:1.2});else if(!killer&&hideable(f))offer(dist(a,nearPoint(a,f)),{type:'hide',id:f.slot,label:(f.kind==='bed'?'Спрятаться под кроватью':'Спрятаться в шкафу')+' · E',duration:.65});}
 return hints?candidates.sort((a,b)=>a.distance-b.distance).slice(0,6):result;
}
function windowContext(h,w,inside,killer){return{type:w.state==='closed'?'openWindow':inside?'vaultIn':'vaultOut',id:h.id,window:w.id,label:(w.state==='closed'?(killer?'Выбить закрытое окно':'Открыть закрытое окно'):inside?'Залезть в окно':'Вылезти в окно')+' · E',duration:w.state==='closed'?(killer?1.4:.8):.8};}
function enter(g,a,s,p,noiseType='door'){sound(g,a,noiseType,220);a.moveEpoch=(a.moveEpoch||0)+1;a.hidden=false;a.input={dx:0,dy:0,run:false};a.scene=s;a.x=p.x;a.y=p.y;a.nav=[];a.goal=null;a.task=null;a.repair=null;sound(g,a,noiseType,220);}
function interact(g,a){if(a.stun>0||!alive(a))return;if(a.repair){a.repair=null;return;}const c=getContext(g,a);if(!c)return;
 if(c.type==='unhide'){unhide(g,a);return;}
 if(c.type==='enter'){enter(g,a,c.id,{x:380,y:485});return;}if(c.type==='exit'){const p=door(g.houses[a.scene]);enter(g,a,-1,{x:p.x,y:p.y+18});return;}
 if(c.type==='missing'||c.type==='rescueInfo'){ownMessage(g,a,c.label.replace(' · E',''));return;}
 if(c.type==='repair'){a.repair={project:c.id,level:0,next:g.t+2.8,check:null};a.nav=[];a.goal=null;ownMessage(g,a,'Ремонт идёт. На проверке нажми Пробел в светлой зоне.');return;}
 a.task={...c,time:0};a.nav=[];a.goal=null;if(c.type==='search')sound(g,a,'search',170);else if(c.type==='loot')sound(g,a,'search',100);
}
function completeTask(g,a){const t=a.task;a.task=null;if(!t)return;
 if(t.type==='breach'){const h=g.houses[t.id];h.locked=false;h.barricade=0;sound(g,a,'break',650);enter(g,a,h.id,{x:380,y:485});}
 else if(t.type==='openWindow'){const w=windows(g.houses[t.id]).find(w=>w.id===t.window);if(w&&w.state==='closed'){w.state=isKiller(a)?'broken':'open';sound(g,a,isKiller(a)?'glass':'window',isKiller(a)?550:160);ownMessage(g,a,'Окно открыто. E — перелезть.');}}
 else if(t.type==='vaultIn'||t.type==='vaultOut'){const h=g.houses[t.id],w=windows(h).find(w=>w.id===t.window);if(!w||!['open','broken'].includes(w.state))return;const p=t.type==='vaultIn'?windowInside(w):windowPoint(h,w.id);enter(g,a,t.type==='vaultIn'?t.id:-1,{x:p.x,y:p.y+(t.type==='vaultIn'?10:18)},'vault');}
 else if(t.type==='hide'){const f=createWorld(g.seed).layouts[a.scene]?.find(f=>f.slot===t.id);if(!f||!hideable(f))return;if(g.actors.some(n=>n!==a&&n.hidden&&n.scene===a.scene&&n.hideSlot===t.id)){ownMessage(g,a,'Укрытие занято.');return;}a.hideReturn={x:a.x,y:a.y};a.hidden=true;a.hideSlot=t.id;a.moveEpoch=(a.moveEpoch||0)+1;a.x=f.x+f.w/2;a.y=f.y+f.h/2;a.input={dx:0,dy:0,run:false};a.nav=[];g.houses[a.scene].checked[t.id]=false;sound(g,a,'hide',100);ownMessage(g,a,'Ты в укрытии. Фонарик погашен. E — выйти.');}

 else if(t.type==='powerOff'||t.type==='powerOn'){g.houses[t.id].power=t.type==='powerOn';sound(g,a,'power',250);ownMessage(g,a,t.type==='powerOn'?'Питание восстановлено.':'Свет выключен.');}
 else if(t.type==='disarm'){const v=g.traps.find(v=>v.id===t.id);if(v)v.spent=true;sound(g,a,'trap',120);ownMessage(g,a,'Ловушка обезврежена.');}
 else if(t.type==='heal'){const n=g.actors.find(n=>n.id===t.id);if(n&&alive(n)&&n.scene===a.scene&&dist(a,n)<65&&a.medkits>0){n.hp=2;n.stun=0;a.medkits--;sound(g,a,'heal',100);event(g,a.name+' помог '+n.name+'.');}}
 else if(t.type==='loot'){sound(g,a,'pickup',90);const i=g.items.find(i=>i.id===t.id);if(!i||i.taken||i.destroyed||i.scene!==a.scene||dist(a,i)>70)return;
  if(isKiller(a)){i.destroyed=true;i.claim=null;ownMessage(g,a,'Припасы уничтожены.');sound(g,a,'break',280);}
  else if(i.kind==='weapon'){i.taken=true;a.weapon=a.role==='guard'?'rifle':'bat';a.ammo=a.role==='guard'?2:3;ownMessage(g,a,'Оружие взято. Пробел — использовать.');}
  else if(i.kind==='medkit'){i.taken=true;a.medkits+=2;ownMessage(g,a,'Получены две перевязки.');}
  else if(!a.bag){i.taken=true;i.claim=null;a.bag={kind:i.kind,plan:i.plan};ownMessage(g,a,'Взято: '+ITEM_NAMES[i.kind]+'.');event(g,a.name+' нашёл '+ITEM_NAMES[i.kind].toLowerCase()+'.');}
 }
 else if(t.type==='install'){const p=g.projects[t.id];if(a.bag&&p.needs.includes(a.bag.kind)&&!p.installed[a.bag.kind]){p.installed[a.bag.kind]=true;a.bag=null;sound(g,a,'install',200);event(g,'Установлена деталь: '+p.name+'.');ownMessage(g,a,'Деталь установлена.');}}
 else if(t.type==='board'){const p=g.projects[t.id];if(p.ready&&!p.departed&&!p.passengers.includes(a.id)){p.passengers.push(a.id);a.boarded=p.id;ownMessage(g,a,'Ждём напарников. E — выйти.');}}
 else if(t.type==='sabotage'){const p=g.projects[t.id];p.progress=Math.max(0,p.progress-.5);p.ready=false;p.rescue=0;p.board=0;for(const id of p.passengers){const n=g.actors.find(n=>n.id===id);if(n)n.boarded=null;}p.passengers=[];const k=p.needs.find(k=>p.installed[k]);if(k){delete p.installed[k];g.items.push({id:'sabotage'+g.nextEvent++,kind:k,plan:p.id,x:p.x+45,y:p.y+15,scene:-1,taken:false,destroyed:false,claim:null});}sound(g,a,'break',650);ownMessage(g,a,'Механизм повреждён.');event(g,p.name+': ремонт повреждён.');}
 else if(t.type==='search'){g.houses[a.scene].checked[t.id]=true;const n=g.actors.find(n=>n.hidden&&n.scene===a.scene&&n.hideSlot===t.id&&alive(n));if(n){unhide(g,n);n.aware=1;n.stun=.7;ownMessage(g,n,'Тебя обнаружили!');sound(g,n,'shout',450);ownMessage(g,a,'Кто-то прятался здесь.');}else ownMessage(g,a,'Пусто. Ищи шум и следы.');}
 else if(t.type==='barricade'){const h=g.houses[a.scene];if(h){h.barricade=2;h.locked=true;ownMessage(g,a,'Дверь забаррикадирована. Через окна всё ещё можно пройти.');sound(g,a,'work',300);}}
}
function failCheck(g,a){const r=a.repair;if(!r)return;const p=g.projects[r.project];p.progress=Math.max(0,p.progress-.055);sound(g,a,'repairFail',750);ownMessage(g,a,'Промах! Шум мог выдать тебя.');r.check=null;r.next=g.t+3.8;}
function checkTiming(g,a,action){const r=a.repair,c=r?.check;if(!c||action.id!==c.id)return;const at=Number(action.time);if(!Number.isFinite(at)||at<g.t-1.4||at>g.t+.12||at<c.start||at>c.start+c.duration)return;const pos=(at-c.start)/c.duration;
 if(pos>=c.target-c.width/2&&pos<=c.target+c.width/2){const perfect=Math.abs(pos-c.target)<c.width*.18;g.projects[r.project].progress=clamp(g.projects[r.project].progress+(perfect?.055:.026),0,1);r.level++;sound(g,a,'success',65);ownMessage(g,a,perfect?'Отличная проверка!':'Успешная проверка.');r.check=null;r.next=g.t+3.5+random(g)*1.8;readyProject(g,g.projects[r.project]);}
 else failCheck(g,a);
}
export function applyActions(g,a,actions){for(const action of actions.slice(0,8)){if(!alive(a)||a.stun>0)break;const type=typeof action==='string'?action:action?.type;
 if(a.hidden&&type!=='interact')continue;
 if(type==='interact'){if(a.boarded!==undefined&&a.boarded!==null){g.projects[a.boarded].passengers=g.projects[a.boarded].passengers.filter(id=>id!==a.id);a.boarded=null;}else interact(g,a);}
 else if(type==='attack')actorAttack(g,a);
 else if(type==='check')checkTiming(g,a,action);
 else if(type==='flashlight'&&!isKiller(a)){a.flashlight=a.flashlight===false;}
 else if(type==='drop')drop(g,a);
 else if(type==='crouch'){a.crouch=!a.crouch;a.input.run=false;}
 else if(type==='sense'&&(a.cooldowns.sense||0)<=0){a.sense=5;a.cooldowns.sense=isKiller(a)?60:18;if(a.role==='mechanic')a.focus=3;else if(a.role==='medic'&&a.medkits>0&&a.hp<2){a.task={type:'selfHeal',duration:3,time:0};}ownMessage(g,a,a.role==='mechanic'?'Фокус: три проверки будут чуть проще.':a.role==='medic'?'Помогай раненым через E.':'Прислушайся к звукам лагеря.');}
 else if(type==='trap'&&isKiller(a)&&a.trapStock>0&&!g.traps.some(t=>!t.spent&&t.scene===a.scene&&dist(t,a)<30)){g.traps.push({id:'trap'+g.nextEvent++,x:a.x,y:a.y+3,scene:a.scene,owner:'jason',spent:false});a.trapStock--;sound(g,a,'trap',150);}
 else if(type==='knife'&&isKiller(a)&&a.knives>0){const n=g.actors.filter(n=>!isKiller(n)&&alive(n)&&canSee(g,a,n)).sort((x,y)=>dist(a,x)-dist(a,y))[0];if(n&&dist(a,n)<300){a.knives--;sound(g,a,'knife',180);effect(g,a,n,'knife');damage(g,n,1,2.2,a);}}
 else if(type==='dash'&&isKiller(a)&&(a.cooldowns.dash||0)<=0&&a.stamina>.25){a.dash=.18;a.cooldowns.dash=6;a.stamina-=.25;a.immune=Math.max(a.immune,.25);}
 else if(type==='block'){if(isKiller(a)&&(a.cooldowns.block||0)<=0){a.block=.9;a.cooldowns.block=2.5;}else if(!isKiller(a)&&a.scene>=0&&dist(a,{x:380,y:500})<120){a.task={type:'barricade',time:0,duration:2};}}
 else if(type==='fury'&&isKiller(a)&&a.rage>=100){a.rage=0;a.fury=8;a.stun=0;a.hp=Math.min(100,a.hp+12);}
 else if(type==='go'&&a.motionVersion!==2&&Number.isFinite(action.x)&&Number.isFinite(action.y)){const size=a.scene<0?WORLD:ROOM,p={x:clamp(action.x,30,size.w-30),y:clamp(action.y,30,size.h-30)};a.goal=p;a.nav=route(createWorld(g.seed),p,a);a.task=null;a.repair=null;}
}}
function humanTick(g,a,dt){
 if(a.boarded!==null&&a.boarded!==undefined)return;const map=createWorld(g.seed);let dx=a.input.dx||0,dy=a.input.dy||0;if(g.t-a.inputAt>.8){dx=0;dy=0;}
 if(a.motionVersion!==2&&(dx||dy)){a.goal=null;a.nav=[];a.task=null;a.repair=null;}
 if(!dx&&!dy&&a.nav.length){const p=a.nav[0],d=dist(a,p);if(d<7)a.nav.shift();else{dx=(p.x-a.x)/d;dy=(p.y-a.y)/d;}}
 if(a.motionVersion!==2)motionStep(map,a,{dt,dx,dy,run:a.input.run,lx:dx||a.lx,ly:dy||a.ly,keepNav:true});
 if(a.hidden)return;
 if(a.dash>0)move(map,a,a.fx*340,a.fy*340,dt);
 if(a.task){a.task.time+=dt;if(a.task.time>=a.task.duration){if(a.task.type==='selfHeal'){a.hp=2;a.medkits--;a.task=null;}else completeTask(g,a);}}
 if(a.repair){const r=a.repair,p=g.projects[r.project];if(!projectFull(p)||p.ready||p.departed||dist(a,p)>65||(p.id===2&&!g.houses[2].power)){a.repair=null;return;}p.progress=clamp(p.progress+dt*(a.role==='mechanic'?.008:.005),0,1);if(r.check&&g.t>r.check.start+r.check.duration+1.1)failCheck(g,a);if(!r.check&&g.t>=r.next){const level=Math.min(10,r.level);r.check={id:'check'+g.nextEvent++,start:g.t+.6,duration:2.6-level*.105,target:.42+random(g)*.43,width:(.23-level*.011)*(a.focus>0?1.25:1)};if(a.focus>0)a.focus--;sound(g,a,'check',65);}if((a.workSound=(a.workSound||0)-dt)<=0){a.workSound=3;sound(g,a,'repair',350);}readyProject(g,p);}
}
function botKiller(g,a,dt){const map=createWorld(g.seed),targets=g.actors.filter(n=>!isKiller(n)&&alive(n)&&canSee(g,a,n)).sort((x,y)=>dist(a,x)-dist(a,y));const target=targets[0];if(target){const d=dist(a,target);if(d<53){actorAttack(g,a);return;}a.fx=(target.x-a.x)/(d||1);a.fy=(target.y-a.y)/(d||1);if(!blocked(map,a.x+a.fx*22,a.y+a.fy*22,10,a.scene)){move(map,a,a.fx*108,a.fy*108,dt);a.moving=true;a.walk+=dt*10;}else approach(g,a,target,dt);return;}
 if(a.scene>=0){a.patrolTime=(a.patrolTime||0)+dt;if(a.patrolTime>9){const p=door(g.houses[a.scene]);approach(g,a,{...p,y:p.y+20},dt);if(a.scene<0){a.patrol=(a.patrol+1)%9;a.patrolTime=0;}}else approach(g,a,{x:((a.patrol%2)?620:120),y:200,scene:a.scene},dt);}
 else{const h=g.houses[a.patrol],p=door(h);if(dist(a,p)<35){enter(g,a,h.id,{x:380,y:485});a.patrolTime=0;}else approach(g,a,p,dt);}}
export function simulate(room,now=Date.now()){
 if(room.phase!=='playing'||!room.game)return;const g=room.game;const effectiveNow=Math.max(now,room.tickAt||now);let delta=clamp((effectiveNow-(room.tickAt||effectiveNow))/1000,0,.75);room.tickAt=effectiveNow;
 while(delta>.00001&&!g.ended){const dt=Math.min(.05,delta);delta-=dt;g.t+=dt;
 for(const a of g.actors){if(!alive(a))continue;a.moving=false;for(const key of['stun','immune','block','swing','sense','dash','fury','shotCD'])a[key]=Math.max(0,(a[key]||0)-dt);for(const key of Object.keys(a.cooldowns))a.cooldowns[key]=Math.max(0,a.cooldowns[key]-dt);
 if(a.swing>0&&!a.hit&&a.swing<.28&&isKiller(a)){a.hit=true;const n=g.actors.filter(n=>!isKiller(n)&&alive(n)&&!n.hidden&&n.scene===a.scene&&dist(a,n)<69&&clearLine(createWorld(g.seed),a,n)).sort((x,y)=>dist(a,x)-dist(a,y))[0];if(n)damage(g,n,a.fury>0||n.id===a.ambush?2:1,.7,a);}
 if(isKiller(a)&&g.t-a.lastHit>10)a.hp=Math.min(100,a.hp+dt*.5);
 const trap=g.traps.find(t=>!t.spent&&t.scene===a.scene&&t.owner===(isKiller(a)?'survivor':'jason')&&dist(a,t)<22);if(trap){trap.spent=true;if(isKiller(a))damage(g,a,10,2.2,null);else{a.stun=4;unhide(g,a);sound(g,a,'shout',450);}}
 if(a.stun>0){a.task=null;a.repair=null;continue;}
 if(activeHuman(room,a,now))humanTick(g,a,dt);else if(isKiller(a))botKiller(g,a,dt);else botSurvivor(g,a,dt);
 if(a.moving&&(a.stepAt||0)<g.t){a.stepAt=g.t+(isKiller(a)?.55:.42);sound(g,a,'step',isKiller(a)?210:130);}
 }
 for(const p of g.projects){if(p.id===2&&p.ready&&p.rescue>0){p.rescue=Math.max(0,p.rescue-dt);if(p.rescue===0){event(g,'Помощь прибыла к западному въезду.');for(const a of g.actors)a.decide=0;}}if(p.id<2&&p.ready&&!p.departed&&p.passengers.length){p.board+=dt;const ids=p.passengers.filter(id=>g.actors.some(n=>n.id===id&&alive(n)));const living=g.actors.filter(n=>n.team===p.id&&alive(n)).length;if(ids.length>=Math.max(1,Math.min(4,living))||p.board>18){p.departed=true;for(const id of ids)escape(g,g.actors.find(n=>n.id===id),p.name);}}}
 for(const a of g.actors)if(!isKiller(a)&&alive(a)&&g.projects[2].ready&&g.projects[2].rescue<=0&&a.scene<0&&dist(a,{x:48,y:940})<45)escape(g,a,'помощь');
 g.sounds=g.sounds.filter(s=>g.t-s.t<4);g.effects=g.effects.filter(s=>g.t-s.t<.5);
 if(g.kills+g.escaped>=g.total||g.t>=600){if(g.t>=600)for(const a of g.actors)if(!isKiller(a)&&alive(a)){a.escaped=true;g.escaped++;}g.ended=true;g.winner=g.kills===g.total?'jason':'survivors';}
 }
 if(g.ended)room.phase='ended';
}
function publicActor(a,self=false){const data={id:a.id,name:a.name,role:a.role,scene:a.scene,x:a.x,y:a.y,fx:a.fx,fy:a.fy,walk:a.walk,moving:a.moving,dead:a.dead,escaped:a.escaped,hp:a.hp,maxHp:a.maxHp,stun:a.stun,swing:a.swing,crouch:a.crouch,weapon:a.weapon,windup:a.windup,aim:a.aim,lx:a.lx??a.fx,ly:a.ly??a.fy};if(self)Object.assign(data,{actionAck:a.actionAck||0,hidden:a.hidden,flashlight:a.flashlight!==false,moveAck:a.moveAck||0,moveEpoch:a.moveEpoch||0,recoverDelay:a.recoverDelay||0,boarded:a.boarded??null,lx:a.lx??a.fx,ly:a.ly??a.fy,stamina:a.stamina,exhausted:a.exhausted,bag:a.bag,ammo:a.ammo,medkits:a.medkits,knives:a.knives,trapStock:a.trapStock,rage:a.rage,fury:a.fury,dash:a.dash,block:a.block,cooldowns:a.cooldowns,sense:a.sense,repair:a.repair,task:a.task?{type:a.task.type,label:a.task.label,time:a.task.time,duration:a.task.duration}:null,message:a.message,input:a.input});return data;}
function proximity(g,a,b){if(a.scene===b.scene)return dist(a,b);const x=a.scene<0?a:door(g.houses[a.scene]),y=b.scene<0?b:door(g.houses[b.scene]);return dist(x,y)+120;}
export function gameView(room,member){const g=room.game;if(!g)return null;const a=g.actors.find(a=>a.id===member.actorId);if(!a)return null;const killer=isKiller(a),map=createWorld(g.seed),actors=g.actors.filter(b=>b===a||alive(b)&&canSee(g,a,b)).map(b=>publicActor(b,b===a));
 const sounds=g.sounds.filter(s=>s.scene===a.scene&&dist(a,s)<s.radius+(a.sense>0?300:0)&&(!killer||s.type!=='check')).map(s=>({id:s.id,x:killer?Math.round(s.x/75)*75:s.x,y:killer?Math.round(s.y/75)*75:s.y,scene:s.scene,type:s.type,t:s.t,self:s.actor===a.id}));
 const projects=g.projects.map(p=>killer?{id:p.id,name:p.name,x:p.x,y:p.y,scene:-1,ready:a.scene===-1&&dist(a,p)<vision(g,a)?p.ready:false,departed:a.scene===-1&&dist(a,p)<vision(g,a)?p.departed:false}:{...p});
 const houses=g.houses.filter(h=>a.scene===h.id||a.scene<0&&dist(a,door(h))<vision(g,a)+100).map(h=>({id:h.id,power:h.power,locked:h.locked,barricade:h.barricade,windows:windows(h),checked:a.scene===h.id?h.checked:undefined}));
 return{seed:g.seed,time:g.t,total:g.total,kills:g.kills,escaped:g.escaped,ended:g.ended,winner:g.winner,me:publicActor(a,true),actors,houses,projects,items:g.items.filter(i=>!i.taken&&!i.destroyed&&illuminated(g,a,i)).map(({id,kind,x,y,scene})=>({id,kind,x,y,scene})),traps:g.traps.filter(t=>!t.spent&&illuminated(g,a,t)).map(t=>({...t})),sounds,effects:g.effects.filter(e=>e.scene===a.scene&&dist(a,e)<vision(g,a)),events:killer?[]:g.events.slice(-8),context:alive(a)?getContext(g,a):null,interactions:alive(a)?getContext(g,a,true):[],threat:killer?0:clamp(1-proximity(g,a,g.actors[0])/550,0,1),team:killer?[]:g.actors.filter(n=>!isKiller(n)).map(n=>({id:n.id,name:n.name,role:n.role,dead:n.dead,escaped:n.escaped,hp:n.hp,human:!!n.human})),network:{revision:room.rev??0}};
}
