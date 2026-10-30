import{WORLD,ROOM,ROLE_NAMES,ITEM_NAMES,createWorld,clamp,dist,within,nearPoint,door,windowPoint,windowInside,hideable,fuseBox,move,motionStep,obstacles,lightObstacles,route}from'/world.mjs';
import{smoothAngle,aimAngle,smoothPose,skillGeometry,TASK_WORDS,actionProgress,controlLockRemaining,groundShadowShape}from'/presentation.mjs';
const nearestPoint=nearPoint;
const root=document.getElementById('nightfall'),$=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');
const ROLE_INFO={jason:'Выслеживание в тумане, капканы и мачете. Короткий бег и скрытые планы противников.',mechanic:'Быстрее чинит. Q облегчает три проверки реакции.',scout:'Быстрый разведчик. Q помогает услышать шум в большем радиусе.',guard:'Начинает с оружием. Боезапас ограничен, новые припасы — в домах.',medic:'Две перевязки. E помогает раненому, Q позволяет перевязаться самому.'};
const palette={night:'#111d20',paper:'#eee9d8',ground:'#192e28',grass:'#2b4436',leaf:'#1d392f',leafLight:'#315b43',road:'#303c3b',roadLine:'#6a7466',roof:'#243f51',roofLight:'#35596b',wall:'#60432e',wood:'#8c5b36',floor:'#5c5045',floorLine:'#383b34',warm:'#df9861',window:'#e3c57d',red:'#e57665',blue:'#77b6ce',purple:'#b598d7',steel:'#c5d5ce',cloth:'#416849',clothLight:'#94b787',skin:'#dcb995',dim:'#adb8a8',water:'#193c4d'};
let fonts={normal:'13px Manrope,sans-serif',medium:'500 13px Manrope,sans-serif'},player={x:990,y:420,fx:0,fy:1,walk:0,moving:false,stamina:1,swing:0,cooldowns:{}},camera={x:990,y:390},scene=-1,W=1000,H=650,dpr=1,zoom=1,seed=1,map=null,houses=[],furniture=[],trees=[],specks=[],lamps=[],terrain=null,roomFloor=null,treeArt=[],puddles=[],elapsed=0,view=null,room=null,memberId=null,token='',code='',state='lobby',mapOpen=false;
let nextActions=[],pending=false,retryPacket=null,seq=0,lastPoll=0,lastViewAt=0,latency=0,connected=true,auto=null,runToggle=false,localGoal=null,localPath=[],raf=0,lastFrame=0,checkSent=null,lastCheckId=null,lastScene=null,seenEffects=new Set(),lastEvent=0,localMessage='',localMessageUntil=0;
const keys=new Set(),drawActors=new Map(),params=new URLSearchParams(location.search),guest=params.get('guest')||'',storage=guest?sessionStorage:localStorage,sessionKey='nightfall-session-v1'+guest;
const reduced={get matches(){return motionOff;}},VAN={x:490,y:940},roleNames=ROLE_NAMES,itemNames=ITEM_NAMES,generator=seed=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
const sense={get time(){return view?.me.sense||0;}};
let motionOff=matchMedia('(prefers-reduced-motion: reduce)').matches,soundEnabled=localStorage.getItem('nightfall-sound')!=='off',audio=null,master=null,droneGain=null,nextBeat=0,lastStep=0,musicNodes=[];
let pendingMoves=[],moveSeq=0,moveAccumulator=0,aimPoint=null,lastUi=0,fpsFrames=0,fpsTime=0,maxCorrection=0,latestCorrection=0;
let visualPose={x:990,y:420,scene:-2,epoch:-1},lookAngle=Math.PI/2,pendingInteraction=null,actionSeq=Date.now(),lastMessage=null,clockTime=0,leaving=false,sessionGeneration=0;
let session=null;try{session=JSON.parse(storage.getItem(sessionKey)||'null');}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const focusActor=()=>view?.focus||view?.me;const isSpectating=()=>!!view?.spectator?.active;const canControl=()=>!!view&&room?.phase==='playing'&&!view.me.dead&&!view.me.escaped&&!isSpectating();const killer=()=>focusActor()?.role==='jason';
const htmlValues=new WeakMap();const setHTML=(selector,value)=>{const el=$(selector);if(htmlValues.get(el)!==value){el.innerHTML=value;htmlValues.set(el,value);}};
const put=(selector,value)=>{const el=$(selector);if(el&&el.textContent!==String(value))el.textContent=String(value);};
function fmt(t){t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
function note(text){localMessage=String(text);localMessageUntil=performance.now()+3500;}
function remember(){if(token&&room)storage.setItem(sessionKey,JSON.stringify({code:room.code,token,id:memberId,name:$('[data-name]').value}));}
let stream=null,streamReady=false,streamAllowed=false,streamCode='',streamRequestId=0,streamRetry=0,streamRetryTimer=null;const streamRequests=new Map();
function closeStream(){const socket=stream;stream=null;streamReady=false;streamCode='';clearTimeout(streamRetryTimer);for(const {reject,timer}of streamRequests.values()){clearTimeout(timer);reject(Object.assign(new Error('Соединение обновляется.'),{status:503}));}streamRequests.clear();if(socket)socket.close();}
function ensureStream(){
 if(!streamAllowed||!room||leaving||stream&&streamCode===room.code)return;if(stream)closeStream();const expected=room.code,generation=sessionGeneration,socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');stream=socket;streamCode=expected;
 socket.addEventListener('open',()=>{if(stream!==socket||!room||room.code!==expected)return;socket.send(JSON.stringify({kind:'auth',code:expected,token}));});
 socket.addEventListener('message',event=>{if(stream!==socket||generation!==sessionGeneration||leaving)return;let message;try{message=JSON.parse(event.data);}catch{return;}
  if(message.kind==='ready'){streamReady=true;streamRetry=0;accept(message.data);root.dataset.transport='websocket';}
  else if(message.kind==='state'&&streamReady)accept(message.data);
  else if(message.kind==='response'){const request=streamRequests.get(message.id);if(!request)return;streamRequests.delete(message.id);clearTimeout(request.timer);if(message.error)request.reject(Object.assign(new Error(message.error),{status:message.status||503}));else request.resolve(message.data);}
 });
 const closed=()=>{if(stream!==socket)return;stream=null;streamReady=false;root.dataset.transport='http';for(const {reject,timer}of streamRequests.values()){clearTimeout(timer);reject(Object.assign(new Error('Соединение обновляется.'),{status:503}));}streamRequests.clear();if(room&&!leaving)streamRetryTimer=setTimeout(ensureStream,Math.min(15000,800*Math.pow(1.8,streamRetry++)));};socket.addEventListener('close',closed);socket.addEventListener('error',()=>{});
}
function streamRequest(body){return new Promise((resolve,reject)=>{if(!streamReady||!stream)return reject(Object.assign(new Error('Соединение обновляется.'),{status:503}));const id=++streamRequestId,timer=setTimeout(()=>{streamRequests.delete(id);reject(Object.assign(new Error('Сервер не ответил.'),{status:503}));},4500);streamRequests.set(id,{resolve,reject,timer});stream.send(JSON.stringify({kind:'request',id,body}));});}
fetch('/api/connection',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(config=>{streamAllowed=config?.transport==='websocket';ensureStream();}).catch(()=>{});

async function request(url,body,auth=token){if(body&&streamReady&&url==='/api/rooms/'+streamCode){try{return await streamRequest(body);}catch(error){if(error.status&&error.status<500)throw error;}}const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});let data;try{data=await response.json();}catch{throw Object.assign(new Error(response.status===403?'Этот адрес заблокирован сетью или хостингом.':'Сервер не ответил. Попробуйте подключиться снова.'),{status:response.status||503});}if(!response.ok)throw Object.assign(new Error(data.error||'Не удалось подключиться.'),{status:response.status});return data;}
async function list(){if(room)return;try{const data=await request('/api/lobby');connected=true;const root=$('[data-rooms]');root.replaceChildren();if(!data.rooms.length){const p=document.createElement('p');p.className='online-note';p.textContent='Пока нет комнат. Создай первую и пригласи друзей.';root.append(p);}for(const r of data.rooms){const card=document.createElement('article');card.className='room-card';const h=document.createElement('h3');h.textContent=r.title;const p=document.createElement('p');p.textContent=r.code+' · '+r.players.length+' / '+r.capacity+' · '+(r.phase==='lobby'?'ждут игроков':r.phase==='playing'?'матч идёт':'ночь закончилась');const b=document.createElement('button');b.textContent='Присоединиться';b.disabled=r.phase!=='lobby'||r.players.length>=r.capacity;b.onclick=()=>join(r.code);card.append(h,p,b);root.append(card);}}catch(e){put('[data-error]',e.message);connected=false;}put('[data-connection-label]',room?'Отклик сервера':'Сеть');put('[data-connection]',connected?'Общее лобби':'Нет связи');}
async function create(){ensureAudio();$('[data-create]').disabled=true;put('[data-error]','');try{const data=await request('/api/lobby',{name:name(),title:'Ночь · '+name()});accept(data);history.replaceState(null,'','?room='+room.code+(guest?'&guest='+guest:''));}catch(e){put('[data-error]',e.message);}finally{$('[data-create]').disabled=false;}}
function name(){const n=$('[data-name]').value.trim().slice(0,20)||'Игрок';storage.setItem('nightfall-name',n);return n;}
async function join(c){ensureAudio();c=String(c||$('[data-code]').value).toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,6);if(c.length!==6){put('[data-error]','Введи шестизначный код комнаты.');return;}put('[data-error]','');try{const saved=session?.code===c?session.token:'';const data=await request('/api/rooms/'+c,{op:'join',name:name()},saved);token=data.token||saved;accept(data);history.replaceState(null,'','?room='+c+(guest?'&guest='+guest:''));}catch(e){put('[data-error]',e.message);}}
async function operation(op,extra={}){if(!room)return;try{const data=await request('/api/rooms/'+room.code,{op,...extra});accept(data);put('[data-room-error]','');}catch(e){put('[data-room-error]',e.message);note(e.message);}}
async function leave(){if(leaving)return;leaving=true;sessionGeneration++;closeStream();if(room){try{await request('/api/rooms/'+room.code,{op:'leave'});}catch{}}room=null;view=null;token='';memberId=null;session=null;storage.removeItem(sessionKey);state='lobby';retryPacket=null;nextActions=[];seq=0;pendingMoves=[];moveSeq=0;history.replaceState(null,'',location.pathname+(guest?'?guest='+guest:''));drawActors.clear();pendingInteraction=null;leaving=false;show();list();}
function accept(data){
 const oldGameVisible=!!view;
 if(data.left)return;if(room?.code===data.room?.code&&(data.room.rev??0)<(room.rev??0))return;if(data.token)token=data.token;if(data.playerId)memberId=data.playerId;room=data.room;code=room.code;connected=true;remember();
 if(data.game){const old=view;view=data.game;lastViewAt=performance.now();elapsed=view.time;state=room.phase;
  const mapChanged=!map||map.seed!==view.seed;
  if(mapChanged){seed=view.seed;map=createWorld(view.seed);houses=map.houses.map(h=>({...h,power:true,locked:false,barricade:0,cleared:false,checked:[false,false,false,false]}));trees=map.trees;specks=map.specks;lamps=map.lamps;}
  let rebuild=mapChanged||scene!==focusActor().scene||lastScene===null;
  for(const h of view.houses){if(houses[h.id].power!==h.power||JSON.stringify(houses[h.id].windows)!==JSON.stringify(h.windows))rebuild=true;Object.assign(houses[h.id],h);}
  const actor=focusActor(),prior=old?.focus||old?.me,changed=scene!==actor.scene||!prior||prior.id!==actor.id||old.seed!==view.seed||(prior.moveEpoch||0)!==(actor.moveEpoch||0);scene=actor.scene;furniture=map.layouts[scene<0?0:scene];
  if(changed){player={...actor,sneak:actor.crouch};camera.x=player.x;camera.y=player.y-35;localPath=[];auto=null;drawActors.clear();pendingMoves=[];moveSeq=Math.max(moveSeq,view.me.moveAck||0);moveAccumulator=0;clockTime=view.time;lookAngle=Math.atan2(actor.ly??actor.fy,actor.lx??actor.fx);smoothPose(visualPose,player,0,true);pendingInteraction=null;rebuild=true;}
  else if(isSpectating()){Object.assign(player,actor,{sneak:actor.crouch});pendingMoves=[];}
  else{const before={x:player.x,y:player.y};pendingMoves=pendingMoves.filter(c=>c.seq>(view.me.moveAck||0)&&c.epoch===(view.me.moveEpoch||0));Object.assign(player,view.me,{sneak:view.me.crouch});for(const c of pendingMoves)motionStep(map,player,c);latestCorrection=dist(before,player);maxCorrection=Math.max(maxCorrection,latestCorrection);}
  if(!isSpectating()){player.lx=Math.cos(lookAngle);player.ly=Math.sin(lookAngle);}if(!canControl()){pendingInteraction=null;pendingMoves=[];nextActions=[];localPath=[];auto=null;keys.clear();runToggle=false;}else if(pendingInteraction&&((view.me.actionAck||0)>=pendingInteraction.id))pendingInteraction=null;actionSeq=Math.max(actionSeq,view.me.actionAck||0);
  if(actor.hidden){localPath=[];auto=null;}
  for(const a of view.actors){if(a.id===player.id)continue;let p=drawActors.get(a.id);if(!p||p.scene!==a.scene)p={...a};p.target=a;drawActors.set(a.id,p);}for(const id of drawActors.keys())if(!view.actors.some(a=>a.id===id))drawActors.delete(id);
  if(rebuild){buildTerrain();lastScene=scene;}
  if(view.me.message?.until>view.time&&lastMessage!==view.me.message.until+'|'+view.me.message.text){lastMessage=view.me.message.until+'|'+view.me.message.text;note(view.me.message.text);}
  const c=view.me.repair?.check;if(c?.id!==lastCheckId){lastCheckId=c?.id;checkSent=null;}
  for(const s of view.sounds)if(!seenEffects.has(s.id)){seenEffects.add(s.id);playEvent(s);}if(seenEffects.size>500)seenEffects=new Set(view.sounds.map(s=>s.id));
  if(auto&&auto.scene===scene&&dist(player,auto)<38&&!view.me.task){auto=null;sendAction('interact');}
 }else{view=null;state=room.phase;}
 ensureStream();show();if(view&&(!oldGameVisible)){resize();}updateUI();lastUi=performance.now();
}
function show(){if(!room){put('[data-role]','Выбери роль');put('[data-clock]','10:00');}$('[data-lobby]').hidden=!!room;$('[data-room]').hidden=!room||room.phase!=='lobby';$('[data-game]').hidden=!room||room.phase==='lobby';$('[data-leave]').hidden=!room;if(room?.phase==='lobby')renderRoom();}
function renderRoom(){put('[data-room-code]',room.code);put('[data-room-title]',room.title);const own=room.players.find(p=>p.id===memberId);const roleRoot=$('[data-roles]');if(!roleRoot.dataset.built){setHTML('[data-roles]',Object.entries(ROLE_NAMES).map(([role,label])=>'<button type="button" class="role-card" data-pick="'+role+'"><strong>'+label+'</strong><p>'+ROLE_INFO[role]+'</p><small></small></button>').join(''));roleRoot.dataset.built='true';for(const button of root.querySelectorAll('[data-pick]'))button.onclick=()=>operation('role',{role:button.dataset.pick});}for(const button of root.querySelectorAll('[data-pick]')){const role=button.dataset.pick,occupant=room.players.find(p=>p.role===role),taken=!!occupant&&occupant.id!==memberId;button.classList.toggle('selected',own?.role===role);button.classList.toggle('occupied',taken);button.disabled=taken;button.setAttribute('aria-pressed',String(own?.role===role));const text=occupant?.name||'Свободно';if(button.querySelector('small').textContent!==text)button.querySelector('small').textContent=text;}setHTML('[data-roster]',room.players.map(p=>'<div class="roster-item">'+(p.ready?'✓ ':'○ ')+esc(p.name)+' <small>'+ROLE_NAMES[p.role]+(p.host?' · создатель':'')+'</small></div>').join(''));put('[data-ready]',own?.ready?'Не готов':'Я готов');$('[data-ready]').setAttribute('aria-pressed',String(own?.ready));$('[data-start]').hidden=room.host!==memberId;$('[data-start]').disabled=!room.players.every(p=>p.ready);put('[data-room-hint]',room.players.length===1?'Можно начать одному: противниками и напарниками будут боты. Пригласи друзей по ссылке для совместного матча.':'Все игроки должны подтвердить готовность. Отсутствующие роли заполнит ИИ.');put('[data-role]',own?ROLE_NAMES[own.role]:'Выбери роль');}
function currentContext(){if(!canControl())return null;if(player.hidden)return view.context;const candidates=(view.interactions||[]).filter(c=>dist(player,c)<61).sort((a,b)=>dist(player,a)-dist(player,b));return candidates[0]||((view.context&&dist(player,view.context)<68)?view.context:null);}
function sendAction(type,extra={}){if(!canControl()||leaving)return;if(type==='interact'&&(pendingInteraction||view.me.task))return;const clientId=++actionSeq;
 if(type==='interact'){const c=currentContext();localPath=[];auto=null;keys.clear();runToggle=false;pendingInteraction={id:clientId,type:view.me.repair?'repair':c?.type||'interact',at:performance.now(),scene,waiting:true};drawFeedback();}
 nextActions.push({type,clientId,...extra});if(nextActions.length>8)nextActions=nextActions.slice(-8);pump(true);}

