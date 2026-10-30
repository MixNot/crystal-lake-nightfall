import{CLASSES,clamp,createWorld,motionStep}from'./world.mjs';
import{createGame,simulate,gameView,applyActions,spectatorTargets,spectatorTarget}from'./simulation.mjs';
import{defaultSkin,validSkin}from'./appearance.mjs';
export class GameError extends Error{constructor(message,status=400){super(message);this.status=status;}}
function id(bytes=16){const array=new Uint8Array(bytes);crypto.getRandomValues(array);return Array.from(array,b=>b.toString(16).padStart(2,'0')).join('');}
const clean=(s,fallback,max=24)=>String(s||fallback).replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max)||fallback;
export function roster(room){return room.players.map(p=>({id:p.id,name:p.name,role:p.role,skin:p.skin||defaultSkin(p.role),ready:p.ready,host:p.id===room.host,connected:Date.now()-p.last<12000}));}
function lobby(room){return{code:room.code,title:room.title,phase:room.phase,players:roster(room),capacity:5,botCount:room.botCount??8,host:room.host,rev:room.rev};}
export function response(room,p,token){return{room:lobby(room),playerId:p.id,role:p.role,token,serverNow:Date.now(),game:gameView(room,p)};}
function rowMembers(room){return JSON.stringify(roster(room));}
export async function listRooms(db){const cutoff=Date.now()-1800000;const rows=await db.prepare('SELECT code,title,phase,members,updated_at FROM nightfall_rooms WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT 20').bind(cutoff).all();return{rooms:rows.results.map(r=>({code:r.code,title:r.title,phase:r.phase,players:JSON.parse(r.members),capacity:5}))};}
export async function createRoom(db,body){
 await db.prepare('DELETE FROM nightfall_rooms WHERE updated_at < ?').bind(Date.now()-1800000).run();
 const count=await db.prepare('SELECT COUNT(*) AS count FROM nightfall_rooms').first();if(Number(count?.count)>40)throw new GameError('Лобби заполнено. Попробуйте присоединиться к существующей комнате.',429);
 const now=Date.now(),token=id(24),p={id:id(8),token,name:clean(body.name,'Игрок',20),role:CLASSES.includes(body.role)?body.role:'jason',ready:false,last:now,lastSeq:0,actorId:null};
 let code='';for(let attempt=0;attempt<6;attempt++){code=id(4).slice(0,6).toUpperCase();const exists=await db.prepare('SELECT code FROM nightfall_rooms WHERE code=?').bind(code).first();if(!exists)break;}
 p.skin=defaultSkin(p.role);
 const room={botCount:8,code,title:clean(body.title,'Ночь '+code,32),phase:'lobby',host:p.id,players:[p],game:null,tickAt:now,rev:0};
 await db.prepare('INSERT INTO nightfall_rooms(code,title,phase,members,state,rev,updated_at) VALUES(?,?,?,?,?,0,?)').bind(code,room.title,room.phase,rowMembers(room),JSON.stringify(room),now).run();return response(room,p,token);
}
export async function mutateRoom(db,code,body,token){
 if(!/^[A-F0-9]{6}$/.test(code))throw new GameError('Неверный код комнаты.',404);const now=Date.now();const command=clean(body.op,'poll',20);
 for(let retry=0;retry<7;retry++){
  const row=await db.prepare('SELECT state,rev FROM nightfall_rooms WHERE code=?').bind(code).first();if(!row)throw new GameError('Комната не найдена или уже закрылась.',404);const room=JSON.parse(row.state);room.rev=Number(row.rev);
  let p=room.players.find(p=>p.token===token),issued;
  if(p){if(room.game&&now-p.last>12000){const a=room.game.actors.find(a=>a.human===p.id);if(a)a.moveEpoch=(a.moveEpoch||0)+1;}p.last=now;}
  simulate(room,now);
  if(command==='join'&&!p){
   if(room.phase!=='lobby')throw new GameError('Матч уже идёт. Дождитесь следующей ночи.',409);if(room.players.length>=5)throw new GameError('В комнате уже пять игроков.',409);
   const role=CLASSES.find(role=>!room.players.some(p=>p.role===role));if(!role)throw new GameError('Все роли заняты.',409);
   issued=id(24);p={id:id(8),token:issued,name:clean(body.name,'Игрок',20),role,skin:defaultSkin(role),ready:false,last:now,lastSeq:0,actorId:null};room.players.push(p);
  }
  if(!p)throw new GameError('Подключение устарело. Войдите в комнату заново.',401);p.last=now;
  if(command==='role'){
   if(room.phase!=='lobby')throw new GameError('Роль можно менять только в лобби.',409);
   if(!CLASSES.includes(body.role))throw new GameError('Неизвестная роль.');if(room.players.some(a=>a.id!==p.id&&a.role===body.role))throw new GameError('Эту роль уже занял другой игрок.',409);p.role=body.role;p.skin=defaultSkin(p.role);p.ready=false;
  }else if(command==='skin'){
   if(room.phase!=='lobby')throw new GameError('Внешность можно менять только в лобби.',409);if(!validSkin(p.role,body.skin))throw new GameError('Этот облик недоступен для выбранной роли.');p.skin=body.skin;p.ready=false;
  }else if(command==='settings'){
   if(p.id!==room.host)throw new GameError('Настройки меняет создатель комнаты.',403);if(room.phase!=='lobby')throw new GameError('Настройки доступны до начала матча.',409);const count=Number(body.botCount);if(!Number.isInteger(count)||count<0||count>12)throw new GameError('Выбери от 0 до 12 ботов.');room.botCount=count;room.players.forEach(n=>n.ready=false);
  }else if(command==='ready'){if(room.phase!=='lobby')throw new GameError('Матч уже идёт.',409);p.ready=Boolean(body.ready);}
  else if(command==='start'){
   if(p.id!==room.host)throw new GameError('Матч запускает создатель комнаты.',403);if(room.phase!=='lobby')throw new GameError('Матч уже запущен.',409);if(!room.players.every(p=>p.ready))throw new GameError('Дождитесь готовности всех игроков.',409);
   if((room.botCount??8)===0&&(!room.players.some(n=>n.role==='jason')||!room.players.some(n=>n.role!=='jason')))throw new GameError('Без ботов нужны игрок-Джейсон и хотя бы один выживший.',409);
   room.game=createGame(room.players,(crypto.getRandomValues(new Uint32Array(1))[0]),{botCount:room.botCount??8});room.phase='playing';room.tickAt=now;
  }else if(command==='reset'){
   if(p.id!==room.host)throw new GameError('Только создатель может начать новую ночь.',403);if(room.phase==='playing')throw new GameError('Сначала закончите текущий матч.',409);room.phase='lobby';room.game=null;room.players.forEach(a=>{a.ready=false;a.actorId=null;a.watching=false;a.spectateActorId=null;});
  }else if(command==='spectate'){
   const owner=room.game?.actors.find(a=>a.id===p.actorId);if(!owner||owner.role==='jason'||!owner.dead&&!owner.escaped||room.phase!=='playing')throw new GameError('Наблюдение доступно выбывшим выжившим.',403);
   const candidates=spectatorTargets(room.game,owner);if(body.watch===false){p.watching=false;p.spectateActorId=null;}
   else{if(!candidates.length)throw new GameError('Нет выживших для наблюдения.',409);const current=spectatorTarget(room,p)||candidates[0];let target;if(body.targetId){target=candidates.find(a=>a.id===body.targetId);if(!target)throw new GameError('Этот выживший уже выбыл.',409);}else{const direction=Number(body.direction)||0,index=candidates.findIndex(a=>a.id===current.id);target=candidates[(index+(direction<0?-1:direction>0?1:0)+candidates.length)%candidates.length];}p.watching=true;p.spectateActorId=target.id;}
  }else if(command==='leave'){
   room.players=room.players.filter(a=>a.id!==p.id);if(room.game){const a=room.game.actors.find(a=>a.human===p.id);if(a){a.human=null;if(room.game.botsEnabled===false){a.inactive=true;if(a.role==='jason'){room.game.ended=true;room.game.winner='survivors';room.phase='ended';}else if(!a.dead&&!a.escaped){a.dead=true;a.hp=0;a.deathAt=room.game.t;room.game.kills++;}}a.input={dx:0,dy:0,run:false};a.job=null;}}
   if(room.host===p.id)room.host=room.players[0]?.id;
  }else if(command==='input'&&room.game&&room.phase==='playing'){
   const seq=Math.floor(Number(body.seq));if(Number.isFinite(seq)&&seq>p.lastSeq){p.lastSeq=seq;const a=room.game.actors.find(a=>a.id===p.actorId);if(a&&!a.dead&&!a.escaped){const dx=Number(body.dx)||0,dy=Number(body.dy)||0,length=Math.hypot(dx,dy),scale=length>1?1/length:1;if(body.protocol===2){
     if(a.motionVersion!==2){a.motionVersion=2;a.moveAt=now;a.moveCredit=.5;a.nav=[];a.goal=null;}
     a.moveCredit=Math.min(1.5,(a.moveCredit||0)+Math.max(0,now-(a.moveAt||now))/1000);a.moveAt=now;
     for(const c of(Array.isArray(body.moves)?body.moves:[]).slice(0,120)){
      if(!Number.isSafeInteger(c.seq)||c.seq<=(a.moveAck||0))continue;
      if(c.epoch!==(a.moveEpoch||0)){a.moveAck=c.seq;continue;}
      const dt=clamp(Number(c.dt)||0,0,.05);if(dt>a.moveCredit+.00001)break;
      a.moveCredit=Math.max(0,a.moveCredit-dt);motionStep(createWorld(room.game.seed),a,{...c,dt});a.moveAck=c.seq;
      if(a.moving&&(a.stepAt||0)<room.game.t){a.stepAt=room.game.t+.42;room.game.sounds.push({id:room.game.nextEvent++,actor:a.id,x:a.x,y:a.y,scene:a.scene,type:'step',radius:a.crouch?(a.role==='jason'?65:45):a.role==='jason'?210:130,t:room.game.t});}
     }
     const lx=Number(body.lx),ly=Number(body.ly),look=Math.hypot(lx,ly);if(Number.isFinite(look)&&look>.1){a.lx=lx/look;a.ly=ly/look;}
     a.input={dx:0,dy:0,run:false};
    }else{a.input={dx:clamp(dx*scale,-1,1),dy:clamp(dy*scale,-1,1),run:Boolean(body.run)};}
    a.inputAt=room.game.t;const actions=Array.isArray(body.actions)?body.actions.slice(0,8):[];for(const action of actions)if(Number.isSafeInteger(action?.clientId))a.actionAck=Math.max(a.actionAck||0,action.clientId);applyActions(room.game,a,actions);}}
  }
  if(!room.players.length){const result=await db.prepare('DELETE FROM nightfall_rooms WHERE code=? AND rev=?').bind(code,row.rev).run();if(result.meta.changes)return{left:true};}
  else{
   room.rev=Number(row.rev)+1;const result=await db.prepare('UPDATE nightfall_rooms SET state=?,rev=?,phase=?,members=?,updated_at=? WHERE code=? AND rev=?').bind(JSON.stringify(room),room.rev,room.phase,rowMembers(room),now,code,row.rev).run();
   if(result.meta.changes)return command==='leave'?{left:true}:response(room,p,issued);
  }
  await new Promise(resolve=>setTimeout(resolve,8+retry*9));
 }
 throw new GameError('Состояние обновляется. Повторите запрос.',409);
}
