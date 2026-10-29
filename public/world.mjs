export const WORLD={w:2200,h:1500},ROOM={w:760,h:560};
export const CLASSES=['jason','mechanic','scout','guard','medic'];
export const ROLE_NAMES={jason:'Джейсон',mechanic:'Механик',scout:'Разведчик',guard:'Охранник',medic:'Медик'};
export const ITEM_NAMES={battery:'Аккумулятор',fuel:'Бензин',keys:'Ключи',propeller:'Винт',rope:'Трос',fuse:'Предохранитель',radio:'Радиодетали',weapon:'Оружие',medkit:'Аптечка'};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function within(p,r,m=0){return p.x>=r.x-m&&p.x<=r.x+r.w+m&&p.y>=r.y-m&&p.y<=r.y+r.h+m;}
export function nearPoint(p,r){return{x:clamp(p.x,r.x,r.x+r.w),y:clamp(p.y,r.y,r.y+r.h)};}
export function door(h){return{x:h.x+120,y:h.y+180,scene:-1};}
export function windowPoint(h,id=0){const w=h.windows?.find(w=>w.id===id);return w?{x:h.x+w.offset,y:h.y+180,scene:-1}:null;}
export function windowInside(w){return{x:w.id===0?122:590,y:65};}
export function houseWindows(id){if([1,7].includes(id))return[];return(id===2?[0]:[0,1]).map(n=>({id:n,offset:n===0?40:204,state:id===2?'barred':(id+n)%3===0?'closed':'open'}));}
export const hideable=f=>f.slot!==undefined&&['wardrobe','bed'].includes(f.kind);
export function fuseBox(h){return{x:h.x+275,y:h.y+140,scene:-1};}
const cabins=[['Дом лесника','cabin',100,175],['Гараж у просеки','workshop',450,1160],['Радиостанция на холме','radio',1740,50],['Столовая лагеря','diner',1060,580],['Охотничий домик','cabin',1800,965],['Медпункт','clinic',1250,175],['Старый пансион','cabin',960,1060],['Склад у кладбища','store',145,1050],['Эллинг','boathouse',1900,1225]];
const rect=(x,y,w,h,kind,name,slot)=>({x,y,w,h,kind,name,...(slot===undefined?{}:{slot})});
const cabinet=(x=450,y=57,slot=1)=>rect(x,y,110,43,'wardrobe','Шкаф',slot);
export const PARTITIONS=[rect(373,40,17,250,'wall'),rect(373,394,17,60,'wall')];
function interiors(){return[
 [cabinet(230,57,0),cabinet(),rect(80,170,133,77,'bed','Кровать',2),rect(579,393,102,57,'chest','Сундук',3),rect(515,170,145,80,'bed'),rect(89,388,157,54,'sofa'),rect(265,264,75,58,'table'),rect(544,287,67,52,'table')],
 [cabinet(70,57,0),cabinet(565,57,1),rect(75,165,230,65,'workbench'),rect(500,175,165,60,'rack'),rect(85,370,115,85,'crate','Ящик',3),rect(475,355,190,72,'workbench'),rect(310,255,94,75,'engine')],
 [cabinet(570,57,0),rect(75,100,240,65,'radio'),rect(75,230,75,125,'rack'),rect(550,220,110,115,'rack'),rect(270,285,120,65,'table'),rect(530,405,120,52,'chest','Кейс',3)],
 [cabinet(580,57,0),rect(65,90,280,62,'counter'),rect(70,250,115,65,'table'),rect(255,250,100,65,'table'),rect(470,230,145,70,'table'),rect(470,390,160,58,'sofa'),rect(85,415,125,45,'sink')],
 [cabinet(235,57,0),cabinet(),rect(80,190,130,80,'bed','Кровать',2),rect(535,185,130,80,'bed'),rect(85,390,160,60,'sofa'),rect(500,395,145,48,'chest','Сундук',3),rect(280,280,70,60,'table')],
 [cabinet(235,57,0),rect(520,57,145,45,'medicine'),rect(80,170,125,75,'bed','Койка',2),rect(510,170,125,75,'bed'),rect(80,355,125,75,'bed'),rect(510,355,125,75,'bed'),rect(265,410,70,50,'sink')],
 [cabinet(65,57,0),cabinet(560,57,1),rect(70,190,150,65,'sofa'),rect(285,200,105,70,'table'),rect(535,290,120,85,'bed','Кровать',2),rect(90,395,180,55,'shelf'),rect(560,430,100,44,'chest','Чемодан',3)],
 [cabinet(560,57,0),rect(75,75,195,60,'rack'),rect(75,205,195,62,'rack'),rect(75,350,150,75,'crate','Ящик',3),rect(480,190,170,70,'rack'),rect(500,345,155,72,'rack'),rect(325,265,80,70,'crate')],
 [cabinet(70,57,0),rect(470,70,190,55,'workbench'),rect(85,235,120,185,'hull'),rect(485,245,175,58,'rack'),rect(510,405,135,48,'chest','Ящик',3),rect(275,165,105,60,'workbench')]
 ];}
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return dist(p,{x:a.x+dx*t,y:a.y+dy*t});}
const maps=new Map();
export function createWorld(seed){
 if(maps.has(seed))return maps.get(seed);const random=rng(seed),houses=cabins.map(([name,kind,x,y],id)=>({id,name,tag:String(id+1).padStart(2,'0'),kind,x,y,w:240,h:155,windows:houseWindows(id)})),layouts=interiors();
 const partitions=[PARTITIONS,[],[rect(397,40,16,155,'wall')],[rect(385,40,15,135,'wall')],PARTITIONS,[rect(370,40,17,240,'wall')],[rect(445,210,16,250,'wall')],[],[rect(405,330,16,125,'wall')]];
 const paths=[[[25,450],[480,450],[766,450],[1010,420],[1350,355],[1775,300],[2100,415]],[[20,940],[490,940],[766,940],[1130,875],[1530,925],[2050,1020]],[[80,1430],[766,1430],[1120,1370],[1550,1420],[2040,1430]],[[505,450],[565,580],[555,790],[490,940]],[[1010,420],[995,650],[1130,875],[1120,1370]],[[1775,300],[1630,555],[1530,925],[1550,1420]]].map((points,id)=>({id,width:id<3?64:34,points:points.map(([x,y])=>({x,y}))}));
 for(const h of houses){const p=door(h);let nearest=null,score=Infinity;for(const path of paths.slice(0,3))for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1),q={x:a.x+dx*t,y:a.y+dy*t};if(dist(p,q)<score){score=dist(p,q);nearest=q;}}paths.push({id:'drive'+h.id,width:27,points:dist(p,nearest)<70?[p,nearest]:[p,{x:p.x,y:p.y+35},nearest]});}
 const solids=houses.map(h=>({x:h.x-2,y:h.y-12,w:244,h:172,kind:'house'}));for(const h of houses){const p=fuseBox(h);solids.push({x:p.x-9,y:p.y-15,w:18,h:25,kind:'utility'});}
 solids.push({x:2130,y:320,w:70,h:690,kind:'water'},{x:461,y:865,w:58,h:58,kind:'car'});
 for(const[y,h]of [[20,390],[490,410],[980,410]])solids.push({x:750,y,w:32,h,kind:'water'});
 const trees=[],specks=[],lamps=[],decor=[];
 for(let i=0;i<330;i++){const t={x:40+random()*2070,y:45+random()*1400,size:.75+random()*.65,type:i%5===0?'oak':'pine'};const road=paths.some(p=>p.points.some((b,j)=>j&&segmentDistance(t,p.points[j-1],b)<p.width/2+30))||Math.abs(t.x-766)<55;const yard=houses.some(h=>within(t,{x:h.x-40,y:h.y-65,w:340,h:310})),project=[{x:490,y:940},{x:2080,y:1020},{x:1880,y:300},{x:570,y:580}].some(p=>dist(p,t)<110);if(!road&&!yard&&!project){trees.push(t);solids.push({x:t.x-9,y:t.y-8,w:18,h:16,kind:'tree'});}}
 for(let i=0;i<1800;i++)specks.push({x:random()*WORLD.w,y:random()*WORLD.h,n:random()});
 for(const p of paths.slice(0,3))for(let i=0;i<p.points.length;i+=2)lamps.push({x:p.points[i].x+28,y:p.points[i].y-44});
 for(let i=0;i<8;i++){const d={kind:'grave',x:52+(i%2)*40,y:1000+Math.floor(i/2)*45};decor.push(d);solids.push({x:d.x-9,y:d.y-9,w:18,h:15,kind:'grave'});}
 for(const p of[{x:450,y:570},{x:635,y:650},{x:675,y:545}]){decor.push({...p,kind:'tent'});solids.push({x:p.x-25,y:p.y-25,w:50,h:30,kind:'tent'});}
 decor.push({kind:'fire',x:570,y:580},{kind:'bus',x:1290,y:805},{kind:'sign',x:975,y:405,label:'ЛАГЕРЬ'},{kind:'sign',x:1510,y:920,label:'К ПРИЧАЛУ'},{kind:'well',x:920,y:1100},{kind:'logs',x:450,y:1080},{kind:'bench',x:1560,y:630},{kind:'boat',x:2020,y:1180});
 solids.push({x:1252,y:750,w:76,h:105,kind:'bus'},{x:900,y:1082,w:40,h:36,kind:'well'},{x:420,y:1060,w:65,h:34,kind:'logs'},{x:1530,y:620,w:65,h:20,kind:'bench'});
 const roomSolids=layouts.map((f,id)=>[...f,...partitions[id]]);
 const occluders=solids.filter(o=>!['tree','water','utility'].includes(o.kind)).map(o=>({...o}));for(const t of trees)occluders.push({x:t.x-25*t.size,y:t.y-49*t.size,w:50*t.size,h:52*t.size,cx:t.x,cy:t.y-23*t.size,rx:25*t.size,ry:26*t.size,kind:'ellipse'});
 const map={seed,houses,layouts,partitions,roomSolids,solids,occluders,trees,specks,lamps,decor,paths,grids:new Map(),spatial:new Map()};maps.set(seed,map);if(maps.size>16)maps.delete(maps.keys().next().value);
 map.lootSpots=[];for(let scene=0;scene<9;scene++)for(const p of[{x:286,y:343},{x:465,y:130},{x:650,y:337},{x:310,y:470},{x:590,y:125},{x:240,y:185}]){const free=freePoint(map,p,scene);if(!map.lootSpots.some(q=>q.scene===scene&&dist(q,free)<45))map.lootSpots.push({...free,scene});}
 for(const path of paths.slice(0,3))for(const p of path.points){for(const side of[-1,1]){const q=freePoint(map,{x:p.x+side*55,y:p.y+side*75},-1);if(q.x>50&&q.x<2100)map.lootSpots.push({...q,scene:-1});}}
 return map;
}
export function obstacles(map,scene){return scene<0?map.solids:map.roomSolids[scene];}
export function lightObstacles(map,scene){return scene<0?map.occluders:map.roomSolids[scene];}
function nearbySolids(map,scene,x,y,w,h){let index=map.spatial.get(scene);const cell=128;if(!index){index=new Map();for(const o of obstacles(map,scene))for(let yy=Math.floor(o.y/cell);yy<=Math.floor((o.y+o.h)/cell);yy++)for(let xx=Math.floor(o.x/cell);xx<=Math.floor((o.x+o.w)/cell);xx++){const key=xx+','+yy;if(!index.has(key))index.set(key,[]);index.get(key).push(o);}map.spatial.set(scene,index);}const x1=Math.floor(x/cell),x2=Math.floor((x+w)/cell),y1=Math.floor(y/cell),y2=Math.floor((y+h)/cell);if(x1===x2&&y1===y2)return index.get(x1+','+y1)||[];const found=new Set();for(let yy=y1;yy<=y2;yy++)for(let xx=x1;xx<=x2;xx++)for(const o of index.get(xx+','+yy)||[])found.add(o);return found;}
export function blocked(map,x,y,r=11,scene=-1){const s=scene<0?WORLD:ROOM,e=scene<0?20:36;if(x<e+r||y<e+r||x>s.w-e-r||y>s.h-e-r)return true;for(const o of nearbySolids(map,scene,x-r,y-r,r*2,r*2))if(x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)return true;return false;}
export function freePoint(map,p,scene=-1){if(!blocked(map,p.x,p.y,12,scene))return{x:p.x,y:p.y};for(let r=20;r<240;r+=20)for(let i=0;i<16;i++){const x=p.x+Math.cos(i*Math.PI/8)*r,y=p.y+Math.sin(i*Math.PI/8)*r;if(!blocked(map,x,y,12,scene))return{x,y};}return{x:380,y:485};}
export function move(map,a,vx,vy,dt){if(!blocked(map,a.x+vx*dt,a.y,10,a.scene))a.x+=vx*dt;if(!blocked(map,a.x,a.y+vy*dt,10,a.scene))a.y+=vy*dt;}
// Both prediction and authority integrate the same bounded movement commands.
export function motionStep(map,a,c){
 const dt=clamp(Number(c.dt)||0,0,.05),dx=clamp(Number(c.dx)||0,-1,1),dy=clamp(Number(c.dy)||0,-1,1),length=Math.hypot(dx,dy),killer=a.role==='jason';
 const lx=Number(c.lx),ly=Number(c.ly),look=Math.hypot(lx,ly);if(Number.isFinite(look)&&look>.1){a.lx=lx/look;a.ly=ly/look;}
 a.moving=false;if(a.dead||a.escaped||a.hidden||a.stun>0||a.boarded!=null)return;
 if(length>0){a.task=null;a.repair=null;if(!c.keepNav){a.nav=[];a.goal=null;}}
 const run=length>0&&c.run&&!a.crouch&&!a.exhausted&&a.stamina>.02;
 a.recoverDelay=Math.max(0,(a.recoverDelay||0)-dt);
 if(run){a.stamina=Math.max(0,a.stamina-dt*(killer?.45:.23));a.recoverDelay=killer?1.5:.65;if(a.stamina<.025)a.exhausted=true;}
 else if(a.recoverDelay<=0){a.stamina=Math.min(1,a.stamina+dt*(killer?.10:.16));if(a.stamina>.3)a.exhausted=false;}
 if(length>0&&!a.task&&!a.repair){a.fx=dx/length;a.fy=dy/length;let speed=a.crouch?72:run?(killer?148:160):(killer?107:108);if(!killer&&a.hp===1)speed*=.87;if(a.swing>0||a.block>0)speed*=.65;if(a.fury>0)speed*=1.17;move(map,a,a.fx*speed,a.fy*speed,dt);a.moving=true;a.walk+=dt*(run?14:9);}
}
export function clearLine(map,a,b,scene=a.scene){if(a.scene!==undefined&&b.scene!==undefined&&a.scene!==b.scene)return false;const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)+Math.abs(dy)<.01)return true;for(const o of nearbySolids(map,scene,Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(dx),Math.abs(dy))){if(o.kind==='water')continue;const tx1=(o.x-a.x)/(dx||1e-10),tx2=(o.x+o.w-a.x)/(dx||1e-10),ty1=(o.y-a.y)/(dy||1e-10),ty2=(o.y+o.h-a.y)/(dy||1e-10),lo=Math.max(Math.min(tx1,tx2),Math.min(ty1,ty2)),hi=Math.min(Math.max(tx1,tx2),Math.max(ty1,ty2));if(hi>=lo&&hi>.001&&lo<.999)return false;}return true;}
export function route(map,goal,a,scene=a.scene){
 const cell=28,size=scene<0?WORLD:ROOM,cols=Math.ceil(size.w/cell),rows=Math.ceil(size.h/cell);let grid=map.grids.get(scene);
 if(!grid){grid=new Uint8Array(cols*rows);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)grid[y*cols+x]=blocked(map,x*cell+14,y*cell+14,12,scene)?0:1;map.grids.set(scene,grid);}
 const free=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&grid[y*cols+x];
 const near=p=>{const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);for(let r=0;r<7;r++){let best=null,b=Infinity;for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(free(x,y)){const d=Math.hypot(x*cell+14-p.x,y*cell+14-p.y);if(d<b){b=d;best={x,y};}}if(best)return best;}return null;};
 const from=near(a),to=near(goal);if(!from||!to)return[];const start=from.y*cols+from.x,end=to.y*cols+to.x,g=new Float64Array(cols*rows),parents=new Int32Array(cols*rows),closed=new Uint8Array(cols*rows),heap=[];g.fill(Infinity);g[start]=0;parents.fill(-1);
 const push=(k,f)=>{let i=heap.length;heap.push({k,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={k,f};};const pop=()=>{const v=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return v.k;};push(start,0);let count=0;
 while(heap.length&&count++<8000){const k=pop();if(closed[k])continue;if(k===end){const pts=[];for(let cur=k;cur!==start&&cur>=0;cur=parents[cur])pts.push({x:cur%cols*cell+14,y:Math.floor(cur/cols)*cell+14});return pts.reverse();}closed[k]=1;const x=k%cols,y=Math.floor(k/cols);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,nk=ny*cols+nx;if(!free(nx,ny)||closed[nk]||(dx&&dy&&(!free(x+dx,y)||!free(x,y+dy))))continue;const cost=g[k]+(dx&&dy?1.414:1);if(cost<g[nk]){g[nk]=cost;parents[nk]=k;push(nk,cost+Math.hypot(nx-to.x,ny-to.y));}}}return[];
}
