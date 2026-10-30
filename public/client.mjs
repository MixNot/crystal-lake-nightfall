import{skinOptions,skinFor,defaultSkin}from'/appearance.mjs';
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
async function operation(op,extra={}){if(!room)return;try{const data=await request('/api/rooms/'+room.code,{op,...extra});accept(data);put('[data-room-error]','');return data;}catch(e){put('[data-room-error]',e.message);note(e.message);return null;}}
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
function show(){if(!room||room.phase!=='lobby')$('[data-appearance-sheet]').hidden=true;if(!room){put('[data-role]','Выбери роль');put('[data-clock]','10:00');}$('[data-lobby]').hidden=!!room;$('[data-room]').hidden=!room||room.phase!=='lobby';$('[data-game]').hidden=!room||room.phase==='lobby';$('[data-leave]').hidden=!room;if(room?.phase==='lobby')renderRoom();}
function renderRoom(){put('[data-room-code]',room.code);put('[data-room-title]',room.title);const own=room.players.find(p=>p.id===memberId);const roleRoot=$('[data-roles]');if(!roleRoot.dataset.built){setHTML('[data-roles]',Object.entries(ROLE_NAMES).map(([role,label])=>'<button type="button" class="role-card" data-pick="'+role+'"><strong>'+label+'</strong><p>'+ROLE_INFO[role]+'</p><small></small></button>').join(''));roleRoot.dataset.built='true';for(const button of root.querySelectorAll('[data-pick]'))button.onclick=()=>{if(room.players.find(p=>p.id===memberId)?.role===button.dataset.pick)openAppearance();else operation('role',{role:button.dataset.pick});};}for(const button of root.querySelectorAll('[data-pick]')){const role=button.dataset.pick,occupant=room.players.find(p=>p.role===role),taken=!!occupant&&occupant.id!==memberId;button.classList.toggle('selected',own?.role===role);button.classList.toggle('occupied',taken);button.disabled=taken;button.setAttribute('aria-pressed',String(own?.role===role));const text=occupant?.name||'Свободно';if(button.querySelector('small').textContent!==text)button.querySelector('small').textContent=text;}setHTML('[data-roster]',room.players.map(p=>'<div class="roster-item">'+(p.ready?'✓ ':'○ ')+esc(p.name)+' <small>'+ROLE_NAMES[p.role]+' · '+skinFor(p.role,p.skin).name+(p.host?' · создатель':'')+'</small></div>').join(''));put('[data-ready]',own?.ready?'Не готов':'Я готов');$('[data-ready]').setAttribute('aria-pressed',String(own?.ready));$('[data-start]').hidden=room.host!==memberId;$('[data-start]').disabled=!room.players.every(p=>p.ready)||((room.botCount??8)===0&&(!room.players.some(p=>p.role==='jason')||!room.players.some(p=>p.role!=='jason')));put('[data-room-hint]',(room.botCount??8)===0?'Боты отключены. Для начала нужны Джейсон и хотя бы один выживший; все подтверждают готовность.':'Все игроки должны подтвердить готовность. Число ботов и выбранные облики видны всем в комнате.');put('[data-role]',own?ROLE_NAMES[own.role]:'Выбери роль');renderRoomOptions(own);}
let appearanceRole=null,draftSkin=null;const portraitCache=new Map();
function portrait(role,id){const s=skinFor(role,id),key=role+':'+s.id;if(portraitCache.has(key))return portraitCache.get(key);const image=document.createElement('canvas');image.width=260;image.height=280;const c=image.getContext('2d'),bg=c.createRadialGradient(130,130,15,130,130,190);bg.addColorStop(0,'#3d5449');bg.addColorStop(1,'#152525');c.fillStyle=bg;c.fillRect(0,0,260,280);c.save();c.translate(130,231);c.scale(2.7,2.7);characterArt(c,{x:0,y:0,role,skin:s.id,fx:0,fy:1,walk:0,moving:false,swing:0},role==='jason',true);c.restore();const url=image.toDataURL('image/png');portraitCache.set(key,url);return url;}
function renderRoomOptions(own){if(!own)return;const s=skinFor(own.role,own.skin);put('[data-own-skin-name]',s.name);put('[data-own-skin-desc]',s.description);const img=$('[data-own-portrait]'),key=own.role+':'+s.id;if(img.dataset.portrait!==key){img.src=portrait(own.role,s.id);img.dataset.portrait=key;}const count=room.botCount??8,host=room.host===memberId,select=$('[data-bot-count]');select.value=String(count);select.disabled=!host;put('[data-settings-owner]',host?'Настройка меняется до начала матча.':'Настройку меняет создатель комнаты.');put('[data-bots-description]',count===0?'Только игроки. ИИ отключён, включая замену отключившихся игроков.':count+' '+(count===1?'бот-выживший':count<5?'бота-выживших':'ботов-выживших')+' + '+room.players.filter(p=>p.role!=='jason').length+' игроков-выживших. '+(!room.players.some(p=>p.role==='jason')?'Джейсон — ИИ.':'Джейсон — игрок.'));if(appearanceRole&&appearanceRole!==own.role)$('[data-appearance-sheet]').hidden=true;root.dataset.botCount=String(count);root.dataset.skin=s.id;}
function openAppearance(){const own=room?.players.find(p=>p.id===memberId);if(!own||room.phase!=='lobby')return;appearanceRole=own.role;draftSkin=skinFor(own.role,own.skin).id;put('[data-preview-role]',ROLE_NAMES[own.role]);put('[data-skin-count]',skinOptions(own.role).length+' обликов');put('[data-appearance-error]','');setHTML('[data-skin-grid]',skinOptions(own.role).map(s=>'<button type="button" class="skin-card" data-skin-pick="'+s.id+'" aria-pressed="false"><img src="'+portrait(own.role,s.id)+'" alt=""><span>'+esc(s.name)+'</span><small>'+esc(s.tag)+'</small><i aria-hidden="true">✓</i></button>').join(''));for(const b of root.querySelectorAll('[data-skin-pick]'))b.onclick=()=>{draftSkin=b.dataset.skinPick;renderAppearance();};$('[data-appearance-sheet]').hidden=false;renderAppearance();$('[data-close-appearance]').focus({preventScroll:true});}
function renderAppearance(){const s=skinFor(appearanceRole,draftSkin);$('[data-skin-preview]').src=portrait(appearanceRole,s.id);put('[data-preview-name]',s.name);put('[data-preview-tag]',s.tag);put('[data-preview-description]',s.description);for(const b of root.querySelectorAll('[data-skin-pick]')){const selected=b.dataset.skinPick===s.id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}root.dataset.previewSkin=s.id;}
function closeAppearance(){$('[data-appearance-sheet]').hidden=true;$('[data-open-appearance]').focus({preventScroll:true});}
async function applyAppearance(){$('[data-apply-appearance]').disabled=true;const data=await operation('skin',{skin:draftSkin});$('[data-apply-appearance]').disabled=false;if(data)closeAppearance();else put('[data-appearance-error]','Не удалось сохранить облик. Попробуй ещё раз.');}
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
    c.fillStyle=(palette[ink]||ink);c.beginPath();
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();c.fill();
  }
  function polygon(c,points,ink){c.fillStyle=(palette[ink]||ink);c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();}
  function ellipse(c,x,y,rx,ry,ink,alpha=1){c.save();c.globalAlpha*=alpha;c.fillStyle=(palette[ink]||ink);c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.restore();}
  function glow(c,x,y,r,ink,alpha=.2){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,(palette[ink]||ink));g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function line(c,x1,y1,x2,y2,ink,width=1,alpha=1){c.save();c.globalAlpha*=alpha;c.strokeStyle=(palette[ink]||ink);c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.restore();}
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
  function drawVan(p=VAN){
 const x=p.x,y=p.y;ellipse(ctx,x+5,y-28,43,30,'night',.65);
 for(const xx of[x-38,x+28])for(const yy of[y-78,y-27]){rounded(ctx,xx,yy,12,22,4,'#182528');line(ctx,xx+2,yy+4,xx+2,yy+17,'#82928d',2,.6);}
 panel(ctx,x-34,y-102,68,96,'#aebfb7','#3d5556',12);rounded(ctx,x-29,y-97,58,23,7,'#6c9591');line(ctx,x-24,y-91,x+24,y-91,'#c0d5c7',1,.65);
 polygon(ctx,[[x-27,y-72],[x+27,y-72],[x+22,y-53],[x-22,y-53]],'#233f4a');line(ctx,x-22,y-68,x+21,y-68,'#91c5c8',2,.75);line(ctx,x-21,y-55,x-3,y-62,'#aac8c3',1,.5);
 rounded(ctx,x-23,y-51,46,24,5,'#d1d6bd');line(ctx,x-18,y-49,x-18,y-29,'#9baea0',1,.5);line(ctx,x+18,y-49,x+18,y-29,'#9baea0',1,.5);
 polygon(ctx,[[x-22,y-25],[x+22,y-25],[x+27,y-13],[x-27,y-13]],'#2e4d59');line(ctx,x-19,y-22,x+15,y-22,'#9cb9b5',1,.65);
 for(const side of[-1,1]){rounded(ctx,x+side*31-3,y-64,7,7,2,'#c4d3be');rounded(ctx,x+side*27-3,y-96,7,6,2,p.ready?'#f0dc9a':'#d0d8b6');rounded(ctx,x+side*27-3,y-12,7,5,1,'#c95a4b');line(ctx,x+side*29,y-51,x+side*29,y-22,'#425e60',1);}
 rounded(ctx,x-13,y-11,26,5,1,'#e1d6ad');line(ctx,x-28,y-5,x+28,y-5,'#a5b9af',3);if(p.ready){glow(ctx,x-27,y-95,35,'window',.18);glow(ctx,x+27,y-95,35,'window',.18);}
  }