function check(){const c=view?.me.repair?.check;if(!c||checkSent===c.id)return;checkSent=c.id;sendAction('check',{id:c.id,time:gameTime()});}
function gameTime(){if(!view)return 0;const time=view.time+Math.min(1.5,(performance.now()-lastViewAt+latency*.45)/1000);clockTime=Math.max(clockTime,time);return clockTime;}
async function pump(force=false){if(!room||pending||leaving)return;const now=performance.now(),playing=room.phase==='playing';if(!force&&now-lastPoll<(playing?(streamReady?80:220):850))return;lastPoll=now;pending=true;const started=performance.now(),generation=sessionGeneration,roomCode=room.code;
 let packet;if(playing&&canControl()){if(retryPacket)packet=retryPacket;else{const dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);packet={op:'input',protocol:2,seq:++seq,moves:pendingMoves.slice(0,120),lx:player.lx??player.fx,ly:player.ly??player.fy,actions:nextActions.splice(0,8)};}}else packet={op:'poll'};
 try{const data=await request('/api/rooms/'+roomCode,packet);if(generation!==sessionGeneration||leaving)return;latency=performance.now()-started;retryPacket=null;accept(data);}catch(e){if(generation!==sessionGeneration||leaving)return;connected=false;if(e.status===401||e.status===404){storage.removeItem(sessionKey);note(e.message);room=null;view=null;token='';show();put('[data-error]',e.message);}else if(playing)retryPacket=packet;put('[data-connection]',e.status===409?'Обновление…':'Нет связи');}finally{pending=false;if(nextActions.length&&room&&!leaving)pump(true);}}
