export function cameraZoom(width,height,touch){
 if(!touch)return width<500?.90:1.05;
 return height<420?.62:width<600?.66:.72;
}

export function stickVector(dx,dy,radius,deadZone=.14){
 dx=Number.isFinite(dx)?dx:0;dy=Number.isFinite(dy)?dy:0;radius=Math.max(1,Number(radius)||1);
 const distance=Math.hypot(dx,dy),fraction=Math.min(1,distance/radius),strength=Math.max(0,(fraction-deadZone)/(1-deadZone)),nx=distance?dx/distance:0,ny=distance?dy/distance:0;
 return{x:nx*strength,y:ny*strength,thumbX:nx*fraction*radius,thumbY:ny*fraction*radius};
}

export function movementVector(keys,stick={x:0,y:0}){
 const x=Number(keys.has('right'))-Number(keys.has('left')),y=Number(keys.has('down'))-Number(keys.has('up'));
 return x||y?{x,y}:{x:stick.x||0,y:stick.y||0};
}

export function attachJoystick(element,{canUse=()=>true,onStart=()=>{},onChange=()=>{}}={}){
 let pointer=null,vector={x:0,y:0};const listeners=[];
 const draw=(x,y)=>{element.style.setProperty('--stick-x',x.toFixed(2)+'px');element.style.setProperty('--stick-y',y.toFixed(2)+'px');};
 const publish=next=>{vector={x:next.x,y:next.y};draw(next.thumbX||0,next.thumbY||0);onChange({...vector});};
 function reset(){const captured=pointer;pointer=null;element.dataset.active='false';element.setAttribute('aria-pressed','false');publish({x:0,y:0});if(captured!==null)try{if(element.hasPointerCapture?.(captured))element.releasePointerCapture(captured);}catch{}}
 function update(e){const b=element.getBoundingClientRect(),radius=Math.max(12,Math.min(b.width,b.height)*.30);publish(stickVector(e.clientX-b.left-b.width/2,e.clientY-b.top-b.height/2,radius));}
 function down(e){if(pointer!==null||!canUse()||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;element.dataset.active='true';element.setAttribute('aria-pressed','true');onStart();try{element.setPointerCapture?.(pointer);}catch{}update(e);}
 function move(e){if(e.pointerId!==pointer)return;e.preventDefault();e.stopPropagation();if(!canUse()){reset();return;}update(e);}
 function end(e){if(e.pointerId!==pointer)return;e.preventDefault();e.stopPropagation();reset();}
 function listen(name,fn){element.addEventListener(name,fn,{passive:false});listeners.push([name,fn]);}
 listen('pointerdown',down);listen('pointermove',move);listen('pointerup',end);listen('pointercancel',end);listen('lostpointercapture',end);
 reset();return{reset,get vector(){return{...vector};},get active(){return pointer!==null;},destroy(){reset();for(const[name,fn]of listeners)element.removeEventListener(name,fn);}};
}

// Older embedded WebKit versions may still recognize a double tap on buttons.
// Cancel that default gesture while preserving the second button activation.
export function attachButtonTouchGuard(root,{clock=()=>performance.now()}={}){
 const starts=new Map(),lastTap=new WeakMap();
 const buttonFor=t=>{const b=t?.closest?.('button,[role=button]');return b&&!b.hasAttribute('data-joystick')?b:null;};
 const start=e=>{for(const t of e.changedTouches||[]){const button=buttonFor(t.target||e.target);if(button)starts.set(t.identifier,{button,x:t.clientX,y:t.clientY,at:clock()});}};
 const end=e=>{for(const t of e.changedTouches||[]){const s=starts.get(t.identifier);starts.delete(t.identifier);if(!s||Math.hypot(t.clientX-s.x,t.clientY-s.y)>18||clock()-s.at>700)continue;const previous=lastTap.get(s.button),now=clock();if(previous&&now-previous.at<320&&Math.hypot(t.clientX-previous.x,t.clientY-previous.y)<28&&e.cancelable){e.preventDefault();if(!s.button.disabled)s.button.click();}lastTap.set(s.button,{at:now,x:t.clientX,y:t.clientY});}};
 const cancel=e=>{for(const t of e.changedTouches||[])starts.delete(t.identifier);};
 root.addEventListener('touchstart',start,{passive:true});root.addEventListener('touchend',end,{passive:false});root.addEventListener('touchcancel',cancel,{passive:true});
 return{reset(){starts.clear();},destroy(){starts.clear();root.removeEventListener('touchstart',start);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',cancel);}};
}