function drawEscapeBoat(p){
 const x=p.x+57,y=p.y+38;ellipse(ctx,x+4,y+2,45,73,'#193c4d',.75);for(const side of[-1,1])line(ctx,x+side*45,y-30,x+side*47,y+45,'#6f9e9e',1,.35);
 polygon(ctx,[[x,y-77],[x+26,y-52],[x+38,y-18],[x+35,y+59],[x+24,y+67],[x-24,y+67],[x-35,y+59],[x-38,y-18],[x-26,y-52]],'#d8d1ad');
 polygon(ctx,[[x,y-63],[x+20,y-44],[x+29,y-14],[x+26,y+54],[x-26,y+54],[x-29,y-14],[x-20,y-44]],'#517985');
 polygon(ctx,[[x,y-59],[x+20,y-34],[x-20,y-34]],'#b3bdb0');line(ctx,x,y-55,x,y-36,'#e8e4c2',2);rounded(ctx,x-25,y-22,50,8,2,'#284650');line(ctx,x-22,y-23,x+22,y-23,'#b8d7cd',3);
 for(const yy of[y+2,y+37]){panel(ctx,x-25,yy,50,12,'#b59c6d','#4e625e',2);line(ctx,x-20,yy+3,x+20,yy+3,'#e1ce9c',1,.7);}
 ellipse(ctx,x+14,y-9,7,7,'#263d42');ellipse(ctx,x+14,y-9,4,4,'#a0b9b2');line(ctx,x+14,y-14,x+14,y-4,'#a0b9b2',1.5);
 panel(ctx,x-10,y+58,20,22,'#849896','#2b434b',5);line(ctx,x,y+78,x,y+92,'#a4b5a7',4);line(ctx,x-9,y+89,x+9,y+89,'#c4d1bf',3);line(ctx,p.x+10,p.y+6,x-27,y+26,'#b6a272',1.5,.8);
}
  function drawLamp(l){glow(ctx,l.x,l.y,145,'window',.2);ellipse(ctx,l.x+8,l.y+6,18,7,'night',.7);line(ctx,l.x,l.y,l.x,l.y-68,'night',6);line(ctx,l.x,l.y-68,l.x+15,l.y-68,'roadLine',3);rounded(ctx,l.x+8,l.y-72,17,8,3,'window');glow(ctx,l.x+17,l.y-69,30,'window',.7);}