function updateUI(){
 put('[data-connection-label]',room?'Отклик сервера':'Сеть'); put('[data-connection]',connected?(room?Math.round(latency)+' мс':'Общее лобби'):'Нет связи');if(!view)return;const me=focusActor(),k=killer();put('[data-role]',ROLE_NAMES[me.role]);put('[data-clock]',fmt(600-view.time));put('[data-place]',scene<0?'КРИСТАЛ-ЛЕЙК · '+(k?'охота в тумане':'ищите детали и пути побега'):houses[scene].name+' · '+(houses[scene].power?'свет включён':'темнота'));put('[data-threat]',me.hidden?'В УКРЫТИИ · E — ВЫЙТИ':view.me.dead&&!isSpectating()?'ТЫ ПОГИБ':player.stun>0?'ОГЛУШЕНИЕ · '+player.stun.toFixed(1)+'с':me.dead?'ТЫ ПОГИБ':me.escaped?'ВЫ СПАСЛИСЬ':me.exhausted?'НЕТ ВЫНОСЛИВОСТИ':!k&&view.threat>.55?'ДЖЕЙСОН РЯДОМ':'');put('[data-health]',Math.ceil(me.hp));$('[data-health-bar]').style.width=100*me.hp/me.maxHp+'%';$('[data-stamina-bar]').style.width=100*player.stamina+'%';$('[data-rage-wrap]').hidden=!k;$('[data-rage-bar]').style.width=(me.rage||0)+'%';put('[data-rage]',Math.floor(me.rage||0)+'%');
 const context=currentContext();put('[data-action]',pendingInteraction?'Начинаем…':me.task?(TASK_WORDS[me.task.type]||'Действие')+'…':me.repair?'Прекратить ремонт · E':context?.label||'Подойди к объекту · E');$('[data-action]').disabled=me.dead||me.escaped||!!me.task||!!pendingInteraction||(!context&&!me.repair);put('[data-attack]',k?'Мачете · Пробел':me.weapon?(me.weapon==='rifle'?'Ружьё':me.weapon==='flare'?'Ракета':'Бита')+' ×'+me.ammo+' · Пробел':'Найди оружие · Пробел');$('[data-run]').setAttribute('aria-pressed',String(runToggle));$('[data-sneak]').setAttribute('aria-pressed',String(me.crouch));put('[data-sneak]',me.crouch?'Тихий шаг · C':'Тишина · C');put('[data-sense]',(k?'Слух':me.role==='mechanic'?'Фокус':me.role==='medic'?'Перевязка':me.role==='guard'?'Чутьё':'Слух')+((me.cooldowns.sense||0)>0?' · '+Math.ceil(me.cooldowns.sense)+' с':' · Q'));
 for(const type of ['trap','knife','dash','fury'])$('[data-'+type+']').hidden=!k;put('[data-trap]','Капкан ×'+(me.trapStock||0)+' · T');put('[data-knife]','Нож ×'+(me.knives||0)+' · F');put('[data-dash]',(me.cooldowns.dash||0)>0?'Рывок · '+Math.ceil(me.cooldowns.dash)+' с':'Рывок · V');put('[data-block]',k?'Защита · B':'Баррикада · B');$('[data-drop]').hidden=k||!me.bag;put('[data-bag]',me.bag?ITEM_NAMES[me.bag.kind]:'');put('[data-class]',ROLE_NAMES[me.role]);put('[data-side-title]',k?'Выслеживание':'Пути побега');put('[data-log-title]',k?'Что слышно':'Ваша команда');put('[data-match-count]',view.kills+' пойманы · '+view.escaped+' спаслись');
 if(k){setHTML('[data-objectives]','<p class="me-object">Сведения о ремонте, деталях и перемещениях противников скрыты. Выслеживай по шуму, изучай дома и наблюдай за тем, что происходит в поле зрения.</p>');const noises=view.sounds.filter(s=>s.type!=='step'&&s.type!=='swing').slice(-5).reverse();setHTML('[data-log]',noises.length?noises.map(s=>'<p>'+({shot:'Выстрел',repair:'Шум ремонта',repairFail:'Громкая ошибка ремонта',engine:'Шум мотора',glass:'Звон стекла',break:'Грохот',work:'Шорохи',rustle:'Шорохи',shout:'Крик',hit:'Удар',power:'Щелчок щитка',radio:'Радиосигнал'}[s.type]||'Шум')+' '+direction(s)+'</p>').join(''):'<p>Сейчас тихо. Q помогает прислушаться.</p>');}
 else{setHTML('[data-objectives]',view.projects.map(p=>'<article class="objective"><header>'+esc(p.name)+'<span>'+(p.departed?'УШЛА':p.ready?(p.id===2?'ПОМОЩЬ '+Math.ceil(p.rescue)+'с':'ПОСАДКА'):Math.floor(p.progress*100)+'%')+'</span></header><p>'+p.needs.map(i=>(p.installed[i]?'✓ ':'○ ')+ITEM_NAMES[i]).join(' · ')+'</p><div class="track"><i style="width:'+Math.floor(p.progress*100)+'%"></i></div></article>').join(''));setHTML('[data-log]',view.team.map(n=>'<div class="teammate"><span>'+esc(n.name)+(n.human?' ●':'')+'</span><span>'+(n.dead?'Пойман':n.escaped?'Спасся':n.hp<2?'Ранен':n.activity||'В игре')+'</span></div>').join(''));}
 put('[data-tip]',k?'Q — чутьё раз в минуту. E у шкафа или кровати — обыск. Бег короткий, после него нужно восстановиться.':(me.hidden?'Ты спрятался. Движение и фонарик выключены. E — выйти.':ROLE_INFO[me.role]+' Мышь — фонарик, L — выключить. E у шкафа или кровати — спрятаться. E у окна — открыть или перелезть.')+' Ремонт запускается через E после установки всех деталей. Проверка — Пробел в светлой зоне.');const checking=canControl()&&!!me.repair?.check&&room.phase==='playing';$('[data-skill-panel]').hidden=!checking;$('[data-check]').disabled=checkSent===me.repair?.check?.id;
 const ended=room.phase==='ended';$('[data-result]').hidden=!ended;put('[data-result-title]',view.winner==='jason'?'Ночь осталась за Джейсоном.':'Выжившие увидели рассвет.');put('[data-result-text]',(view.me.dead?'Ты погиб. ':view.me.escaped?'Ты выбрался. ':'')+view.kills+' пойманы · '+view.escaped+' спаслись');$('[data-reset]').hidden=room.host!==memberId;updateLifeUI();
}
function updateLifeUI(){
 const own=view.me,watching=isSpectating(),out=own.dead||own.escaped,ended=room.phase==='ended',targets=view.spectator?.targets||[];
 $('[data-death-screen]').hidden=!out||watching||ended;$('[data-spectator-bar]').hidden=!watching||ended;$('[data-stage-top]').hidden=watching;$('[data-game-controls]').hidden=out||ended;$('[data-game-abilities]').hidden=out||ended;$('[data-keyboard-hint]').hidden=out||ended;
 put('[data-health-label]',watching?'ЗДОРОВЬЕ ВЫЖИВШЕГО':'СТОЙКОСТЬ');
 if(out&&!watching&&!ended){put('[data-death-title]',own.dead?'Ты погиб':'Ты выбрался');put('[data-death-description]',own.dead?'Твой путь закончился. Остальные ещё могут спастись.':'Ты в безопасности. Можно посмотреть, как закончится ночь.');put('[data-survived-time]',fmt(own.deathAt??view.time));put('[data-survivors-left]',targets.length);$('[data-watch]').disabled=!targets.length;put('[data-watch]',targets.length?'Наблюдать за выжившими':'Нет выживших для наблюдения');}
 if(watching){const a=focusActor();put('[data-role]','Наблюдение');put('[data-watching-name]',a.name);put('[data-watching-status]',ROLE_NAMES[a.role]+' · '+(a.hidden?'В укрытии':a.hp<a.maxHp?'Ранен':'В игре')+' · '+(scene<0?'На улице':houses[scene].name));setHTML('[data-spectator-select]',targets.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join(''));$('[data-spectator-select]').value=a.id;for(const selector of['[data-spectator-prev]','[data-spectator-next]','[data-spectator-select]'])$(selector).disabled=targets.length<2;put('[data-tip]','Ты наблюдаешь за выжившим. ← / → переключают персонажей, M открывает карту. Управление героем отключено.');}
 root.dataset.life=own.dead?'dead':own.escaped?'escaped':'alive';root.dataset.spectating=watching?focusActor().id:'';root.dataset.hp=String(own.hp);root.dataset.stun=player.stun.toFixed(2);
}
function watchSurvivor(direction=0){if(!view?.spectator?.available)return;operation('spectate',{watch:true,direction});}
function direction(s){const dx=s.x-player.x,dy=s.y-player.y;if(Math.abs(dx)<70&&Math.abs(dy)<70)return'совсем рядом';return( dy<-70?'к северу':dy>70?'к югу':'')+(Math.abs(dx)>70?(dy<-70||dy>70?'-':'к ')+(dx<0?'западу':'востоку'):'');}
// Recorded Foley, field rain and string music. No noise-generator fallback.
const AUDIO_FILES=['rain-outdoor','rain-indoor','music-dark','music-tension','step-wet-1','step-wet-2','step-wet-3','step-wood-1','step-wood-2','step-wood-3','step-leaf-1','step-leaf-2','door-open','door-close','window','hide','unhide','search-1','search-2','pickup','heal','latch','repair-1','repair-2','install','break','impact','glass','switch','swing-1','swing-2','shot','heartbeat'];
const audioBank=new Map(),audioLoops=new Map();let audioLoading=null,effectsBus=null,ambienceBus=null,musicBus=null,compressor=null,activeVoices=0,nextLocalStep=0,lastStepPosition=null,lastAudioFrame=0,audioMatchSeed=null,musicStarted=0;
let volumes={master:.55,rain:.30,music:.45,effects:.65};try{const saved=JSON.parse(localStorage.getItem('nightfall-mix')||'null');if(saved)for(const key of Object.keys(volumes))if(Number.isFinite(saved[key]))volumes[key]=clamp(saved[key],0,1);}catch{}
function ensureAudio(){
 if(!soundEnabled)return;if(audio){audio.resume();return;}
 try{audio=new(window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=0;compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.012;compressor.release.value=.22;const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.12;master.connect(compressor);compressor.connect(limiter);limiter.connect(audio.destination);
  effectsBus=audio.createGain();effectsBus.gain.value=volumes.effects;effectsBus.connect(master);ambienceBus=audio.createGain();ambienceBus.connect(master);musicBus=audio.createGain();musicBus.connect(master);audio.resume();root.dataset.audio='loading';audioLoading=loadAudioBank();
 }catch{audio=null;root.dataset.audio='unavailable';}
}
async function loadAudioBank(){
 const failed=[];const load=async id=>{try{const response=await fetch('/audio/'+id+'.mp3',{cache:'force-cache'});if(!response.ok)throw Error('asset');const buffer=await audio.decodeAudioData(await response.arrayBuffer());audioBank.set(id,buffer);}catch{failed.push(id);}};
 const priority=AUDIO_FILES.filter(id=>!id.startsWith('music-')&&!id.startsWith('rain-'));let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<priority.length)await load(priority[cursor++]);}));
 await Promise.all(['rain-outdoor','rain-indoor','music-dark','music-tension'].map(load));root.dataset.audio=failed.length?'partial':'recordings';root.dataset.audioAssets=String(audioBank.size);
}
function sample(id,{gain=1,pan=0,rate=1,when=0,bus=effectsBus}={}){
 if(!soundEnabled||!audio||!bus||document.hidden||activeVoices>=14)return false;const buffer=audioBank.get(id);if(!buffer)return false;const source=audio.createBufferSource(),volume=audio.createGain();source.buffer=buffer;source.playbackRate.value=rate;volume.gain.value=clamp(gain,0,2);source.connect(volume);
 if(audio.createStereoPanner){const p=audio.createStereoPanner();p.pan.value=clamp(pan,-.85,.85);volume.connect(p);p.connect(bus);}else volume.connect(bus);
 activeVoices++;source.onended=()=>{activeVoices=Math.max(0,activeVoices-1);source.disconnect();volume.disconnect();};source.start(audio.currentTime+when);return true;
}
function audioLoop(id,bus){if(audioLoops.has(id))return audioLoops.get(id);const buffer=audioBank.get(id);if(!buffer)return null;const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(bus);source.start(0,0);const loop={source,gain};audioLoops.set(id,loop);return loop;}
function tone(){/* Legacy callers intentionally have no synthesized fallback. */}
function playEvent(s){
 if(!audio||!soundEnabled||document.hidden)return;const type=s.type;if(type==='step'&&s.self&&!isSpectating())return;
 const dx=(s.x??player.x)-player.x,dy=(s.y??player.y)-player.y,d=Math.hypot(dx,dy),gain=s.self?1:clamp(1-d/650,.12,1),pan=s.self?0:dx/420,variant=(s.id||0)%2+1,play=(id,g=1,rate=1,when=0)=>sample(id,{gain:g*gain,pan,rate,when});
 if(type==='step'){play('step-'+(scene<0?'wet':'wood')+'-'+((s.id||0)%3+1),.7,killer()?.93:1);}
 else if(type==='shot')play('shot',1);
 else if(type==='hit'||type==='bat')play('impact',.9,.93);
 else if(type==='swing'||type==='knife')play('swing-'+variant,.8);
 else if(type==='flare'){play('shot',.45,.77);play('swing-2',.35,.75,.1);}
 else if(type==='door'){play('door-open',.9,.96);play('door-close',.5,1,.45);}
 else if(type==='window')play('window',.8);
 else if(type==='vault'){play('hide',.65,1.05);play('window',.4,1.1,.12);}
 else if(type==='glass')play('glass',.75);
 else if(type==='search'||type==='work')play('search-'+variant,.85);
 else if(type==='hide'||type==='unhide')play(type,.8);
 else if(type==='pickup')play('pickup',.8);
 else if(type==='repair')play('repair-'+variant,.8);
 else if(type==='install')play('install',.8);
 else if(type==='repairFail'||type==='break')play('break',.8,.96);
 else if(type==='check')play('latch',.75,1.3);
 else if(type==='success')play('install',.55,1.12);
 else if(type==='heal')play('heal',.8);
 else if(type==='trap'||type==='power')play(type==='power'?'switch':'latch',.85);
 else if(type==='engine'){play('repair-2',.8,.65);play('latch',.4,.8,.3);}
 else if(type==='radio')play('switch',.5,1.1);
 else if(type==='shout')play('impact',.4,.8);
}
function localFootstep(){
 if(!canControl()||!audio||!player.moving||player.hidden||player.stun>0||player.dead||document.hidden){lastStepPosition=null;return;}
 const t=audio.currentTime;if(lastStepPosition&&dist(player,lastStepPosition)<12)return;if(t<nextLocalStep)return;
 const running=(keys.has('run')||runToggle)&&!player.exhausted&&player.stamina>.02,variant=Math.floor(player.walk*2)%3+1;sample('step-'+(scene<0?'wet':'wood')+'-'+variant,{gain:player.crouch?.38:.8,rate:killer()?.94:1});nextLocalStep=t+(running?.29:player.crouch?.57:.42);lastStepPosition={x:player.x,y:player.y};
}
function music(){
 if(!audio||!master)return;const t=audio.currentTime;if(t-lastAudioFrame<.045)return;lastAudioFrame=t;const playing=!!view&&room?.phase==='playing'&&!document.hidden&&soundEnabled;
 master.gain.setTargetAtTime(playing?volumes.master:0,t,.3);effectsBus.gain.setTargetAtTime(volumes.effects,t,.12);if(!playing){for(const loop of audioLoops.values())loop.gain.gain.setTargetAtTime(0,t,.3);return;}
 if(audioMatchSeed!==seed){audioMatchSeed=seed;musicStarted=t;nextBeat=t;}
 const threat=!killer()?view.threat:0,intro=clamp(1-(t-musicStarted)/18,0,1),inside=scene>=0,targets={'rain-outdoor':inside?0:volumes.rain*1.4,'rain-indoor':inside?volumes.rain*1.5:0,'music-dark':volumes.music*(.48+intro*.48)*(1-threat*.55),'music-tension':volumes.music*(Math.pow(threat,1.5)*1.6)};
 for(const [id,target]of Object.entries(targets)){const loop=audioLoop(id,id.startsWith('rain')?ambienceBus:musicBus);if(loop)loop.gain.gain.setTargetAtTime(target,t,id.startsWith('rain')?.65:1.3);}
 if(threat>.28&&t>=nextBeat){nextBeat=t+1.18-threat*.57;sample('heartbeat',{gain:.4+threat*.65,bus:musicBus});sample('heartbeat',{gain:.23+threat*.4,when:.18,bus:musicBus,rate:1.06});}
 root.dataset.audioScene=inside?'indoor':'rain';root.dataset.musicThreat=threat.toFixed(2);
}
for(const input of root.querySelectorAll('[data-volume]')){const key=input.dataset.volume;input.value=String(Math.round(volumes[key]*100));input.addEventListener('input',()=>{volumes[key]=clamp(Number(input.value)/100,0,1);localStorage.setItem('nightfall-mix',JSON.stringify(volumes));ensureAudio();});}

  function rounded(c,x,y,w,h,r,ink) {
    c.fillStyle=palette[ink];c.beginPath();
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();c.fill();
  }
  function polygon(c,points,ink){c.fillStyle=palette[ink];c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();}
  function ellipse(c,x,y,rx,ry,ink,alpha=1){c.save();c.globalAlpha*=alpha;c.fillStyle=palette[ink];c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.restore();}
  function glow(c,x,y,r,ink,alpha=.2){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,palette[ink]);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function line(c,x1,y1,x2,y2,ink,width=1,alpha=1){c.save();c.globalAlpha*=alpha;c.strokeStyle=palette[ink];c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();}
  function drawHouse(h) {
    const x=h.x,y=h.y,cleared=h.cleared,lit=h.power&&!cleared;
    ellipse(ctx,x+130,y+159,151,39,'night',.8);
    glow(ctx,x+120,y+172,83,'window',lit?.30:.025);
    if(lit){ctx.save();ctx.globalAlpha=.045;polygon(ctx,[[x+100,y+151],[x+141,y+151],[x+186,y+235],[x+58,y+235]],'window');ctx.restore();}
    rounded(ctx,x+66,y+143,108,43,4,'wood');
    for(let yy=y+151;yy<y+185;yy+=9)line(ctx,x+68,yy,x+172,yy,'floorLine',1,.8);
    rounded(ctx,x,y+59,240,98,3,'wall');
    for(let yy=y+80;yy<y+155;yy+=11)line(ctx,x+4,yy,x+236,yy,'wood',1,.65);
    line(ctx,x+7,y+85,x+7,y+156,'wood',6);line(ctx,x+233,y+85,x+233,y+156,'wood',6);
    for(const w of h.windows||[]) {const xx=x+w.offset-16;
      glow(ctx,xx+17,y+122,46,'window',lit?.25:.015);
      rounded(ctx,xx-3,y+104,39,36,2,'night');rounded(ctx,xx,y+107,33,28,1,lit?'window':'roof');
      polygon(ctx,[[xx,y+107],[xx+10,y+107],[xx+6,y+132],[xx,y+132]],'wall');polygon(ctx,[[xx+33,y+107],[xx+24,y+107],[xx+28,y+132],[xx+33,y+132]],'wall');
      line(ctx,xx+16,y+107,xx+16,y+136,'wood',3);line(ctx,xx,y+120,xx+33,y+120,'wood',3);if(w.state==='closed'){rounded(ctx,xx,y+107,33,28,1,'wood');for(let i=0;i<4;i++)line(ctx,xx+2,y+111+i*6,xx+31,y+111+i*6,'wall',1);}else if(w.state==='barred'){line(ctx,xx-2,y+107,xx+35,y+133,'wood',7);line(ctx,xx-2,y+133,xx+35,y+107,'wood',7);}else if(w.state==='broken'){line(ctx,xx+2,y+107,xx+13,y+121,'steel',1);}
    }
    rounded(ctx,x+99,y+100,42,59,3,'night');rounded(ctx,x+104,y+105,32,51,2,'wood');
    line(ctx,x+110,y+111,x+130,y+111,'wall',2);line(ctx,x+110,y+139,x+130,y+139,'wall',2);
    ellipse(ctx,x+130,y+133,2,2,'window');
    if(h.locked){rounded(ctx,x+112,y+125,13,13,3,'steel');ctx.save();ctx.strokeStyle=palette.steel;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+118.5,y+124,4,Math.PI,0);ctx.stroke();ctx.restore();}
    polygon(ctx,[[x-19,y+66],[x+120,y-18],[x+259,y+66],[x+240,y+92],[x,y+92]],'roof');
    polygon(ctx,[[x+120,y-18],[x+259,y+66],[x+120,y+67],[x-19,y+66]],'roofLight');
    line(ctx,x-18,y+67,x+258,y+67,'night',4,.5);
    for(let i=1;i<6;i++){const yy=y-18+i*14,w=i*23;line(ctx,x+120-w,yy,x+120+w,yy,'roof',1,.7);}
    for(let row=1;row<=5;row++){const yy=y-18+row*14,half=row*23;for(let xx=x+120-half+10+(row%2)*9;xx<x+120+half-3;xx+=19){line(ctx,xx,yy,xx+5,yy-9,'night',1,.25);line(ctx,xx+1,yy-1,xx+10,yy-1,'steel',1,.08);}}
    line(ctx,x-18,y+65,x+120,y-18,'steel',1,.24);line(ctx,x+120,y-18,x+258,y+65,'blue',1,.5);
    for(let i=0;i<5;i++)line(ctx,x+18+i*45,y+70,x+18+i*45,y+87,'roofLight',1,.4);
    rounded(ctx,x+177,y-5,22,34,2,'wall');rounded(ctx,x+173,y-8,30,9,2,'wood');
    rounded(ctx,x+108,y+76,25,19,3,'night');ctx.font=fonts.medium;ctx.textAlign='center';ctx.fillStyle=cleared?palette.clothLight:palette.paper;ctx.fillText(h.tag,x+120,y+91);
    if(h.kind==='clinic'){rounded(ctx,x+168,y+105,40,31,3,'paper');line(ctx,x+188,y+110,x+188,y+130,'red',5);line(ctx,x+178,y+120,x+198,y+120,'red',5);}
    else if(h.kind==='radio'){line(ctx,x+80,y-12,x+80,y-105,'steel',3);line(ctx,x+53,y-76,x+107,y-76,'steel',2);line(ctx,x+65,y-94,x+95,y-94,'steel',2);ellipse(ctx,x+80,y-106,3,3,'red');}
    else if(h.kind==='workshop'){rounded(ctx,x+20,y+103,68,54,3,'roadLine');for(let i=0;i<6;i++)line(ctx,x+22,y+109+i*8,x+86,y+109+i*8,'night',2,.5);}
    else if(h.kind==='diner'){rounded(ctx,x-5,y+93,250,12,3,'warm');for(let i=0;i<10;i++)rounded(ctx,x+i*25,y+93,12,12,0,'paper');}
    else if(h.kind==='store'){rounded(ctx,x-25,y+128,34,30,3,'wood');line(ctx,x-22,y+131,x+5,y+155,'wall',3);}
    else if(h.kind==='boathouse'){line(ctx,x+10,y+165,x+80,y+165,'wood',6);line(ctx,x+12,y+180,x+83,y+180,'wood',6);}
  }
  function artTree(t) {
    ctx.save();ctx.translate(t.x,t.y);ctx.scale(t.size,t.size);
    ctx.globalAlpha=treeOpacity(t);
    ellipse(ctx,12,7,39,13,'night',.55);const variant=Math.floor(t.x+t.y)%treeArt.length;
    ctx.drawImage(treeArt[variant],-65,-160,130,177);ctx.restore();
  }
  function buildTreeArt(){
    treeArt=[];
    for(let v=0;v<3;v++){
      const art=document.createElement('canvas');art.width=156;art.height=212;const c=art.getContext('2d'),random=generator(7881+v*571);
      rounded(c,72,151,13,50,4,'wood');line(c,75,160,75,199,'floorLine',2,.7);
      for(let row=0;row<6;row++){
        const y=174-row*27,width=58-row*8;
        ellipse(c,78,y,width,17,'leaf');
        for(let i=0;i<12;i++){
          const x=78+(random()*2-1)*width*.83,yy=y-4-random()*15;
          ellipse(c,x,yy,5+random()*9,7+random()*10,i%4===0?'grass':x<82?'leafLight':'leaf',.72+random()*.25);
          if(i%3===0)line(c,x-3,yy-2,x+3,yy-3,'clothLight',1,.15);
        }
      }
      treeArt.push(art);
    }
  }
  function drawFuse(h){
    const p=fuseBox(h);line(ctx,h.x+h.w,p.y,p.x,p.y,'night',3);line(ctx,p.x,p.y,p.x,p.y+25,'wood',3);
    rounded(ctx,p.x-11,p.y-17,23,29,3,'night');rounded(ctx,p.x-9,p.y-15,19,25,2,'roofLight');
    line(ctx,p.x-5,p.y-7,p.x+5,p.y-7,'dim',1,.7);line(ctx,p.x-5,p.y-3,p.x+5,p.y-3,'dim',1,.7);
    ellipse(ctx,p.x+5,p.y+5,2,2,h.power?'window':'red');
    if(h.power)glow(ctx,p.x+5,p.y+5,14,'window',.14);
  }
  function drawVan(){
    const x=VAN.x,y=VAN.y;ellipse(ctx,x+6,y-25,40,24,'night',.8);
    rounded(ctx,x-31,y-72,63,59,12,'roadLine');rounded(ctx,x-28,y-75,57,56,11,'roofLight');
    rounded(ctx,x-22,y-68,45,21,6,'night');line(ctx,x,y-46,x,y-20,'road',2);
    rounded(ctx,x-27,y-29,8,12,2,'red');rounded(ctx,x+20,y-29,8,12,2,'red');
    glow(ctx,x-23,y-18,29,'red',.20);glow(ctx,x+24,y-18,29,'red',.20);
    rounded(ctx,x-12,y-24,25,7,2,'dim');ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText('ПОБЕГ',x,y+18);
  }
  function drawLamp(l){glow(ctx,l.x,l.y,145,'window',.2);ellipse(ctx,l.x+8,l.y+6,18,7,'night',.7);line(ctx,l.x,l.y,l.x,l.y-68,'night',6);line(ctx,l.x,l.y-68,l.x+15,l.y-68,'roadLine',3);rounded(ctx,l.x+8,l.y-72,17,8,3,'window');glow(ctx,l.x+17,l.y-69,30,'window',.7);}
  function drawFurniture(f) {
    const h=houses[scene],checked=f.slot!==undefined&&h.checked[f.slot],x=f.x,y=f.y;
    rounded(ctx,x+5,y+9,f.w,f.h,5,'night');
    if(f.kind==='wardrobe'){
      rounded(ctx,x,y,f.w,f.h,4,'wood');rounded(ctx,x+4,y+5,f.w-8,f.h-8,2,'wall');
      line(ctx,x+f.w/2,y+6,x+f.w/2,y+f.h-3,'night',2);
      for(const xx of [x+8,x+f.w/2+6])line(ctx,xx,y+9,xx,y+f.h-8,'wood',2);
      ellipse(ctx,x+f.w/2-7,y+f.h/2,2,2,'window');ellipse(ctx,x+f.w/2+7,y+f.h/2,2,2,'window');
      if(checked)polygon(ctx,[[x+f.w/2,y+5],[x+f.w/2+12,y+11],[x+f.w/2+12,y+f.h+3],[x+f.w/2,y+f.h-2]],'floor');
    }else if(f.kind==='bed'){
      rounded(ctx,x-3,y-4,f.w+6,f.h+7,5,'wood');rounded(ctx,x+4,y+1,f.w-8,f.h-5,5,'paper');
      rounded(ctx,x+6,y+23,f.w-12,f.h-29,5,'roofLight');rounded(ctx,x+11,y+6,40,14,5,'dim');rounded(ctx,x+f.w-51,y+6,40,14,5,'dim');
      for(let i=0;i<4;i++)line(ctx,x+15+i*30,y+32,x+22+i*30,y+f.h-12,'blue',2,.35);
    }else if(f.kind==='chest'){
      rounded(ctx,x,y,f.w,f.h,5,'wood');rounded(ctx,x+3,y+3,f.w-6,f.h-12,4,'wall');
      line(ctx,x+15,y+3,x+15,y+f.h,'night',5,.6);line(ctx,x+f.w-15,y+3,x+f.w-15,y+f.h,'night',5,.6);
      rounded(ctx,x+f.w/2-5,y+f.h-17,10,11,2,'window');if(checked)line(ctx,x+5,y+8,x+f.w-5,y+8,'night',5);
    }else if(f.kind==='sofa'){
      rounded(ctx,x,y,f.w,f.h,10,'cloth');rounded(ctx,x+9,y+8,f.w-18,f.h-15,6,'leafLight');line(ctx,x+f.w/2,y+11,x+f.w/2,y+f.h-9,'cloth',3);
      rounded(ctx,x-3,y+3,14,f.h-4,6,'cloth');rounded(ctx,x+f.w-11,y+3,14,f.h-4,6,'cloth');
    }else if(['rack','shelf','medicine'].includes(f.kind)){
      rounded(ctx,x,y,f.w,f.h,3,f.kind==='medicine'?'paper':'roofLight');for(let row=0;row<3;row++){line(ctx,x+4,y+8+row*(f.h-10)/3,x+f.w-4,y+8+row*(f.h-10)/3,'night',3,.65);for(let k=0;k<Math.floor(f.w/24);k++)rounded(ctx,x+8+k*23,y+11+row*(f.h-10)/3,12,Math.max(7,f.h/5),2,(k+row)%3===0?'warm':f.kind==='medicine'?'paper':'wood');}
    }else if(f.kind==='radio'){
      rounded(ctx,x,y,f.w,f.h,5,'wood');for(let i=0;i<3;i++){rounded(ctx,x+8+i*70,y+6,59,f.h-12,3,'night');rounded(ctx,x+13+i*70,y+10,48,17,2,'cloth');for(let k=0;k<4;k++)ellipse(ctx,x+17+i*70+k*10,y+f.h-17,2,2,k%2?'red':'window');}
    }else if(f.kind==='sink'){
      rounded(ctx,x,y,f.w,f.h,4,'paper');rounded(ctx,x+12,y+8,f.w-24,f.h-16,7,'steel');rounded(ctx,x+20,y+13,f.w-40,f.h-26,5,'roofLight');line(ctx,x+f.w/2,y+4,x+f.w/2,y+18,'night',4);
    }else if(f.kind==='crate'){
      rounded(ctx,x,y,f.w,f.h,3,'wood');for(let i=1;i<4;i++)line(ctx,x+5,y+i*f.h/4,x+f.w-5,y+i*f.h/4,'wall',3);line(ctx,x+8,y+4,x+f.w-8,y+f.h-5,'wall',5);line(ctx,x+f.w-8,y+4,x+8,y+f.h-5,'wall',5);
    }else if(f.kind==='hull'){
      polygon(ctx,[[x+f.w/2,y],[x+f.w,y+40],[x+f.w-10,y+f.h],[x+10,y+f.h],[x,y+40]],'wood');polygon(ctx,[[x+f.w/2,y+13],[x+f.w-12,y+47],[x+f.w-20,y+f.h-12],[x+20,y+f.h-12],[x+12,y+47]],'roof');for(let yy=y+50;yy<y+f.h-15;yy+=29)line(ctx,x+15,yy,x+f.w-15,yy,'wood',6);
    }else if(f.kind==='engine'){
      rounded(ctx,x,y,f.w,f.h,7,'night');rounded(ctx,x+10,y+12,f.w-20,f.h-24,4,'steel');for(let i=0;i<4;i++)line(ctx,x+18+i*17,y+15,x+18+i*17,y+f.h-15,'roadLine',5);
    }else if(['workbench','counter'].includes(f.kind)){
      rounded(ctx,x,y,f.w,f.h,4,'wood');rounded(ctx,x+4,y+4,f.w-8,f.h-8,2,f.kind==='counter'?'steel':'wall');for(let i=0;i<4;i++){line(ctx,x+15+i*30,y+12,x+24+i*30,y+f.h-12,'steel',3);ellipse(ctx,x+20+i*30,y+15,3,3,'night');}
    }else{
      rounded(ctx,x,y,f.w,f.h,8,'wood');rounded(ctx,x+4,y+4,f.w-8,f.h-8,6,'wall');
      rounded(ctx,x+11,y+9,22,30,2,'roofLight');line(ctx,x+16,y+12,x+16,y+35,'dim',1,.5);ellipse(ctx,x+f.w-17,y+f.h-16,6,6,'paper');ellipse(ctx,x+f.w-17,y+f.h-16,3,3,'wood');
    }
    if(f.slot!==undefined&&!checked){const nearby=dist(player,nearestPoint(player,f))<70;ctx.save();ctx.globalAlpha=nearby?.8:.23;ctx.strokeStyle=palette.window;ctx.lineWidth=nearby?2:1;ctx.strokeRect(x-3,y-3,f.w+6,f.h+6);ctx.restore();}
  }
  function artPerson(p,isJason=false) {
    const x=p.x,y=p.y,moving=isJason?p.moving:p.moving;
    const stride=moving?Math.sin(p.walk)*4:0,bob=moving?Math.abs(Math.cos(p.walk))*.9:0;
    ellipse(ctx,x+2,y+3,isJason?19:15,6,'night',.6);
    ctx.save();ctx.translate(x,y-bob);const size=isJason?1.1:.93;ctx.scale(size,size);
    rounded(ctx,-9,-17-stride,8,19,3,'night');rounded(ctx,2,-17+stride,8,19,3,'night');
    rounded(ctx,-11,-3-stride,11,6,2,'night');rounded(ctx,1,-3+stride,13,6,2,'night');
    rounded(ctx,-13,-38,27,28,7,isJason?'cloth':p.shirt);
    const fabric=ctx.createLinearGradient(-13,-30,14,-25);fabric.addColorStop(0,palette.paper);fabric.addColorStop(.30,'transparent');fabric.addColorStop(1,palette.night);
    ctx.save();ctx.globalAlpha=.23;ctx.fillStyle=fabric;ctx.fillRect(-10,-35,22,20);ctx.restore();
    line(ctx,0,-35,0,-12,'night',2,.65);line(ctx,-9,-26,-3,-26,isJason?'clothLight':'paper',1,.5);
    line(ctx,4,-26,10,-26,isJason?'clothLight':'paper',1,.5);
    if(isJason){polygon(ctx,[[-11,-36],[-3,-34],[-5,-27]],'clothLight');polygon(ctx,[[10,-36],[3,-34],[5,-27]],'cloth');line(ctx,-8,-19,-3,-19,'clothLight',1,.3);polygon(ctx,[[-12,-12],[-9,-8],[-6,-12],[-3,-10],[0,-13],[4,-9],[8,-12],[12,-10],[13,-14]],'cloth');}
    ctx.save();ctx.translate(-12,-32);ctx.rotate(stride*.045);rounded(ctx,-6,-2,8,21,4,isJason?'cloth':p.shirt);ellipse(ctx,-2,20,4,4,'skin');ctx.restore();
    ctx.save();ctx.translate(12,-32);
    const phase=isJason&&p.swing>0?1-p.swing/.48:0;
    ctx.rotate(phase?-1.65+phase*3.5:-stride*.045);
    rounded(ctx,-1,-2,8,20,4,isJason?'cloth':p.shirt);ellipse(ctx,4,19,4,4,'skin');
    if(isJason){ctx.translate(4,20);ctx.rotate(-.6);rounded(ctx,-2,-2,5,10,2,'wood');polygon(ctx,[[-2,7],[4,7],[5,31],[1,36],[-2,32]],'night');polygon(ctx,[[0,8],[3,8],[3,30],[1,33],[0,30]],'steel');}
    ctx.restore();
    ellipse(ctx,p.fx*1.4,-46,12,14,'night');
    if(isJason){
      rounded(ctx,-10+p.fx,-58,20,25,8,'paper');
      ctx.save();ctx.globalAlpha=.18;polygon(ctx,[[5,-56],[10,-51],[10,-40],[5,-34],[7,-45]],'wood');ctx.restore();
      ellipse(ctx,-5+p.fx,-47,3.4,2.6,'night');ellipse(ctx,5+p.fx,-47,3.4,2.6,'night');
      polygon(ctx,[[-5,-54],[5,-54],[0,-50]],'red');polygon(ctx,[[-8,-42],[-4,-39],[-7,-37]],'red');polygon(ctx,[[8,-42],[4,-39],[7,-37]],'red');
      for(const [xx,yy]of [[-7,-52],[7,-52],[0,-43],[-2,-39],[2,-39],[-3,-35],[3,-35]])ellipse(ctx,xx,yy,.9,.9,'night');
      line(ctx,-7,-57,-4,-55,'wood',1,.5);line(ctx,4,-40,6,-35,'wood',1,.4);
      line(ctx,-10,-48,-13,-48,'wood',3);line(ctx,10,-48,13,-48,'wood',3);
    }else{
      rounded(ctx,-9,-55,18,21,7,'skin');polygon(ctx,[[-10,-45],[-10,-55],[-6,-59],[5,-58],[10,-53],[9,-47],[5,-51],[-4,-51],[-7,-44]],'night');
      ellipse(ctx,-4,-44,1,1,'night');ellipse(ctx,4,-44,1,1,'night');
      if(p.stun>0){ctx.font=fonts.medium;ctx.textAlign='center';ctx.fillStyle=palette.steel;ctx.fillText('×',0,-70);}
      else if(p.panic>0){ctx.font=fonts.medium;ctx.textAlign='center';ctx.fillStyle=palette.window;ctx.fillText('!',0,-70);}
      else if(p.aware>.05){rounded(ctx,-12,-70,24,3,1,'night');rounded(ctx,-12,-70,24*p.aware,3,1,'window');}
    }
    ctx.restore();
    if(isJason&&p.swing>0){const phase=1-p.swing/.48,a=Math.atan2(p.fy,p.fx);ctx.save();ctx.globalAlpha=Math.sin(phase*Math.PI)*.64;ctx.strokeStyle=palette.steel;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y-15,49,a-1.7+phase*2.6,a-1.1+phase*2.6);ctx.stroke();ctx.globalAlpha*=.6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-15,56,a-1.9+phase*2.6,a-1.1+phase*2.6);ctx.stroke();ctx.restore();}
    if(isJason&&p.stamina<.98){ctx.save();ctx.globalAlpha=.8;rounded(ctx,x-19,y+14,38,4,2,'night');if(p.stamina>.02)rounded(ctx,x-19,y+14,38*p.stamina,4,Math.min(2,19*p.stamina),'clothLight');ctx.restore();}
    if(isJason&&p.sneak){ctx.save();ctx.strokeStyle=palette.clothLight;ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+4,25,9,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }

