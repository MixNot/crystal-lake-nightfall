export const PRESENCE_MS=12000,HOST_GRACE_MS=20000,LOBBY_SLOT_MS=90000;
export function maintainRoom(room,now=Date.now()){
 const active=room.players.filter(p=>now-p.last<PRESENCE_MS);
 const host=room.players.find(p=>p.id===room.host);
 if((!host||now-host.last>HOST_GRACE_MS)&&active.length){room.host=active[0].id;room.notice='Создатель отключился. Управление комнатой передано '+active[0].name+'.';}
 if(room.phase==='lobby')room.players=room.players.filter(p=>now-p.last<LOBBY_SLOT_MS);
 if(room.game&&room.phase==='playing'&&room.game.botsEnabled===false){
  for(const a of room.game.actors){const p=room.players.find(p=>p.id===a.human);if(!p||a.dead||a.escaped||a.inactive||now-p.last<45000)continue;
   a.inactive=true;a.input={dx:0,dy:0};a.task=null;a.repair=null;a.moveEpoch=(a.moveEpoch||0)+1;
   if(a.role==='jason'){room.game.ended=true;room.game.winner='survivors';room.phase='ended';room.game.endReason='Охотник покинул матч.';}
   else{a.dead=true;a.hp=0;a.deathAt=room.game.t;room.game.kills++;}
  }
 }
}