function panel(c,x,y,w,h,color,edge='#142023',r=3){rounded(c,x+2,y+4,w,h,r,'#0c181c');rounded(c,x,y,w,h,r,edge);rounded(c,x+2,y+2,w-4,h-5,Math.max(1,r-1),color);line(c,x+4,y+3,x+w-5,y+3,'#f0e7ce',1,.26);}
function woodLines(c,x,y,w,h){for(let n=0;n<4;n++){line(c,x+5,y+6+n*(h-10)/4,x+w-5,y+7+n*(h-10)/4,'#b58b58',1,.25);}}
function drawFurniture(f){
 const h=houses[scene],checked=f.slot!==undefined&&h.checked[f.slot],x=f.x,y=f.y,w=f.w,z=f.h;
 ellipse(ctx,x+w*.55,y+z+3,w*.53,9,'night',.4);
 if(f.kind==='wardrobe'){
  panel(ctx,x,y-17,w,z+17,'#825535','#423628',4);rounded(ctx,x-3,y-21,w+6,7,2,'#b38a5b');
  for(let i=0;i<2;i++){const xx=x+5+i*(w/2-2);panel(ctx,xx,y-12,w/2-8,z+6,'#68432b','#493222',2);line(ctx,xx+5,y-5,xx+w/2-18,y-5,'#ad8553',1,.65);line(ctx,xx+5,y+z-17,xx+w/2-18,y+z-17,'#ad8553',1,.5);woodLines(ctx,xx+2,y+3,w/2-12,z-23);ellipse(ctx,x+w/2+(i?8:-8),y+z*.5-4,2,3,'#e6ca88');}
  line(ctx,x+w/2,y-16,x+w/2,y+z-3,'#251f1c',3);rounded(ctx,x+6,y+z-2,9,8,1,'#4d3527');rounded(ctx,x+w-15,y+z-2,9,8,1,'#4d3527');
  if(checked){polygon(ctx,[[x+w/2,y-14],[x+w/2+15,y-8],[x+w/2+15,y+z+2],[x+w/2,y+z-4]],'#af8050');}
 }else if(f.kind==='bed'){
  const clinic=h.kind==='clinic',frame=clinic?'#a8b6b2':'#7d563a';panel(ctx,x-2,y+1,w+4,z+5,frame,'#303a36',5);rounded(ctx,x-4,y-9,w+8,13,3,frame);
  rounded(ctx,x+5,y+3,w-10,z-8,5,'#e4dfc9');rounded(ctx,x+8,y+7,w-16,20,6,'#faf0d6');line(ctx,x+13,y+22,x+w-13,y+22,'#bbb8a3',1,.6);
  const duvet=clinic?'#a8c8c7':scene%2?'#9f6b55':'#7393a0';rounded(ctx,x+6,y+30,w-12,z-32,4,duvet);line(ctx,x+7,y+31,x+w-7,y+31,'#d9d8c1',4,.8);
  for(let n=1;n<5;n++)line(ctx,x+10+n*(w-20)/5,y+35,x+9+n*(w-20)/5,y+z-8,'#253c44',1,.2);line(ctx,x+8,y+z-10,x+w-8,y+z-10,'#d5d4b6',2,.4);
  rounded(ctx,x-3,y+z-4,w+6,8,2,frame);if(clinic){line(ctx,x-4,y+18,x-4,y+z-6,'#d2dfd9',3);line(ctx,x+w+4,y+18,x+w+4,y+z-6,'#d2dfd9',3);}
 }else if(f.kind==='sofa'){
  panel(ctx,x,y,w,z,'#60705c','#32453c',9);rounded(ctx,x+5,y-7,w-10,17,7,'#89917a');
  const cushions=3;for(let n=0;n<cushions;n++){const xx=x+14+n*(w-28)/cushions;rounded(ctx,xx,y+13,(w-32)/cushions,z-22,6,'#8b9d83');line(ctx,xx+4,y+z-13,xx+(w-32)/cushions-4,y+z-13,'#cad2af',1,.35);}
  rounded(ctx,x-3,y+5,16,z-2,6,'#687a61');rounded(ctx,x+w-13,y+5,16,z-2,6,'#687a61');rounded(ctx,x+20,y+13,22,17,4,'#baa070');
 }else if(f.kind==='chest'||f.kind==='crate'){
  panel(ctx,x,y,w,z,'#855b35','#40342b',4);woodLines(ctx,x,y,w,z);
  if(f.kind==='crate'){line(ctx,x+5,y+6,x+w-6,y+z-7,'#be945b',6);line(ctx,x+w-5,y+6,x+5,y+z-7,'#be945b',6);for(const xx of[x+6,x+w-7])for(const yy of[y+7,y+z-8])ellipse(ctx,xx,yy,1.5,1.5,'#302a24');}
  else{rounded(ctx,x+2,y-4,w-4,Math.max(13,z*.45),4,'#aa7946');for(const xx of[x+13,x+w-18]){rounded(ctx,xx,y-4,6,z+3,1,'#3e4b47');line(ctx,xx+2,y-2,xx+2,y+z-3,'#a5b2a0',1,.5);}rounded(ctx,x+w/2-6,y+z*.45,12,14,2,'#dbb966');ellipse(ctx,x+w/2,y+z*.45+6,2,2,'#3d392b');if(checked)line(ctx,x+3,y+6,x+w-3,y+6,'#30241e',4);}
 }else if(f.kind==='medicine'){
  panel(ctx,x,y-8,w,z+8,'#d5dcd2','#8caaa5',3);line(ctx,x+w/2,y-4,x+w/2,y+z-3,'#6e8d8a',2);
  rounded(ctx,x+10,y+1,w*.34,z-11,2,'#accac9');for(let n=0;n<4;n++){rounded(ctx,x+14+n*9,y+z-23,6,15,1,n%2?'#dbc18a':'#d5eee3');line(ctx,x+15+n*9,y+z-24,x+18+n*9,y+z-24,'#9f4e4c',2);}
  line(ctx,x+w*.76,y+4,x+w*.76,y+z-10,'#b45b54',5);line(ctx,x+w*.76-9,y+z*.45,x+w*.76+9,y+z*.45,'#b45b54',5);ellipse(ctx,x+w/2+8,y+z*.5,2,2,'#5c6e6b');
 }else if(f.kind==='rack'||f.kind==='shelf'){
  panel(ctx,x,y-9,w,z+9,'#4d5b55','#304039',3);const rows=z>90?3:2;
  for(let row=0;row<rows;row++){const yy=y-2+row*(z-3)/rows;for(let n=0;n<Math.floor((w-10)/22);n++){const xx=x+7+n*22;if(f.kind==='shelf'){rounded(ctx,xx,yy,6,Math.max(11,z/rows-9),1,['#ad6954','#9caa87','#c6b278'][n%3]);rounded(ctx,xx+8,yy+2,8,Math.max(9,z/rows-11),1,'#647f86');}else{rounded(ctx,xx,yy+3,15,Math.max(10,z/rows-13),2,n%3?'#a68d5f':'#668981');line(ctx,xx+3,yy+10,xx+12,yy+10,'#ddcf9f',1,.6);}}rounded(ctx,x+3,yy+z/rows-3,w-6,5,1,'#ac9d77');}
  for(const xx of[x+2,x+w-6])rounded(ctx,xx,y-10,5,z+13,1,'#71877a');
 }else if(f.kind==='radio'){
  panel(ctx,x,y,w,z,'#796045','#3b423b',3);for(let n=0;n<3;n++){const xx=x+8+n*(w-14)/3,ww=(w-23)/3;panel(ctx,xx,y+4,ww,z-12,'#556b63','#293e3c',3);rounded(ctx,xx+5,y+9,ww-10,18,2,'#a9cbb6');line(ctx,xx+9,y+18,xx+ww-9,y+18,'#396856',1);for(let k=0;k<3;k++)ellipse(ctx,xx+10+k*(ww-18)/3,y+z-24,4,4,k===1?'#dbbd75':'#c4d1bf');}
  line(ctx,x+10,y+z-2,x+w-12,y+z-2,'#b99864',3);
 }else if(f.kind==='sink'){
  panel(ctx,x,y,w,z,'#d8d8c9','#859795',4);rounded(ctx,x+8,y+7,w-16,z-17,8,'#8ca6aa');rounded(ctx,x+14,y+12,w-28,z-27,6,'#567982');ellipse(ctx,x+w/2,y+z*.58,3,2,'#243f48');
  line(ctx,x+w/2,y+5,x+w/2,y-8,'#d8e1da',5);line(ctx,x+w/2,y-8,x+w/2+12,y-8,'#e5ebe0',5);line(ctx,x+w/2+12,y-8,x+w/2+12,y+7,'#c4d5d0',4);for(const xx of[x+w/2-13,x+w/2+25])ellipse(ctx,xx,y+4,4,3,'#c2d2c8');
 }else if(f.kind==='counter'){
  panel(ctx,x,y,w,z,'#9eb3ab','#56766f',3);rounded(ctx,x+6,y+7,w*.4,z-17,3,'#d4d4be');
  for(const xx of[x+w*.64,x+w*.84]){ellipse(ctx,xx,y+z*.45,15,12,'#354f50');ellipse(ctx,xx,y+z*.45,9,7,'#809390');line(ctx,xx+12,y+z*.45,xx+27,y+z*.45,'#263b3a',4);}
  ellipse(ctx,x+w*.2,y+z*.55,15,9,'#eff0dd');line(ctx,x+18,y+12,x+18,y+z-12,'#a77a4c',4);
 }else if(f.kind==='workbench'){
  panel(ctx,x,y,w,z,'#b28b56','#65513a',3);woodLines(ctx,x,y,w,z);for(const xx of[x+9,x+w-18])rounded(ctx,xx,y+z-4,10,12,2,'#705239');
  rounded(ctx,x+11,y+10,34,22,2,'#506968');line(ctx,x+13,y+12,x+41,y+12,'#b6c5b8',4);line(ctx,x+25,y+18,x+25,y+36,'#a8b7ab',3);
  const xx=x+w*.58;line(ctx,xx,y+14,xx+18,y+z-12,'#d9d7bd',5);ellipse(ctx,xx,y+13,6,6,'#b8c7bd');ellipse(ctx,xx,y+13,3,3,'#775b3b');line(ctx,x+w-34,y+13,x+w-18,y+z-13,'#29494c',4);line(ctx,x+w-22,y+13,x+w-30,y+z-13,'#cd6758',4);
 }else if(f.kind==='engine'){
  panel(ctx,x,y,w,z,'#596f70','#253d42',6);for(let n=0;n<4;n++)panel(ctx,x+8+n*(w-15)/4,y+10,(w-22)/4,z-23,'#a5b4ad','#3a555a',3);line(ctx,x+5,y+z-5,x+w-7,y+z-5,'#ca9c67',5);ellipse(ctx,x+w-12,y+12,7,7,'#273e45');ellipse(ctx,x+w-12,y+12,3,3,'#839b96');
 }else if(f.kind==='hull'){
  polygon(ctx,[[x+w/2,y-5],[x+w-1,y+z*.3],[x+w-9,y+z],[x+9,y+z],[x+1,y+z*.3]],'#c3a36d');polygon(ctx,[[x+w/2,y+11],[x+w-11,y+z*.32],[x+w-18,y+z-12],[x+18,y+z-12],[x+11,y+z*.32]],'#6c5239');
  for(let yy=y+z*.35;yy<y+z-12;yy+=27){line(ctx,x+15,yy,x+w-15,yy,'#c2a170',7);line(ctx,x+16,yy-2,x+w-16,yy-2,'#ead7a1',1,.6);}line(ctx,x+w*.5,y+13,x+w*.5,y+z-10,'#433f32',2);for(const yy of[y+z*.35,y+z*.8])line(ctx,x-7,yy,x+w+7,yy,'#647676',3,.7);
 }else{
  // Dining and bedside tables have chairs, a tabletop, crockery and papers.
  for(const xx of[x+5,x+w-23]){rounded(ctx,xx,y-6,18,18,4,'#6b795f');rounded(ctx,xx,y+z-12,18,20,4,'#6b795f');}
  panel(ctx,x+5,y+6,w-10,z-12,'#b08d5c','#6b553b',6);woodLines(ctx,x+6,y+7,w-12,z-14);
  ellipse(ctx,x+w*.31,y+z*.48,10,8,'#e5e1c9');ellipse(ctx,x+w*.31,y+z*.48,6,5,'#b9bcaa');rounded(ctx,x+w*.57,y+z*.33,15,19,1,'#c7c9b3');line(ctx,x+w*.59,y+z*.4,x+w*.72,y+z*.4,'#6a7e75',1);ellipse(ctx,x+w*.77,y+z*.7,5,4,'#e4dabb');ellipse(ctx,x+w*.77,y+z*.7,3,2,'#66523e');
 }
 if(f.slot!==undefined&&!checked){const nearby=dist(player,nearestPoint(player,f))<70;ctx.save();ctx.globalAlpha=nearby?.7:.12;ctx.strokeStyle=palette.window;ctx.lineWidth=nearby?2:1;ctx.strokeRect(x-4,y-4,w+8,z+8);ctx.restore();}
}
function characterArt(c,p,isJason=false,preview=false){
 const s=skinFor(p.role|| (isJason?'jason':'mechanic'),p.skin),x=p.x,y=p.y,moving=p.moving,stride=moving?Math.sin(p.walk||0)*4:0,bob=moving?Math.abs(Math.cos(p.walk||0))*.8:0,scale=isJason?s.scale:.96;
 ellipse(c,x+2,y+3,isJason?20:16,6,'night',.55);c.save();c.translate(x,y-bob);c.scale(scale,scale);
 const coat=s.coat,trim=s.trim,pants=s.pants,skin=s.skin||'#ae9477';
 if(!isJason){rounded(c,-18,-36,36,27,7,'#344a46');line(c,-15,-31,-15,-13,trim,2,.4);}
 for(const [xx,st]of[[-10,-stride],[2,stride]]){rounded(c,xx,-19+st,9,21,3,pants);line(c,xx+3,-16+st,xx+3,-4+st,trim,1,.18);rounded(c,xx-2,-2+st,13,7,2,isJason?'#242b2b':'#2e3937');line(c,xx-1,2+st,xx+10,2+st,'#8c9987',1,.4);}
 panel(c,-14,-39,29,28,coat,'#293733',6);line(c,0,-35,0,-12,trim,1,.65);polygon(c,[[-12,-38],[-2,-34],[-6,-29]],trim);polygon(c,[[12,-38],[2,-34],[6,-29]],trim);
 for(const xx of[-10,5]){rounded(c,xx,-25,6,7,1,trim);line(c,xx,-23,xx+6,-23,'#263732',1,.6);}
 if(s.style==='varsity'){c.font='bold 11px sans-serif';c.fillStyle=trim;c.fillText('C',4,-23);}if(s.style==='medic'){line(c,6,-33,6,-22,'#a64d47',3);line(c,2,-28,10,-28,'#a64d47',3);}
 if(isJason&&s.face==='metal'){for(const xx of[-12,3]){panel(c,xx,-35,10,14,'#c4d1ce','#435d65',2);line(c,xx+2,-31,xx+8,-31,'#729ba0',2);}panel(c,-12,-19,24,7,'#657e83','#283e46',2);for(const xx of[-13,5])panel(c,xx,-15,8,12,'#81999a','#304950',2);}
 if(isJason&&s.face==='sack'){polygon(c,[[-9,-34],[9,-34],[10,-13],[-10,-13]],'#344958');line(c,-8,-30,8,-30,'#8b9b9b',2);}
 if(isJason&&s.face==='undead'){for(let i=0;i<7;i++)ellipse(c,-11+i*3.7,-33+Math.sin(i*.55)*4,2.4,3,'#a7b1a0');polygon(c,[[-14,-13],[-10,-9],[-6,-13],[-2,-8],[3,-12],[8,-8],[15,-13]],coat);}
 for(const side of[-1,1]){c.save();c.translate(side*13,-33);const phase=isJason&&p.swing>0?1-p.swing/.45:0;c.rotate(side>0&&phase?-1.6+phase*3.5:side*stride*.04);const sleeve=s.style==='varsity'?trim:coat;rounded(c,side<0?-7:0,-2,9,22,4,sleeve);line(c,side<0?-5:2,3,side<0?-5:2,15,trim,1,.35);ellipse(c,side<0?-2:4,21,4,4,skin);
  if(isJason&&side>0){c.translate(4,21);c.rotate(-.5);rounded(c,-2,-1,5,10,1,'#634e38');polygon(c,[[-2,8],[5,8],[6,34],[1,40],[-2,35]],'#6d858a');polygon(c,[[0,9],[4,9],[4,33],[1,37]],s.face==='metal'?'#e4efea':'#c6d4cf');line(c,0,9,0,32,'#f4edce',1,.8);}
  c.restore();}
 ellipse(c,0,-47,12,14,'#222c2b');
 if(isJason){
  if(s.face==='sack'){polygon(c,[[-12,-61],[-5,-65],[10,-62],[14,-41],[7,-33],[-9,-34],[-14,-42]],s.mask);line(c,-9,-60,-6,-39,'#eee0b8',1,.45);line(c,8,-58,9,-40,'#79684c',1,.6);ellipse(c,5,-49,3.5,4.2,'#242b27');line(c,-10,-35,10,-35,'#947448',3);line(c,6,-34,13,-27,'#b29a6b',2);}
  else if(s.face==='young'){rounded(c,-11,-60,22,26,8,s.mask);ellipse(c,-8,-49,5,8,'#ae8b6a');polygon(c,[[-11,-52],[-11,-59],[-5,-63],[4,-61],[10,-55],[5,-57],[-2,-58],[-5,-52]],'#594934');ellipse(c,-5,-47,2,1.7,'#292c28');ellipse(c,5,-48,1.3,1.4,'#292c28');line(c,-3,-39,4,-40,'#725c43',1.5);}
  else if(s.face==='metal'){polygon(c,[[-11,-61],[8,-62],[14,-54],[10,-37],[2,-32],[-9,-38],[-14,-52]],s.mask);polygon(c,[[-9,-55],[-2,-52],[-2,-47],[-9,-49]],'#bc4c45');polygon(c,[[9,-55],[2,-52],[2,-47],[9,-49]],'#bc4c45');line(c,0,-57,0,-41,'#58737a',2);line(c,-7,-40,7,-40,'#354e57',2);for(const xx of[-7,0,7])line(c,xx,-37,xx,-34,'#435c61',1);}
  else{rounded(c,-11,-61,22,28,9,s.mask);ellipse(c,-5,-49,3.7,2.7,'#1b2726');ellipse(c,5,-49,3.7,2.7,'#1b2726');polygon(c,[[-5,-57],[5,-57],[0,-52]],'#a74e43');for(const side of[-1,1])polygon(c,[[side*9,-43],[side*4,-40],[side*8,-37]],'#a75b49');for(const[xx,yy]of[[-7,-54],[7,-54],[0,-45],[-2,-40],[2,-40],[-3,-36],[3,-36]])ellipse(c,xx,yy,1,1,'#4b5449');line(c,-10,-50,-14,-50,'#62634d',3);line(c,10,-50,14,-50,'#62634d',3);if(s.face==='undead'){line(c,4,-60,1,-52,'#455445',2);line(c,1,-52,6,-44,'#455445',1.5);line(c,6,-44,3,-35,'#455445',1.5);}}
 }else{
  if(s.style==='hood'){rounded(c,-14,-62,28,33,12,coat);rounded(c,-10,-56,20,24,9,'#596346');}
  else if(s.style==='longhair')rounded(c,-13,-62,26,35,10,s.hair);
  rounded(c,-9,-56,18,23,7,skin);ellipse(c,-4,-45,1.1,1.2,'#26302c');ellipse(c,4,-45,1.1,1.2,'#26302c');line(c,-2,-38,3,-38,'#996b54',1,.7);
  if(s.style!=='hood'){polygon(c,[[-11,-48],[-10,-58],[-5,-63],[6,-61],[11,-54],[8,-49],[5,-54],[-5,-53],[-8,-46]],s.hair);if(s.style==='longhair'){rounded(c,7,-54,6,24,3,s.hair);line(c,9,-51,9,-34,'#ba8359',1,.45);}if(s.style==='varsity'){rounded(c,-11,-62,24,10,4,coat);rounded(c,0,-55,18,4,2,trim);}if(s.style==='ranger'){rounded(c,-10,-64,20,10,4,'#9c9975');ellipse(c,0,-54,19,4,'#9c9975');line(c,-10,-57,10,-57,'#4d6451',3);}}
  if(s.style==='longhair'){polygon(c,[[-11,-35],[11,-35],[6,-30],[-7,-30]],'#a45e5b');line(c,-6,-32,-7,-22,'#c17f70',4);}if(s.style==='hood')line(c,-2,-32,-2,-18,trim,1);
 }
 c.restore();
 if(!preview&&isJason&&p.swing>0){const phase=1-p.swing/.45,a=Math.atan2(p.fy,p.fx);c.save();c.globalAlpha=Math.sin(phase*Math.PI)*.6;c.strokeStyle=palette.steel;c.lineWidth=5;c.beginPath();c.arc(x,y-16,49,a-1.7+phase*2.6,a-1+phase*2.6);c.stroke();c.restore();}
}
function artPerson(p,isJason=false){characterArt(ctx,p,isJason);}

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
 if(p.id===0){drawVan(p);}
 else if(p.id===1){drawEscapeBoat(p);}
 else{line(ctx,p.x,p.y,p.x,p.y-145,'steel',4);for(let y=p.y-140;y<p.y;y+=23){line(ctx,p.x-20,y,p.x+20,y+23,'roadLine',2);line(ctx,p.x+20,y,p.x-20,y+23,'roadLine',2);}line(ctx,p.x-20,p.y,p.x,p.y-145,'steel',2);line(ctx,p.x+20,p.y,p.x,p.y-145,'steel',2);ellipse(ctx,p.x,p.y-148,4,4,p.ready?'red':'window');rounded(ctx,p.x-24,p.y-23,48,32,4,'roofLight');rounded(ctx,p.x-18,p.y-18,36,17,2,'night');for(let i=0;i<4;i++)line(ctx,p.x-13+i*8,p.y-14,p.x-13+i*8,p.y-5,'window',2,p.ready?1:.4);}
 ctx.font=fonts.medium;ctx.fillStyle=p.ready?palette.red:palette.dim;ctx.textAlign='center';const labelX=p.x+(p.id===1?57:0),labelY=p.y+(p.id===1?153:p.id===0?21:33);ctx.fillText(p.name.toUpperCase(),labelX,labelY);
 if(!p.departed){rounded(ctx,labelX-35,labelY+11,70,4,2,'night');if(p.progress>.01)rounded(ctx,labelX-35,labelY+11,70*p.progress,4,1,'window');}
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
function drawObjectLabel(){if(scene<0||!canControl()||currentContext())return;const point=aimPoint?{x:(aimPoint.x-W/2)/zoom+camera.x,y:(aimPoint.y-H/2)/zoom+camera.y}:null;let f=point?furniture.find(f=>within(point,f)&&dist(player,nearestPoint(player,f))<240):null;if(!f)f=furniture.filter(f=>dist(player,nearestPoint(player,f))<66).sort((a,b)=>dist(player,nearestPoint(player,a))-dist(player,nearestPoint(player,b)))[0];if(!f)return;const p=screenPoint({x:f.x+f.w/2,y:f.y-33}),text=f.name+(hideable(f)?' · укрытие':''),width=Math.min(W-24,ctx.measureText(text).width+22),xx=clamp(p.x-width/2,12,W-width-12),yy=clamp(p.y,52,H-40);ctx.save();ctx.font=fonts.normal;rounded(ctx,xx,yy,width,25,5,'#132626');ctx.fillStyle=palette.paper;ctx.textAlign='center';ctx.fillText(text,xx+width/2,yy+17);ctx.restore();}
function draw(){if(!view||!terrain)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle=palette.night;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W/2-camera.x*zoom,H/2-camera.y*zoom);ctx.scale(zoom,zoom);ctx.drawImage(scene<0?terrain:roomFloor,0,0);drawGroundShadows();const inView=p=>Math.abs(p.x-camera.x)<W/(2*zoom)+180&&Math.abs(p.y-camera.y)<H/(2*zoom)+200;const layers=[];
 if(scene<0){for(const h of houses)if(inView({x:h.x+120,y:h.y+90})){layers.push({y:h.y+155,fn:()=>{drawHouse(h);ctx.font=fonts.normal;ctx.fillStyle=palette.dim;ctx.textAlign='center';ctx.fillText(h.name,h.x+120,h.y+210);if(h.barricade){line(ctx,h.x+97,h.y+107,h.x+144,h.y+148,'wood',7);line(ctx,h.x+97,h.y+145,h.x+144,h.y+107,'wood',7);}}});const p=fuseBox(h);layers.push({y:p.y,fn:()=>drawFuse(h)});}for(const t of trees)if(inView(t))layers.push({y:t.y,fn:()=>drawTree(t)});for(const l of lamps)if(inView(l))layers.push({y:l.y,fn:()=>drawLamp(l)});for(const p of view.projects)if(inView(p))layers.push({y:p.y-10,fn:()=>drawProject(p)});for(const d of map.decor)if(inView(d))layers.push({y:d.y,fn:()=>drawDecor(d)});
 }else{for(const f of furniture)layers.push({y:f.y+f.h,fn:()=>drawFurniture(f)});for(const p of map.partitions[scene])layers.push({y:p.y+p.h,fn:()=>rounded(ctx,p.x,p.y,p.w,p.h,2,'roofLight')});}
 for(const i of view.items)layers.push({y:i.y,fn:()=>drawItem(i)});for(const n of drawActors.values())if(n.scene===scene)layers.push({y:n.y,fn:()=>drawPerson(n,n.role==='jason')});if(!player.hidden)layers.push({y:player.y,fn:()=>drawPerson(player,killer())});layers.sort((a,b)=>a.y-b.y);for(const l of layers)l.fn();
 for(const t of view.traps){ctx.save();ctx.strokeStyle=palette.steel;ctx.lineWidth=t.owner==='jason'?2:1;ctx.beginPath();ctx.ellipse(t.x,t.y,t.owner==='jason'?12:25,5,0,0,Math.PI*2);ctx.stroke();if(t.owner==='jason')for(let i=-2;i<=2;i++)line(ctx,t.x+i*5,t.y-4,t.x+i*5+2,t.y+3,'steel',1);else line(ctx,t.x-28,t.y-2,t.x+28,t.y+2,'warm',1);ctx.restore();}
 for(const s of view.sounds)if(view.me.sense>0&&s.scene===scene){const age=clamp(gameTime()-s.t,0,4);ctx.save();ctx.globalAlpha=(1-age/4)*.35;ctx.strokeStyle=palette.window;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(s.x,s.y,25+age*14,13+age*7,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 for(const e of view.effects){const age=gameTime()-e.t;if(age<.35)line(ctx,e.x,e.y,e.tx,e.ty,e.type==='rifle'?'window':e.type==='flare'?'red':'steel',e.type==='flare'?5:2,Math.max(0,1-age/.35));}
 
 if(localPath.length){const p=localPath[localPath.length-1];ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=palette.paper;ctx.beginPath();ctx.ellipse(p.x,p.y,9,4,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if(scene<0&&!motionOff){for(const p of puddles)if(inView(p)){const r=2+(elapsed*11+p.x)%23;ctx.save();ctx.globalAlpha=(1-r/25)*.13;ctx.strokeStyle=palette.steel;ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}}ctx.restore();drawFog();
 if(scene<0&&!motionOff){ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle=palette.steel;ctx.lineWidth=.8;for(let i=0;i<W/15;i++){const x=(i*79.3+elapsed*43)%(W+40)-20,y=(i*107.1+elapsed*320)%(H+40)-20;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+12);ctx.stroke();}ctx.restore();}miniMap(mapOpen);if(!mapOpen)drawObjectLabel();drawInteractionMarks();drawSkill();drawFeedback();root.dataset.state=state;root.dataset.role=player.role;root.dataset.scene=String(scene);
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
document.addEventListener('keydown',e=>{if(!$('[data-appearance-sheet]').hidden){if(e.code==='Escape'){e.preventDefault();closeAppearance();}if(e.code==='Tab'){const buttons=[$('[data-close-appearance]'),...root.querySelectorAll('[data-skin-pick]'),$('[data-cancel-appearance]'),$('[data-apply-appearance]')],index=buttons.indexOf(document.activeElement),next=(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length;e.preventDefault();buttons[next].focus();}return;}if(e.altKey||e.ctrlKey||e.metaKey||e.target?.matches?.('input,select,textarea')||!view||room.phase!=='playing')return;if(!$('[data-help-sheet]').hidden)return;if(!canControl()){if(e.code==='KeyM'&&isSpectating()){e.preventDefault();mapOpen=!mapOpen;}if(isSpectating()&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){e.preventDefault();if(!e.repeat)watchSurvivor(e.code==='ArrowLeft'?-1:1);}return;}if(dir[e.code]){e.preventDefault();if(e.repeat&&(pendingInteraction||view.me.task))return;keys.add(dir[e.code]);pump(true);return;}if(e.repeat)return;const actions={KeyE:'interact',KeyQ:'sense',KeyC:'crouch',KeyT:'trap',KeyF:'knife',KeyV:'dash',KeyB:'block',KeyR:'fury',KeyG:'drop',KeyL:'flashlight'};if(e.code==='Space'){e.preventDefault();if(view.me.repair?.check)check();else sendAction('attack');}else if(actions[e.code]){e.preventDefault();sendAction(actions[e.code]);}else if(e.code==='KeyM'){e.preventDefault();mapOpen=!mapOpen;}else if(e.code==='Escape'){e.preventDefault();keys.clear();runToggle=false;$('[data-help-sheet]').hidden=false;pump(true);}});
document.addEventListener('keyup',e=>{if(dir[e.code]){e.preventDefault();keys.delete(dir[e.code]);pump(true);}});
for(const[selector,handler]of[['[data-watch]',()=>watchSurvivor()],['[data-spectator-prev]',()=>watchSurvivor(-1)],['[data-spectator-next]',()=>watchSurvivor(1)],['[data-stop-watching]',()=>operation('spectate',{watch:false})],['[data-death-leave]',leave]])$(selector).onclick=handler;$('[data-spectator-select]').onchange=e=>operation('spectate',{watch:true,targetId:e.target.value});
$('[data-open-appearance]').onclick=openAppearance;$('[data-close-appearance]').onclick=closeAppearance;$('[data-cancel-appearance]').onclick=closeAppearance;$('[data-apply-appearance]').onclick=applyAppearance;$('[data-bot-count]').onchange=e=>operation('settings',{botCount:Number(e.target.value)});
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