function buildTerrain(){
 buildTreeArt();terrain=document.createElement('canvas');terrain.width=WORLD.w;terrain.height=WORLD.h;const c=terrain.getContext('2d');c.fillStyle=palette.ground;c.fillRect(0,0,WORLD.w,WORLD.h);
 c.fillStyle=palette.water;c.fillRect(750,0,32,WORLD.h);for(const p of specks){c.globalAlpha=.20+p.n*.3;line(c,p.x-2,p.y+2,p.x,p.y-3,p.n>.9?'roadLine':'grass',1);line(c,p.x,p.y-3,p.x+3,p.y+1,'grass',1);}c.globalAlpha=1;
 ellipse(c,2250,650,145,375,'water');ellipse(c,900,1230,175,75,'leaf',.28);ellipse(c,560,600,165,118,'floorLine',.5);rounded(c,380,850,260,165,30,'road');
 for(const path of map.paths){c.save();c.lineJoin='round';c.lineCap='round';c.strokeStyle=palette[path.width>40?'road':'floorLine'];c.lineWidth=path.width;c.beginPath();path.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();if(path.width>40){c.setLineDash([23,38]);c.lineWidth=1.5;c.strokeStyle=palette.roadLine;c.globalAlpha=.3;c.stroke();}c.restore();}
 for(const y of[450,940,1430]){rounded(c,734,y-34,65,68,3,'wood');for(let yy=y-30;yy<y+32;yy+=9)line(c,736,yy,797,yy,'floorLine',2);line(c,733,y-34,800,y-34,'roadLine',4);line(c,733,y+34,800,y+34,'roadLine',4);}
 for(let i=0;i<25;i++)line(c,2140+(i%3)*8,335+i*26,2200,335+i*26,'blue',1,.2);
 rounded(c,2035,1013,165,30,2,'wood');for(let x=2038;x<2200;x+=14)line(c,x,1016,x,1040,'floorLine',1,.8);
 const random=generator(seed+177);puddles=[];for(const path of map.paths.slice(0,3))for(let i=0;i<16;i++){const j=i%(path.points.length-1),a=path.points[j],b=path.points[j+1],t=random(),p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-16+random()*32,w:12+random()*32};puddles.push(p);ellipse(c,p.x,p.y,p.w,6,'water',.6);line(c,p.x-p.w*.7,p.y,p.x+p.w*.5,p.y,'roofLight',1,.5);}
 for(let x=30;x<2130;x+=45){line(c,x,22,x+33,22,'wood',3);line(c,x,13,x,31,'wood',3);}
 c.font='600 18px Manrope,sans-serif';c.textAlign='center';for(const[x,y,label]of[[565,718,'СОСНОВЫЙ ЛАГЕРЬ'],[200,1380,'СТАРОЕ КЛАДБИЩЕ'],[1920,1100,'ПРИЧАЛ'],[1480,185,'СЕВЕРНЫЙ ХОЛМ']]){c.globalAlpha=.25;c.fillStyle=palette.dim;c.fillText(label,x,y);}c.globalAlpha=1;
 roomFloor=document.createElement('canvas');roomFloor.width=760;roomFloor.height=560;const f=roomFloor.getContext('2d');f.fillStyle=palette.night;f.fillRect(0,0,760,560);rounded(f,28,25,704,512,4,'floor');
 const kind=scene>=0?houses[scene].kind:'cabin',color=kind==='clinic'?'blue':kind==='radio'?'cloth':kind==='diner'?'warm':'purple';
 for(let y=42;y<525;y+=24){line(f,35,y,725,y,'floorLine',1,.8);for(let x=50+(Math.floor(y/24)%2)*83;x<720;x+=166)line(f,x,y-24,x,y,'floorLine',1,.6);}
 if(['clinic','diner','workshop','radio','store','boathouse'].includes(kind)){f.globalAlpha=.17;for(let yy=50;yy<520;yy+=42)for(let xx=48;xx<720;xx+=42){f.strokeStyle=palette.steel;f.lineWidth=.7;f.strokeRect(xx,yy,40,40);}f.globalAlpha=1;}else{f.globalAlpha=.18;rounded(f,225,195,295,195,4,color);for(let n=0;n<4;n++){f.strokeStyle=palette.warm;f.lineWidth=1;f.strokeRect(234+n*4,204+n*4,277-n*8,177-n*8);}f.globalAlpha=1;}
 const labels={workshop:['РЕМОНТНЫЙ СТОЛ','ЗАПАСНЫЕ ЧАСТИ'],radio:['РАДИОУЗЕЛ','АРХИВ'],diner:['КУХНЯ','ОБЕДЕННЫЙ ЗАЛ'],clinic:['ПЕРЕВЯЗОЧНАЯ','ПАЛАТА'],store:['ИНВЕНТАРЬ','СКЛАД'],boathouse:['ЛОДОЧНАЯ МАСТЕРСКАЯ','ОСНАСТКА'],cabin:scene===6?['ГОСТИНАЯ','СПАЛЬНЯ']:['ЖИЛАЯ КОМНАТА','СПАЛЬНЯ']}[kind];f.font='10px Manrope,sans-serif';f.textAlign='center';f.fillStyle=palette.dim;f.globalAlpha=.42;f.fillText(labels[0],230,350);f.fillText(labels[1],585,355);f.globalAlpha=1;
 // Wall fixtures and scattered props belong to the room, not to a repeated template.
 for(let i=0;i<3;i++){const xx=90+i*180;rounded(f,xx,29,45,8,2,i===scene%3?'warm':'wood');}if(kind==='clinic'){line(f,380,180,380,205,'paper',7,.5);line(f,367,193,393,193,'paper',7,.5);}if(kind==='radio'){for(let i=0;i<5;i++)line(f,430+i*8,90,430+i*8,115,'steel',2,.5);}if(kind==='boathouse'){for(let i=0;i<3;i++)line(f,300+i*18,75,325+i*18,135,'wood',4,.7);}

 const lit=scene<0||houses[scene].power;
 for(const w of scene>=0?houses[scene].windows||[]:[]){const x=windowInside(w).x;if(lit){glow(f,x,110,170,'window',.15);f.globalAlpha=.045;polygon(f,[[x-30,35],[x+30,35],[x+95,230],[x-75,230]],'window');f.globalAlpha=1;}rounded(f,x-32,24,64,10,2,lit?'window':'roofLight');line(f,x,24,x,34,'wood',3);if(w.state==='closed'||w.state==='barred'){rounded(f,x-32,24,64,11,2,'wood');line(f,x-25,26,x+25,34,'steel',w.state==='barred'?3:1);}f.font=fonts.normal;f.fillStyle=palette.dim;f.textAlign='center';f.fillText(w.state==='barred'?'ЗАКОЛОЧЕНО':w.state==='closed'?'ЗАКРЫТО':'ОКНО',x,53);}
 line(f,34,34,725,34,'roofLight',13);line(f,28,34,28,527,'roofLight',12);line(f,732,34,732,527,'roofLight',12);line(f,28,534,337,534,'roofLight',14);line(f,423,534,731,534,'roofLight',14);rounded(f,337,522,86,25,2,'wood');
 f.font=fonts.normal;f.fillStyle=palette.dim;f.textAlign='center';f.fillText('ВЫХОД',380,555);
 for(const x of [48,710]){rounded(f,x-8,480,16,14,3,'wood');for(let i=0;i<5;i++)ellipse(f,x+Math.sin(i*2)*10,468+Math.cos(i*2)*8,6,12,'leafLight');}
}

