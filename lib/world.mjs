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
const names=['Дом лесника','Мастерская','Радиорубка','Столовая','Дом у озера','Медпункт','Коттедж','Склад','Эллинг'];
const kinds=['cabin','workshop','radio','diner','cabin','clinic','cabin','store','boathouse'];
const BASE=[{x:230,y:57,w:104,h:43,kind:'wardrobe',name:'Шкаф',slot:0},{x:450,y:57,w:110,h:43,kind:'wardrobe',name:'Шкаф',slot:1},{x:80,y:170,w:133,h:77,kind:'bed',name:'Кровать',slot:2},{x:579,y:393,w:102,h:57,kind:'chest',name:'Сундук',slot:3},{x:515,y:170,w:145,h:80,kind:'bed'},{x:89,y:388,w:157,h:54,kind:'sofa'},{x:265,y:264,w:75,h:58,kind:'table'},{x:544,y:287,w:67,h:52,kind:'table'}];
export const PARTITIONS=[{x:373,y:40,w:17,h:250},{x:373,y:394,w:17,h:60}];
const maps=new Map();
export function createWorld(seed){
 if(maps.has(seed))return maps.get(seed);const random=rng(seed),houses=names.map((name,id)=>({id,name,tag:String(id+1).padStart(2,'0'),kind:kinds[id],x:160+(id%3)*710,y:120+Math.floor(id/3)*490,w:240,h:155,windows:houseWindows(id)}));
 const layouts=houses.map(h=>BASE.map(f=>({...f,kind:['workshop','radio','store'].includes(h.kind)&&f.kind==='bed'?'table':h.kind==='diner'&&f.kind==='sofa'?'table':f.kind})));
 const solids=houses.map(h=>({x:h.x-2,y:h.y-12,w:244,h:172}));for(const h of houses){const p=fuseBox(h);solids.push({x:p.x-9,y:p.y-15,w:18,h:25});}
 solids.push({x:2130,y:320,w:70,h:690},{x:461,y:865,w:58,h:58});
 // A river separates the forest from the village. The three road bridges stay open.
 for(const[y,h]of [[20,390],[490,410],[980,410]])solids.push({x:750,y,w:32,h});
 const trees=[],specks=[],lamps=[],decor=[];
 for(let i=0;i<240;i++){const t={x:40+random()*2070,y:45+random()*1400,size:.65+random()*.65,type:i%5===0?'oak':'pine'};const road=[450,940,1430].some(y=>Math.abs(t.y-y)<68)||[630,1340].some(x=>Math.abs(t.x-x)<47)||Math.abs(t.x-766)<55;const yard=houses.some(h=>within(t,{x:h.x-40,y:h.y-40,w:340,h:305}));const project=[{x:490,y:940},{x:2080,y:1020},{x:1880,y:300}].some(p=>dist(p,t)<110);if(!road&&!yard&&!project){trees.push(t);solids.push({x:t.x-9,y:t.y-8,w:18,h:16});}}
 for(let i=0;i<1400;i++)specks.push({x:random()*WORLD.w,y:random()*WORLD.h,n:random()});for(const y of [413,903])for(let x=160;x<2070;x+=320)lamps.push({x,y});
 for(let i=0;i<8;i++){const d={kind:'grave',x:65+(i%2)*42,y:1130+Math.floor(i/2)*52};decor.push(d);solids.push({x:d.x-9,y:d.y-9,w:18,h:15});}
 for(const p of [{x:480,y:600},{x:575,y:650},{x:680,y:585}]){decor.push({...p,kind:'tent'});solids.push({x:p.x-25,y:p.y-25,w:50,h:30});}
 decor.push({kind:'fire',x:570,y:580},{kind:'bus',x:1140,y:830});solids.push({x:1102,y:775,w:76,h:105});
 const map={seed,houses,layouts,solids,trees,specks,lamps,decor,grids:new Map()};maps.set(seed,map);if(maps.size>16)maps.delete(maps.keys().next().value);return map;
}
export function obstacles(map,scene){return scene<0?map.solids:[...map.layouts[scene],...PARTITIONS];}
export function blocked(map,x,y,r=11,scene=-1){const s=scene<0?WORLD:ROOM,e=scene<0?20:36;if(x<e+r||y<e+r||x>s.w-e-r||y>s.h-e-r)return true;return obstacles(map,scene).some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
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
export function clearLine(map,a,b,scene=a.scene){if(a.scene!==undefined&&b.scene!==undefined&&a.scene!==b.scene)return false;const n=Math.max(1,Math.ceil(dist(a,b)/14));for(let i=1;i<n;i++)if(obstacles(map,scene).some(o=>within({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},o)))return false;return true;}
export function route(map,goal,a,scene=a.scene){
 const cell=28,size=scene<0?WORLD:ROOM,cols=Math.ceil(size.w/cell),rows=Math.ceil(size.h/cell);let grid=map.grids.get(scene);
 if(!grid){grid=new Uint8Array(cols*rows);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)grid[y*cols+x]=blocked(map,x*cell+14,y*cell+14,12,scene)?0:1;map.grids.set(scene,grid);}
 const free=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&grid[y*cols+x];
 const near=p=>{const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);for(let r=0;r<7;r++){let best=null,b=Infinity;for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(free(x,y)){const d=Math.hypot(x*cell+14-p.x,y*cell+14-p.y);if(d<b){b=d;best={x,y};}}if(best)return best;}return null;};
 const from=near(a),to=near(goal);if(!from||!to)return[];const start=from.y*cols+from.x,end=to.y*cols+to.x,g=new Float64Array(cols*rows),parents=new Int32Array(cols*rows),closed=new Uint8Array(cols*rows),heap=[];g.fill(Infinity);g[start]=0;parents.fill(-1);
 const push=(k,f)=>{let i=heap.length;heap.push({k,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={k,f};};const pop=()=>{const v=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return v.k;};push(start,0);let count=0;
 while(heap.length&&count++<8000){const k=pop();if(closed[k])continue;if(k===end){const pts=[];for(let cur=k;cur!==start&&cur>=0;cur=parents[cur])pts.push({x:cur%cols*cell+14,y:Math.floor(cur/cols)*cell+14});return pts.reverse();}closed[k]=1;const x=k%cols,y=Math.floor(k/cols);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,nk=ny*cols+nx;if(!free(nx,ny)||closed[nk]||(dx&&dy&&(!free(x+dx,y)||!free(x,y+dy))))continue;const cost=g[k]+(dx&&dy?1.414:1);if(cost<g[nk]){g[nk]=cost;parents[nk]=k;push(nk,cost+Math.hypot(nx-to.x,ny-to.y));}}}return[];
}
