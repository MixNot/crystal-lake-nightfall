// Small world-space illustrations. Call after applying the map/camera transform.
const C=Object.freeze({ink:'#102321',edge:'#29443d',teal:'#779d8e',gold:'#dfc27c',paper:'#d1c8a8',steel:'#a7bdb3',red:'#a9584d',blood:'#773e37',coat:'#536b60',skin:'#bfa684'});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp01=value=>Math.max(0,Math.min(1,value));
function round(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function line(c,x1,y1,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function oval(c,x,y,rx,ry,color,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();}
function cross(c,x,y,size,color,width=2){line(c,x-size,y,x+size,y,color,width);line(c,x,y-size,x,y+size,color,width);}
function helpRing(c,x,y,time){c.save();c.translate(x,y);c.strokeStyle=C.gold;c.lineWidth=1.5;c.globalAlpha*=.65+.15*Math.sin(time*3);c.beginPath();c.arc(0,0,13,0,Math.PI*2);c.stroke();c.fillStyle=C.ink;c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();cross(c,0,0,4,C.paper,2.5);c.restore();}

export function drawFieldMark(c,mark,time=0){
 if(!mark||!Number.isFinite(Number(mark.x))||!Number.isFinite(Number(mark.y)))return;
 const strength=clamp01(finite(mark.strength,1)),t=finite(time),angle=finite(mark.angle);if(!strength)return;
 c.save();c.translate(Number(mark.x),Number(mark.y));c.globalAlpha*=strength;c.lineCap='round';c.lineJoin='round';
 switch(mark.kind){
  case 'footprint': {
   c.rotate(angle);c.globalAlpha*=.7;
   for(const [x,y,turn]of[[-5,-5,-.12],[5,5,.12]]){oval(c,x+2,y,5.3,2.5,C.teal,turn);oval(c,x-5,y,2,2.1,C.teal,turn);}
   break;
  }
  case 'blood': {
   c.rotate(angle);c.globalAlpha*=.8;oval(c,0,0,5.6,3.6,C.blood,.2);oval(c,-6,4,2.7,1.8,C.red);oval(c,6,-4,1.7,1.5,C.blood);oval(c,10,-1,1,1,C.red);
   break;
  }
  case 'decoy': {
   c.rotate(angle);oval(c,1,5,9,4,C.ink);round(c,-6,-12,12,18,2);c.fillStyle=C.edge;c.fill();c.strokeStyle=C.steel;c.lineWidth=1;c.stroke();line(c,-3,-12,-4,-21,C.steel,1.6);
   round(c,-3,-9,6,4,1);c.fillStyle=C.ink;c.fill();for(let y=-2;y<=2;y+=2)line(c,-3,y,3,y,C.teal,.8);
   const pulse=.45+.45*Math.max(0,Math.sin(t*5));c.save();c.globalAlpha*=pulse;oval(c,3,-6,1.3,1.3,C.gold);c.strokeStyle=C.gold;c.lineWidth=1;
   for(const r of[11,16]){c.beginPath();c.arc(0,-3,r,-.65,.65);c.stroke();c.beginPath();c.arc(0,-3,r,Math.PI-.65,Math.PI+.65);c.stroke();}c.restore();
   break;
  }
  case 'clue': {
   c.rotate(angle);oval(c,1,7,9,3,C.ink);c.fillStyle=C.paper;c.beginPath();c.moveTo(-7,-10);c.lineTo(3,-10);c.lineTo(8,-5);c.lineTo(8,10);c.lineTo(-7,10);c.closePath();c.fill();
   c.fillStyle=C.gold;c.beginPath();c.moveTo(3,-10);c.lineTo(3,-5);c.lineTo(8,-5);c.closePath();c.fill();for(let y=-2;y<=5;y+=3)line(c,-4,y,4,y,C.edge,.9);
   c.save();c.globalAlpha*=.4+.3*Math.max(0,Math.sin(t*2));cross(c,11,-11,3,C.gold,1);c.restore();
   break;
  }
  case 'rescue': {
   const pulse=.85+.15*Math.sin(t*2.4),glow=c.createRadialGradient(0,0,3,0,0,42);glow.addColorStop(0,'rgba(223,194,124,.24)');glow.addColorStop(1,'rgba(223,194,124,0)');c.fillStyle=glow;c.fillRect(-42,-42,84,84);
   c.save();c.globalAlpha*=pulse;c.strokeStyle=C.gold;c.lineWidth=1.5;c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.stroke();c.rotate(angle);line(c,-12,0,12,0,C.paper,3);line(c,5,-7,12,0,C.paper,3);line(c,12,0,5,7,C.paper,3);c.restore();
   break;
  }
  case 'downed': helpRing(c,0,0,t);break;
  case 'generator': {
   oval(c,1,8,20,6,C.ink);round(c,-17,-20,34,27,3);c.fillStyle=C.edge;c.fill();c.strokeStyle=C.teal;c.lineWidth=1.4;c.stroke();
   round(c,-12,-15,15,16,2);c.fillStyle=C.ink;c.fill();for(let x=-9;x<=0;x+=3)line(c,x,-12,x,-2,C.steel,.8);
   round(c,7,-14,6,8,1);c.fillStyle=C.ink;c.fill();oval(c,10,-10,1.3,1.3,mark.active===false?C.red:C.gold);
   line(c,-9,-20,-9,-25,C.steel,2);line(c,-9,-25,7,-25,C.steel,2);line(c,7,-25,7,-20,C.steel,2);line(c,-12,7,-12,10,C.steel,3);line(c,12,7,12,10,C.steel,3);
   c.strokeStyle=C.ink;c.lineWidth=2;c.beginPath();c.moveTo(15,1);c.bezierCurveTo(26,-2,27,12,21,14);c.stroke();
   c.fillStyle=C.gold;c.beginPath();c.moveTo(7,-2);c.lineTo(4,3);c.lineTo(8,3);c.lineTo(6,7);c.lineTo(12,1);c.lineTo(8,1);c.closePath();c.fill();
   break;
  }
 }
 c.restore();
}

export function drawActorState(c,actor,time=0){
 if(!actor||!Number.isFinite(Number(actor.x))||!Number.isFinite(Number(actor.y)))return;
 const x=Number(actor.x),y=Number(actor.y),t=finite(time);c.save();c.translate(x,y);c.lineCap='round';c.lineJoin='round';
 if(actor.downed){
  oval(c,1,1,27,9,C.ink);c.save();c.rotate(Math.atan2(finite(actor.fy),finite(actor.fx,1))*.2);
  round(c,-12,-9,26,13,5);c.fillStyle=C.coat;c.fill();line(c,-10,-5,9,-5,C.teal,1);round(c,-25,-7,15,6,2);c.fillStyle=C.edge;c.fill();round(c,-25,1,15,6,2);c.fill();
  oval(c,18,-4,6,7,C.skin);oval(c,20,-8,5.5,3,C.ink);line(c,-5,3,9,8,C.coat,6);line(c,0,5,3,7,C.paper,3);c.restore();helpRing(c,0,-27,t);
 }else{
  if(finite(actor.hp,2)<finite(actor.maxHp,2)&&!actor.dead){c.save();c.translate(-16,-20);c.rotate(-.18);round(c,-4,-3,8,6,1);c.fillStyle=C.paper;c.fill();line(c,-1,-2,1,2,C.red,1);c.restore();}
  if(finite(actor.windup)>0&&!actor.dead){
   const direction=actor.aim?Math.atan2(finite(actor.aim.y,y)-y,finite(actor.aim.x,x+1)-x):Math.atan2(finite(actor.fy),finite(actor.fx,1));
   c.save();c.globalAlpha*=.5+.15*Math.sin(t*15);c.strokeStyle=C.gold;c.lineWidth=2;c.beginPath();c.arc(0,-9,28,direction-.5,direction+.5);c.stroke();c.restore();
  }
 }
 c.restore();
}