function drawItem(i){
 const x=i.x,y=i.y;ellipse(ctx,x,y+3,12,4,'night',.5);glow(ctx,x,y,22,i.kind==='weapon'?'red':'window',.09);
 if(i.kind==='fuel'){rounded(ctx,x-7,y-14,14,18,3,'warm');line(ctx,x-2,y-15,x+5,y-15,'night',3);line(ctx,x-2,y-6,x+3,y-1,'wood',2);}
 else if(i.kind==='battery'){rounded(ctx,x-10,y-11,20,15,3,'roofLight');line(ctx,x-6,y-14,x-6,y-10,'red',3);line(ctx,x+6,y-14,x+6,y-10,'steel',3);line(ctx,x-3,y-3,x+3,y-3,'paper',1);}
 else if(i.kind==='weapon'){line(ctx,x-14,y+2,x+14,y-7,'wood',5);line(ctx,x+4,y-4,x+17,y-9,'steel',3);}
 else if(i.kind==='medkit'){rounded(ctx,x-10,y-11,20,17,4,'paper');line(ctx,x-4,y-3,x+4,y-3,'red',3);line(ctx,x,y-7,x,y+1,'red',3);}
 else if(i.kind==='keys'){ctx.save();ctx.strokeStyle=palette.window;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x-3,y-7,5,0,6.28);ctx.stroke();line(ctx,x+1,y-3,x+10,y+6,'window',3);ctx.restore();}
 else if(i.kind==='propeller'){for(let n=0;n<3;n++){ctx.save();ctx.translate(x,y-4);ctx.rotate(n*2.094);ellipse(ctx,6,0,10,4,'steel');ctx.restore();}ellipse(ctx,x,y-4,3,3,'wood');}
 else if(i.kind==='rope'){ctx.save();ctx.strokeStyle=palette.warm;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y-5,10,7,0,0,6.28);ctx.stroke();ctx.beginPath();ctx.ellipse(x,y-5,5,3,0,0,6.28);ctx.stroke();ctx.restore();}
 else{rounded(ctx,x-9,y-12,18,18,3,'roofLight');for(let k=0;k<3;k++)line(ctx,x-5,y-7+k*4,x+5,y-7+k*4,'window',1);}
 if(sense.time>0){ctx.font=fonts.normal;ctx.textAlign='center';ctx.fillStyle=palette.window;ctx.fillText(itemNames[i.kind],x,y-25);}
}
function drawProject(p){
 if(p.id===0){drawVan();if(p.departed){ctx.save();ctx.globalAlpha=.4;rounded(ctx,p.x-32,p.y-75,64,60,8,'night');ctx.restore();}}
 else if(p.id===1){ellipse(ctx,p.x+15,p.y+6,37,26,'water');polygon(ctx,[[p.x-28,p.y-15],[p.x+30,p.y-15],[p.x+42,p.y+30],[p.x,p.y+48],[p.x-40,p.y+30]],'wood');polygon(ctx,[[p.x-21,p.y-8],[p.x+22,p.y-8],[p.x+30,p.y+26],[p.x,p.y+38],[p.x-28,p.y+26]],'roof');rounded(ctx,p.x-18,p.y+5,36,8,2,'wood');}
 else{line(ctx,p.x,p.y,p.x,p.y-145,'steel',4);for(let y=p.y-140;y<p.y;y+=23){line(ctx,p.x-20,y,p.x+20,y+23,'roadLine',2);line(ctx,p.x+20,y,p.x-20,y+23,'roadLine',2);}line(ctx,p.x-20,p.y,p.x,p.y-145,'steel',2);line(ctx,p.x+20,p.y,p.x,p.y-145,'steel',2);ellipse(ctx,p.x,p.y-148,4,4,p.ready?'red':'window');rounded(ctx,p.x-24,p.y-23,48,32,4,'roofLight');rounded(ctx,p.x-18,p.y-18,36,17,2,'night');for(let i=0;i<4;i++)line(ctx,p.x-13+i*8,p.y-14,p.x-13+i*8,p.y-5,'window',2,p.ready?1:.4);}
 ctx.font=fonts.medium;ctx.fillStyle=p.ready?palette.red:palette.dim;ctx.textAlign='center';ctx.fillText(p.name.toUpperCase(),p.x,p.y+66);
 if(!p.departed){rounded(ctx,p.x-35,p.y+77,70,4,2,'night');if(p.progress>.01)rounded(ctx,p.x-35,p.y+77,70*p.progress,4,1,'window');}
}

function drawPerson(a,jason=false){if(a.id===player.id)a={...a,x:visualPose.x,y:visualPose.y,lx:Math.cos(lookAngle),ly:Math.sin(lookAngle)};const n={...a,sneak:a.crouch,health:a.hp,shirt:a.role==='guard'?'warm':a.role==='medic'?'paper':a.role==='scout'?'purple':'blue',panic:0};artPerson(n,jason);if(!jason&&a.flashlight!==false&&!a.hidden){const angle=Math.atan2(a.ly??a.fy,a.lx??a.fx),hx=n.x+Math.cos(angle)*14,hy=n.y-22+Math.sin(angle)*8;ctx.save();ctx.translate(hx,hy);ctx.rotate(angle);rounded(ctx,-5,-3,15,6,2,'steel');rounded(ctx,6,-4,5,8,2,'window');ctx.restore();}if(!jason&&n.weapon){ctx.save();ctx.translate(n.x+14,n.y-27);ctx.rotate(Math.atan2(n.fy,n.fx));if(n.weapon==='rifle'){rounded(ctx,-6,-3,36,6,2,'night');line(ctx,-6,-2,16,-2,'wood',4);line(ctx,10,-1,29,-1,'steel',2);}else if(n.weapon==='bat')line(ctx,-5,0,26,0,'wood',6);else rounded(ctx,-3,-3,22,6,2,'red');ctx.restore();}if(!jason&&n.hp<2){rounded(ctx,n.x-13,n.y-72,26,3,1,'night');rounded(ctx,n.x-13,n.y-72,13,3,1,'red');}if(n.windup>0&&n.aim){ctx.save();ctx.globalAlpha=.6;ctx.setLineDash([4,6]);line(ctx,n.x,n.y-27,n.aim.x,n.aim.y-20,'red',1);ctx.restore();}if(a.id===player.id&&!jason&&a.bag){rounded(ctx,a.x-19,a.y-25,12,16,3,'warm');}if(a.id!==player.id&&(!killer()||dist(player,a)<100)){ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText(a.name,a.x,a.y+22);}}
function treeOpacity(t){const dx=Math.abs(visualPose.x-t.x)/(60*t.size),dy=(t.y-visualPose.y)/(155*t.size);return 1-.78*Math.max(0,1-dx)*Math.max(0,Math.min(1,dy*5))*Math.max(0,Math.min(1,(1-dy)*5));}
function drawTree(t){if(t.type!=='oak'){artTree(t);return;}ctx.save();ctx.translate(t.x,t.y);ctx.scale(t.size,t.size);ctx.globalAlpha=treeOpacity(t);ellipse(ctx,12,7,38,12,'night',.6);rounded(ctx,-6,-60,12,62,4,'wood');for(let i=0;i<9;i++){const x=Math.sin(i*2.3)*29,y=-74+Math.cos(i*2.3)*25;ellipse(ctx,x,y,25,22,i%3?'leafLight':'grass');}ellipse(ctx,-10,-92,28,23,'grass',.7);ctx.restore();}
function drawDecor(d){const x=d.x,y=d.y;if(d.kind==='grave'){rounded(ctx,x-10,y-24,20,27,7,'roadLine');line(ctx,x-4,y-13,x+4,y-13,'night',2);line(ctx,x,y-18,x,y-8,'night',2);ellipse(ctx,x,y+3,18,4,'night',.5);}else if(d.kind==='tent'){ellipse(ctx,x+8,y+7,40,13,'night',.6);polygon(ctx,[[x-32,y+9],[x,y-37],[x+34,y+9]],'warm');polygon(ctx,[[x-20,y+9],[x,y-28],[x+20,y+9]],'cloth');polygon(ctx,[[x-10,y+9],[x,y-13],[x+10,y+9]],'night');line(ctx,x-38,y+13,x,y-37,'steel',1,.5);}else if(d.kind==='bus'){rounded(ctx,x-38,y-55,76,109,9,'wood');rounded(ctx,x-32,y-49,64,96,8,'wall');for(let i=0;i<3;i++){rounded(ctx,x-26,y-42+i*25,20,18,2,'night');rounded(ctx,x+7,y-42+i*25,20,18,2,'roof');}line(ctx,x-39,y+39,x+38,y+39,'warm',3,.5);}else if(d.kind==='sign'){line(ctx,x,y,x,y-45,'wood',5);rounded(ctx,x-32,y-55,64,22,3,'wood');ctx.font='9px Manrope,sans-serif';ctx.textAlign='center';ctx.fillStyle=palette.paper;ctx.fillText(d.label,x,y-41);}else if(d.kind==='well'){ellipse(ctx,x,y,27,14,'roadLine');ellipse(ctx,x,y-6,23,12,'steel');ellipse(ctx,x,y-6,16,8,'night');line(ctx,x-25,y,x-25,y-48,'wood',4);line(ctx,x+25,y,x+25,y-48,'wood',4);polygon(ctx,[[x-35,y-46],[x,y-66],[x+35,y-46]],'roof');}else if(d.kind==='logs'){for(let i=0;i<4;i++){rounded(ctx,x-35,y-15+i*8,68,10,5,'wood');ellipse(ctx,x+31,y-10+i*8,6,5,'warm');}}else if(d.kind==='bench'){rounded(ctx,x-35,y-9,70,20,3,'wood');for(let i=0;i<3;i++)line(ctx,x-33,y-5+i*6,x+33,y-5+i*6,'wall',2);}else if(d.kind==='boat'){polygon(ctx,[[x-37,y],[x,y-20],[x+37,y],[x+27,y+13],[x-27,y+13]],'wood');line(ctx,x-25,y,x+25,y,'roof',6);}else{ellipse(ctx,x,y,22,8,'night');glow(ctx,x,y-7,70,'warm',.23);for(let i=0;i<3;i++){const h=14+(motionOff?3:Math.sin(elapsed*5+i)*4);polygon(ctx,[[x-9+i*7,y],[x-6+i*6,y-h],[x-1+i*7,y]],'warm');}}}
function miniMap(big=false){const mw=big?Math.min(W-40,820):128,mh=big?Math.min(H-85,mw*WORLD.h/WORLD.w):90,x=big?(W-mw)/2:W-mw-13,y=big?(H-mh)/2:H-mh-13,sx=mw/WORLD.w,sy=mh/WORLD.h;ctx.save();if(big){ctx.fillStyle='rgba(6,18,15,.9)';ctx.fillRect(0,0,W,H);}rounded(ctx,x-5,y-5,mw+10,mh+10,6,'night');ctx.fillStyle=palette.water;ctx.fillRect(x+750*sx,y,32*sx,mh);ctx.save();ctx.beginPath();ctx.rect(x,y,mw,mh);ctx.clip();ellipse(ctx,x+2250*sx,y+650*sy,145*sx,375*sy,'water');ellipse(ctx,x+570*sx,y+580*sy,145*sx,105*sy,'floorLine',.65);for(const d of map.decor){if(d.kind==='tent')polygon(ctx,[[x+(d.x-20)*sx,y+(d.y+10)*sy],[x+d.x*sx,y+(d.y-24)*sy],[x+(d.x+20)*sx,y+(d.y+10)*sy]],'warm');else if(d.kind==='grave')ellipse(ctx,x+d.x*sx,y+d.y*sy,big?2:1,big?2:1,'roadLine');else if(d.kind==='bus')rounded(ctx,x+(d.x-27)*sx,y+(d.y-45)*sy,54*sx,90*sy,2,'wood');else if(d.kind==='fire')ellipse(ctx,x+d.x*sx,y+d.y*sy,big?3:1,big?3:1,'warm');}if(big){ctx.font='10px Manrope,sans-serif';ctx.textAlign='center';ctx.fillStyle=palette.dim;ctx.fillText('ПАЛАТОЧНЫЙ ЛАГЕРЬ',x+570*sx,y+735*sy);ctx.fillText('КЛАДБИЩЕ',x+160*sx,y+995*sy);ctx.fillText('КРИСТАЛ-ЛЕЙК',x+2050*sx,y+650*sy);}ctx.restore();for(const path of map.paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i];line(ctx,x+a.x*sx,y+a.y*sy,x+b.x*sx,y+b.y*sy,'road',big?Math.max(2,path.width*sx):2);}for(const h of houses){ctx.fillStyle=h.power?palette.roofLight:palette.roadLine;ctx.fillRect(x+h.x*sx,y+h.y*sy,h.w*sx,h.h*sy);if(big){ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText(h.name,x+(h.x+120)*sx,y+(h.y+195)*sy);}}for(const p of view.projects){ellipse(ctx,x+p.x*sx,y+p.y*sy,big?5:2.5,big?5:2.5,'window');if(big){ctx.font=fonts.normal;ctx.fillStyle=palette.window;ctx.textAlign='center';ctx.fillText(p.name,x+p.x*sx,y+p.y*sy+19);}}for(const a of view.actors)if(a.id!==player.id&&a.scene===-1)ellipse(ctx,x+a.x*sx,y+a.y*sy,big?4:2,big?4:2,a.role==='jason'?'red':'blue');const p=scene<0?player:door(houses[scene]);ellipse(ctx,x+p.x*sx,y+p.y*sy,big?5:3,big?5:3,'paper');for(const s of view.sounds)if(s.scene===-1&&s.type!=='step'){ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=palette.window;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x+s.x*sx,y+s.y*sy,big?12:5,0,Math.PI*2);ctx.stroke();ctx.restore();}if(big){ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText('M — закрыть карту',W/2,y+mh+27);}ctx.restore();}
let fog=document.createElement('canvas'),fogCtx=fog.getContext('2d'),shadowLayer=document.createElement('canvas'),shadowCtx=shadowLayer.getContext('2d');
function drawGroundShadows(){
 if(killer()||player.hidden||player.flashlight===false)return;if(shadowLayer.width!==Math.round(W)||shadowLayer.height!==Math.round(H)){shadowLayer.width=Math.round(W);shadowLayer.height=Math.round(H);}
 const c=shadowCtx,light={x:visualPose.x,y:visualPose.y-20},angle=lookAngle,spread=Math.PI*.26;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.save();c.translate(W/2-camera.x*zoom,H/2-camera.y*zoom);c.scale(zoom,zoom);c.beginPath();c.moveTo(light.x,light.y);c.arc(light.x,light.y,390,angle-spread,angle+spread);c.closePath();c.clip();
 const casters=scene<0?[...houses.map(h=>({x:h.x,y:h.y+130,w:240,h:28,height:130})),...trees.filter(t=>dist(t,light)<430).map(t=>({x:t.x-18*t.size,y:t.y-9*t.size,w:36*t.size,h:18*t.size,height:115*t.size}))]:furniture.map(f=>({x:f.x,y:f.y+f.h*.55,w:f.w,h:f.h*.45,height:f.kind==='wardrobe'?58:25}));
 for(const caster of casters){const shadow=groundShadowShape(light,caster);if(!shadow)continue;const gradient=c.createLinearGradient(shadow.start.x,shadow.start.y,shadow.end.x,shadow.end.y);gradient.addColorStop(0,'rgba(3,10,8,'+shadow.opacity+')');gradient.addColorStop(1,'rgba(3,10,8,0)');c.fillStyle=gradient;c.beginPath();shadow.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();}
 c.restore();ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.filter='blur(2px)';ctx.drawImage(shadowLayer,0,0,W,H);ctx.restore();
}
function drawFog(){
 const fw=Math.round(W),fh=Math.round(H);if(fog.width!==fw||fog.height!==fh){fog.width=fw;fog.height=fh;}const c=fogCtx,x=W/2+(visualPose.x-camera.x)*zoom,y=H/2+(visualPose.y-20-camera.y)*zoom;
 c.clearRect(0,0,W,H);const lit=scene>=0&&houses[scene].power;c.fillStyle='rgba(4,12,15,'+(lit?.61:.81)+')';c.fillRect(0,0,W,H);c.globalCompositeOperation='destination-out';
 const radial=(cx,cy,r,opacity=1)=>{const g=c.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(0,0,0,'+opacity+')');g.addColorStop(.55,'rgba(0,0,0,'+opacity*.85+')');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(cx-r,cy-r,r*2,r*2);};
 if(killer())radial(x,y,(scene<0?270:lit?235:175)*zoom);
 else{radial(x,y,(player.hidden?46:82)*zoom,.8);if(!player.hidden&&player.flashlight!==false){const angle=lookAngle,radius=390*zoom,spread=Math.PI*.26;for(const[extra,opacity]of[[.065,.18],[0,.97]]){c.save();c.beginPath();c.moveTo(x,y);c.arc(x,y,radius,angle-spread-extra,angle+spread+extra);c.closePath();c.clip();radial(x,y,radius,opacity);c.restore();}}}
 if(scene<0){for(const l of lamps)if(dist(player,l)<520){const p=screenPoint({x:l.x+17,y:l.y-40});radial(p.x,p.y,95*zoom,.5);}for(const h of houses)if(h.power&&dist(player,door(h))<490){const p=screenPoint({x:h.x+120,y:h.y+142});radial(p.x,p.y,102*zoom,.27);}}
 c.globalCompositeOperation='source-over';ctx.drawImage(fog,0,0,W,H);
}
function drawSkill(){
 if(!canControl()){$('[data-skill-panel]').hidden=true;return;}const check=view.me.repair?.check,panel=$('[data-skill-panel]');panel.hidden=!check||mapOpen||room.phase!=='playing';if(panel.hidden)return;
 const g=skillGeometry(check,gameTime());$('[data-skill-zone]').setAttribute('d',g.path);$('[data-skill-needle]').setAttribute('x2',String(g.needle.x));$('[data-skill-needle]').setAttribute('y2',String(g.needle.y));
 put('[data-skill-title]','Проверка '+(view.me.repair.level+1));put('[data-check]',checkSent===check.id?'Проверяем…':'Пробел');put('[data-skill-caption]',checkSent===check.id?'Ждём результат':g.pos>=1?'Время вышло':g.pos===0?'Приготовься':'Нажми в светлой зоне');panel.classList.toggle('waiting',checkSent===check.id);
}
function screenPoint(p){return{x:W/2+(p.x-camera.x)*zoom,y:H/2+(p.y-camera.y)*zoom};}
function drawInteractionMarks(){if(mapOpen||player.hidden||view.me.task||pendingInteraction||view.me.repair?.check)return;
 const chosen=currentContext();for(const c of view.interactions||[]){if(dist(player,c)>132)continue;const p=screenPoint(c);if(p.x<12||p.x>W-12||p.y<45||p.y>H-20)continue;const active=chosen&&c.type===chosen.type&&c.id===chosen.id&&c.window===chosen.window;ctx.save();ctx.globalAlpha=active?1:.56;ctx.fillStyle='#10201be8';ctx.strokeStyle=active?palette.window:palette.dim;ctx.lineWidth=active?1.7:1;ctx.beginPath();ctx.arc(p.x,p.y-11,active?13:9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font=(active?'700 11px':'9px')+' Manrope,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=active?palette.window:palette.dim;ctx.fillText(active?'E':'·',p.x,p.y-11);ctx.restore();}
}
function drawFeedback(){if(!view)return;if(!canControl()){$('[data-interaction-hint]').hidden=true;$('[data-action-progress]').hidden=true;return;}const hint=$('[data-interaction-hint]'),bar=$('[data-action-progress]'),task=view.me.task,context=currentContext(),busy=!!task||!!pendingInteraction;
 hint.hidden=mapOpen||busy||!!view.me.repair||!context||player.dead||player.escaped;if(!hint.hidden){const p=screenPoint(context),x=clamp(p.x,Math.min(135,W/2),W-Math.min(135,W/2));hint.style.left=x+'px';hint.style.top=clamp(p.y-35,88,H-100)+'px';put('[data-interaction-label]',context.label.replace(' · E',''));}
 bar.hidden=mapOpen||!busy||player.dead||player.escaped;if(bar.hidden)return;const p=screenPoint({x:visualPose.x,y:visualPose.y}),wait=!task;bar.classList.toggle('pending',wait);bar.style.left=clamp(p.x,90,W-90)+'px';bar.style.top=clamp(p.y-78,100,H-105)+'px';
 if(task){const progress=actionProgress(task,view.time,gameTime());put('[data-progress-label]',progress.label+'…');$('[data-progress-fill]').style.width=(progress.fraction*100)+'%';put('[data-progress-time]',progress.remaining>.05?progress.remaining.toFixed(1)+'с':'…');}
 else{put('[data-progress-label]',(TASK_WORDS[pendingInteraction.type]||'Начинаем')+'…');put('[data-progress-time]','···');}
}
function draw(){if(!view||!terrain)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle=palette.night;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W/2-camera.x*zoom,H/2-camera.y*zoom);ctx.scale(zoom,zoom);ctx.drawImage(scene<0?terrain:roomFloor,0,0);drawGroundShadows();const inView=p=>Math.abs(p.x-camera.x)<W/(2*zoom)+180&&Math.abs(p.y-camera.y)<H/(2*zoom)+200;const layers=[];
 if(scene<0){for(const h of houses)if(inView({x:h.x+120,y:h.y+90})){layers.push({y:h.y+155,fn:()=>{drawHouse(h);ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText(h.name,h.x+120,h.y+210);if(h.barricade){line(ctx,h.x+97,h.y+107,h.x+144,h.y+148,'wood',7);line(ctx,h.x+97,h.y+145,h.x+144,h.y+107,'wood',7);}}});const p=fuseBox(h);layers.push({y:p.y,fn:()=>drawFuse(h)});}for(const t of trees)if(inView(t))layers.push({y:t.y,fn:()=>drawTree(t)});for(const l of lamps)if(inView(l))layers.push({y:l.y,fn:()=>drawLamp(l)});for(const p of view.projects)if(inView(p))layers.push({y:p.y-10,fn:()=>drawProject(p)});for(const d of map.decor)if(inView(d))layers.push({y:d.y,fn:()=>drawDecor(d)});
 }else{for(const f of furniture)layers.push({y:f.y+f.h,fn:()=>drawFurniture(f)});for(const p of map.partitions[scene])layers.push({y:p.y+p.h,fn:()=>rounded(ctx,p.x,p.y,p.w,p.h,2,'roofLight')});}
 for(const i of view.items)layers.push({y:i.y,fn:()=>drawItem(i)});for(const n of drawActors.values())if(n.scene===scene)layers.push({y:n.y,fn:()=>drawPerson(n,n.role==='jason')});if(!player.hidden)layers.push({y:player.y,fn:()=>drawPerson(player,killer())});layers.sort((a,b)=>a.y-b.y);for(const l of layers)l.fn();
 for(const t of view.traps){ctx.save();ctx.strokeStyle=palette.steel;ctx.lineWidth=t.owner==='jason'?2:1;ctx.beginPath();ctx.ellipse(t.x,t.y,t.owner==='jason'?12:25,5,0,0,Math.PI*2);ctx.stroke();if(t.owner==='jason')for(let i=-2;i<=2;i++)line(ctx,t.x+i*5,t.y-4,t.x+i*5+2,t.y+3,'steel',1);else line(ctx,t.x-28,t.y-2,t.x+28,t.y+2,'warm',1);ctx.restore();}
 for(const s of view.sounds)if(view.me.sense>0&&s.scene===scene){const age=clamp(gameTime()-s.t,0,4);ctx.save();ctx.globalAlpha=(1-age/4)*.35;ctx.strokeStyle=palette.window;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(s.x,s.y,25+age*14,13+age*7,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 for(const e of view.effects){const age=gameTime()-e.t;if(age<.35)line(ctx,e.x,e.y,e.tx,e.ty,e.type==='rifle'?'window':e.type==='flare'?'red':'steel',e.type==='flare'?5:2,Math.max(0,1-age/.35));}
 
 if(localPath.length){const p=localPath[localPath.length-1];ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=palette.paper;ctx.beginPath();ctx.ellipse(p.x,p.y,9,4,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if(scene<0&&!motionOff){for(const p of puddles)if(inView(p)){const r=2+(elapsed*11+p.x)%23;ctx.save();ctx.globalAlpha=(1-r/25)*.13;ctx.strokeStyle=palette.steel;ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}}ctx.restore();drawFog();
 if(scene<0&&!motionOff){ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle=palette.steel;ctx.lineWidth=.8;for(let i=0;i<W/15;i++){const x=(i*79.3+elapsed*43)%(W+40)-20,y=(i*107.1+elapsed*320)%(H+40)-20;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+12);ctx.stroke();}ctx.restore();}miniMap(mapOpen);drawInteractionMarks();drawSkill();drawFeedback();root.dataset.state=state;root.dataset.role=player.role;root.dataset.scene=String(scene);
}
function resize(){if(!view||$('[data-game]').hidden)return;const box=$('.stage').getBoundingClientRect(),newW=Math.max(1,box.width),newH=canvas.getBoundingClientRect().height;dpr=Math.min(devicePixelRatio||1,2);if(W!==newW||H!==newH||canvas.width!==Math.round(newW*dpr)){W=newW;H=newH;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}zoom=W<500?.90:1.05;fitCamera();draw();}
function fitCamera(){const size=scene<0?WORLD:ROOM,hw=W/(2*zoom),hh=H/(2*zoom);camera.x=size.w<hw*2?size.w/2:clamp(camera.x,hw,size.w-hw);camera.y=size.h<hh*2?size.h/2:clamp(camera.y,hh,size.h-hh);}
function frame(now){const dt=Math.min(.045,(now-(lastFrame||now))/1000);lastFrame=now;if(view){elapsed=gameTime();player.stun=controlLockRemaining(focusActor(),view.time,elapsed);if(canControl()){
 let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
 if(dx||dy){localPath=[];localGoal=null;}if(!dx&&!dy&&localPath.length){const p=localPath[0],d=dist(player,p);if(d<8)localPath.shift();else{dx=(p.x-player.x)/d;dy=(p.y-player.y)/d;}}
 moveAccumulator+=dt;while(moveAccumulator>=1/30){moveAccumulator-=1/30;if(pendingMoves.length>=120)break;const c={seq:++moveSeq,epoch:view.me.moveEpoch||0,dt:1/30,dx:+dx.toFixed(4),dy:+dy.toFixed(4),run:(keys.has('run')||runToggle)&&!player.crouch,lx:+(player.lx??player.fx).toFixed(5),ly:+(player.ly??player.fy).toFixed(5)};pendingMoves.push(c);motionStep(map,player,c);}
 }

 for(const n of drawActors.values())if(n.target){const a=n.target,x=n.x,y=n.y;Object.assign(n,a);n.x=x+(a.x-x)*(1-Math.exp(-dt*13));n.y=y+(a.y-y)*(1-Math.exp(-dt*13));}const f=motionOff?1:1-Math.exp(-dt*8);smoothPose(visualPose,player,dt);camera.x+=(visualPose.x-camera.x)*f;camera.y+=(visualPose.y-35-camera.y)*f;fitCamera();let target=isSpectating()?Math.atan2(player.ly??player.fy,player.lx??player.fx):aimAngle(aimPoint,visualPose,camera,W,H,zoom,lookAngle);if(!isSpectating()&&!aimPoint&&player.moving)target=Math.atan2(player.fy,player.fx);lookAngle=smoothAngle(lookAngle,target,dt);player.lx=Math.cos(lookAngle);player.ly=Math.sin(lookAngle);localFootstep(dt);draw();if(now-lastUi>120){updateUI();lastUi=now;}fpsFrames++;fpsTime+=dt;if(fpsTime>=1){root.dataset.fps=String(Math.round(fpsFrames/fpsTime));root.dataset.correction=latestCorrection.toFixed(2);root.dataset.maxCorrection=maxCorrection.toFixed(2);root.dataset.pending=String(pendingMoves.length);root.dataset.x=player.x.toFixed(1);root.dataset.y=player.y.toFixed(1);root.dataset.ack=String(view.me.moveAck||0);root.dataset.look=lookAngle.toFixed(3);root.dataset.progress=String(!!view.me.task||!!pendingInteraction);fpsTime=0;fpsFrames=0;}put('[data-toast]',localMessageUntil>now?localMessage:'');}music();pump();raf=requestAnimationFrame(frame);}
const dir={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run'};
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.target?.matches?.('input,select,textarea')||!view||room.phase!=='playing')return;if(!$('[data-help-sheet]').hidden)return;if(!canControl()){if(e.code==='KeyM'&&isSpectating()){e.preventDefault();mapOpen=!mapOpen;}if(isSpectating()&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){e.preventDefault();if(!e.repeat)watchSurvivor(e.code==='ArrowLeft'?-1:1);}return;}if(dir[e.code]){e.preventDefault();if(e.repeat&&(pendingInteraction||view.me.task))return;keys.add(dir[e.code]);pump(true);return;}if(e.repeat)return;const actions={KeyE:'interact',KeyQ:'sense',KeyC:'crouch',KeyT:'trap',KeyF:'knife',KeyV:'dash',KeyB:'block',KeyR:'fury',KeyG:'drop',KeyL:'flashlight'};if(e.code==='Space'){e.preventDefault();if(view.me.repair?.check)check();else sendAction('attack');}else if(actions[e.code]){e.preventDefault();sendAction(actions[e.code]);}else if(e.code==='KeyM'){e.preventDefault();mapOpen=!mapOpen;}else if(e.code==='Escape'){e.preventDefault();keys.clear();runToggle=false;$('[data-help-sheet]').hidden=false;pump(true);}});
document.addEventListener('keyup',e=>{if(dir[e.code]){e.preventDefault();keys.delete(dir[e.code]);pump(true);}});
for(const[selector,handler]of[['[data-watch]',()=>watchSurvivor()],['[data-spectator-prev]',()=>watchSurvivor(-1)],['[data-spectator-next]',()=>watchSurvivor(1)],['[data-stop-watching]',()=>operation('spectate',{watch:false})],['[data-death-leave]',leave]])$(selector).onclick=handler;$('[data-spectator-select]').onchange=e=>operation('spectate',{watch:true,targetId:e.target.value});
$('[data-name]').value=storage.getItem('nightfall-name')||'';$('[data-code]').value=params.get('room')||'';
$('[data-create]').onclick=create;$('[data-join]').onclick=()=>join();$('[data-refresh]').onclick=list;$('[data-ready]').onclick=()=>{ensureAudio();const own=room?.players.find(p=>p.id===memberId);operation('ready',{ready:!own?.ready});};$('[data-start]').onclick=()=>operation('start');$('[data-reset]').onclick=()=>operation('reset');$('[data-leave]').onclick=leave;
$('[data-invite]').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/?room='+room.code);put('[data-room-hint]','Приглашение скопировано. Отправь ссылку друзьям.');}catch{put('[data-room-hint]',location.origin+'/?room='+room.code);}};
$('[data-action]').onclick=()=>sendAction('interact');$('[data-attack]').onclick=()=>view?.me.repair?.check?check():sendAction('attack');$('[data-check]').onclick=check;$('[data-run]').onclick=()=>{runToggle=!runToggle;pump(true);updateUI();};
for(const[type,action]of Object.entries({sense:'sense',sneak:'crouch',trap:'trap',knife:'knife',dash:'dash',block:'block',fury:'fury',drop:'drop'}))$('[data-'+type+']').onclick=()=>{ensureAudio();sendAction(action);};
$('[data-map]').onclick=()=>{mapOpen=!mapOpen;draw();};$('[data-help]').onclick=()=>{keys.clear();runToggle=false;pump(true);$('[data-help-sheet]').hidden=false;};$('[data-close-help]').onclick=()=>{$('[data-help-sheet]').hidden=true;};$('[data-motion]').checked=motionOff;$('[data-motion]').onchange=e=>{motionOff=e.target.checked;};$('[data-sound]').onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem('nightfall-sound',soundEnabled?'on':'off');ensureAudio();put('[data-sound]',soundEnabled?'Звук: вкл.':'Звук: выкл.');$('[data-sound]').setAttribute('aria-pressed',String(soundEnabled));if(master)master.gain.setTargetAtTime(soundEnabled?volumes.master:0,audio.currentTime,.2);};put('[data-sound]',soundEnabled?'Звук: вкл.':'Звук: выкл.');
function aimAt(e){const b=canvas.getBoundingClientRect();aimPoint={x:e.clientX-b.left,y:e.clientY-b.top};}
canvas.addEventListener('pointermove',e=>{if(view)aimAt(e);});canvas.addEventListener('pointerleave',()=>{aimPoint=null;});
$('.stage').addEventListener('pointerdown',e=>{if(!canControl()||e.target!==canvas||mapOpen)return;if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();ensureAudio();aimAt(e);if(e.pointerType!=='mouse'){canvas.setPointerCapture?.(e.pointerId);return;}$('[data-attack]').focus({preventScroll:true});const b=canvas.getBoundingClientRect(),p={x:(e.clientX-b.left-W/2)/zoom+camera.x,y:(e.clientY-b.top-H/2)/zoom+camera.y};let goal=p;auto=null;if(scene<0){const h=houses.find(h=>within(p,{x:h.x-18,y:h.y-22,w:276,h:210}));if(h){const w=h.windows?.find(w=>w.state!=='barred'&&Math.abs(p.x-(h.x+w.offset))<30);goal=w?windowPoint(h,w.id):door(h);auto={...goal,scene,type:w?'window':'door'};}const box=houses.find(h=>dist(p,fuseBox(h))<25);if(box){const f=fuseBox(box);goal={x:f.x,y:f.y+34};auto={...goal,scene};}const project=view.projects.find(v=>dist(p,v)<40);if(project){goal={x:project.x,y:project.y+27};auto={...goal,scene};}}else{const w=houses[scene].windows?.find(w=>w.state!=='barred'&&dist(p,windowInside(w))<50);if(w){goal=windowInside(w);auto={...goal,scene};}if(dist(p,{x:380,y:530})<55){goal={x:380,y:492};auto={...goal,scene};}const i=view.items.find(i=>dist(p,i)<25);if(i){goal={x:i.x,y:i.y};auto={...goal,scene};}}localGoal=goal;localPath=route(map,goal,player,scene);sendAction('go',{x:goal.x,y:goal.y});});
for(const button of root.querySelectorAll('[data-dir]')){button.addEventListener('pointerdown',e=>{e.preventDefault();if(!canControl())return;keys.add(button.dataset.dir);button.setAttribute('aria-pressed','true');button.setPointerCapture?.(e.pointerId);pump(true);});const release=()=>{keys.delete(button.dataset.dir);button.setAttribute('aria-pressed','false');pump(true);};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);}
window.addEventListener('blur',()=>{keys.clear();runToggle=false;pump(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();runToggle=false;if(master)master.gain.setTargetAtTime(0,audio.currentTime,.15);if(droneGain)droneGain.gain.setTargetAtTime(0,audio.currentTime,.2);pump(true);}else lastPoll=0;});new ResizeObserver(resize).observe($('.stage'));
document.addEventListener('pointerdown',ensureAudio,{once:true});document.addEventListener('keydown',ensureAudio,{once:true});
setInterval(()=>{if(!room)list();},3500);list();
if(session?.token&&session.code&&(!params.get('room')||params.get('room')===session.code)){token=session.token;request('/api/rooms/'+session.code,{op:'poll'},token).then(data=>{seq=Date.now();accept(data);}).catch(()=>{storage.removeItem(sessionKey);token='';});}
raf=requestAnimationFrame(frame);
