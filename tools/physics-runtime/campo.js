(() => {
'use strict';
/** Original first-party teaching model. No storage, network, plugins or dynamic code. */
const COULOMB_K=8.9875517923e9;
const EXCLUSION_RADIUS_M=.18;
const HEIGHT_VOLTS_PER_UNIT=40;
const DISPLAY_POTENTIAL_LIMIT_V=60;
const DOMAIN=2.5;
const number=(value,min,max,name)=>{if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(`Invalid ${name}`);return value;};
function chargesFor({qNanoC=1,separationM=1.6,arrangement='dipole'}={}){
 number(qNanoC,.5,3,'charge');number(separationM,.8,2.4,'separation');
 if(arrangement!=='dipole'&&arrangement!=='positive')throw new RangeError('Invalid arrangement');
 return [{x:-separationM/2,y:0,q:qNanoC*1e-9},{x:separationM/2,y:0,q:(arrangement==='dipole'?-1:1)*qNanoC*1e-9}];
}
function evaluate(charges,x,y){
 const contributions=[];let potentialV=0,ex=0,ey=0;
 for(const charge of charges){const dx=x-charge.x,dy=y-charge.y,r=Math.hypot(dx,dy);
  if(r<EXCLUSION_RADIUS_M)return {valid:false,reason:'exclusion',potentialV:null,ex:null,ey:null,magnitude:null,contributions:[]};
  const v=COULOMB_K*charge.q/r,factor=COULOMB_K*charge.q/(r*r*r);
  const item={chargeC:charge.q,distanceM:r,potentialV:v,ex:factor*dx,ey:factor*dy};contributions.push(item);potentialV+=v;ex+=item.ex;ey+=item.ey;
 }
 return {valid:true,potentialV,ex,ey,magnitude:Math.hypot(ex,ey),contributions};
}
function fieldAt(config,x,y){number(x,-DOMAIN,DOMAIN,'x');number(y,-DOMAIN,DOMAIN,'y');return evaluate(chargesFor(config),x,y);}
function heightForPotential(potentialV){if(!Number.isFinite(potentialV))throw new RangeError('Invalid potential');return Math.max(-DISPLAY_POTENTIAL_LIMIT_V,Math.min(DISPLAY_POTENTIAL_LIMIT_V,potentialV))/HEIGHT_VOLTS_PER_UNIT;}
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const fixed=(value,digits=3)=>new Intl.NumberFormat('it-IT',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Math.abs(value)<.5*10**-digits?0:value);

// Fit the orthographic view to every permitted probe/arrow and the clipped V surface.
// E arrows have length .66 in the xy plane; labels receive additional CSS-pixel padding.
function projectionMatrix(width,height,yaw,elevation){
 number(width,1,100000,'viewport width');number(height,1,100000,'viewport height');
 if(!Number.isFinite(yaw)||!Number.isFinite(elevation))throw new RangeError('Invalid camera');
 const c=Math.cos(yaw),s=Math.sin(yaw),e=Math.sin(elevation),h=Math.cos(elevation);
 const horizontal=DOMAIN*(Math.abs(c)+Math.abs(s))+.66;
 const vertical=DOMAIN*Math.abs(e)*(Math.abs(c)+Math.abs(s))+1.5*Math.abs(h)+.66*Math.abs(e);
 const usableWidth=Math.max(width*.25,width-88),usableHeight=Math.max(height*.25,height-130);
 const scale=Math.min(usableWidth/(2*horizontal),usableHeight/(2*vertical));
 const hx=width/(2*scale),hy=height/(2*scale);
 return new Float32Array([c/hx,s*e/hy,s*h/10,0,-s/hx,c*e/hy,c*h/10,0,0,h/hy,-e/10,0,0,0,0,1]);
}

function initialize(){
 const $=id=>document.getElementById(id);if(!$('field-surface'))return;
 const surface=$('field-surface'),map=$('field-map'),overlay=$('field-overlay'),wrapper=$('scene-wrap');
 const state={qNanoC:1,separationM:1.6,arrangement:'dipole',x:0,y:0,yaw:-.46,elevation:.76,mode:'3d'};
 let gl=null,program=null,meshBuffer=null,gridBuffer=null,vertexCount=0,gridCount=0;
 let width=800,height=560,pixelRatio=1,frame=0,dirtyMesh=true,mesh=null,drag=null,available3d=false;
 const overlayContext=overlay.getContext('2d'),mapContext=map.getContext('2d');
 function matrix(){return projectionMatrix(width,height,state.yaw,state.elevation);}
 function project(x,y,z=0){if(state.mode==='2d'){const scale=Math.min(width-55,height-85)/(2*DOMAIN);return [width/2+x*scale,height/2+8-y*scale];}
  const m=matrix();return [(m[0]*x+m[4]*y+m[8]*z+1)*width/2,(1-m[1]*x-m[5]*y-m[9]*z)*height/2];}
 function colour(v,shade=1){const t=clamp(v/DISPLAY_POTENTIAL_LIMIT_V,-1,1),m=Math.abs(t);const cold=[.18,.66,.81],warm=[.94,.39,.25],neutral=[.16,.28,.36],base=t<0?cold:warm;
  return neutral.map((n,i)=>(n+(base[i]-n)*Math.sqrt(m))*shade);}
 function compile(type,source){const shader=gl.createShader(type);if(!shader)throw Error('Shader unavailable');gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Shader compilation failed');}return shader;}
 function initWebGL(){
  try{gl=surface.getContext('webgl',{alpha:false,antialias:true});if(!gl)return false;
   const vertex=compile(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec4 colour;uniform mat4 camera;varying vec4 ink;void main(){gl_Position=camera*vec4(position,1.0);ink=colour;}');
   const fragment=compile(gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 ink;void main(){gl_FragColor=ink;}');
   program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader link failed');meshBuffer=gl.createBuffer();gridBuffer=gl.createBuffer();if(!meshBuffer||!gridBuffer)throw Error('Buffer unavailable');return true;
  }catch{return false;}
 }
 function makeMesh(){
  const n=65,step=2*DOMAIN/(n-1),charges=chargesFor(state),samples=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-DOMAIN+i*step,y=-DOMAIN+j*step,result=evaluate(charges,x,y);samples.push({x,y,v:result.valid?result.potentialV:null,z:result.valid?heightForPotential(result.potentialV):null});}
  mesh={n,step,samples};if(!available3d)return;
  const vertices=[],grid=[];
  const add=(p,shade=1)=>{const c=colour(p.v,shade);vertices.push(p.x,p.y,p.z,...c,.88);};
  const triangle=(a,b,c)=>{if([a,b,c].some(p=>p.v===null))return;const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz),shade=.76+.24*Math.abs((nx*.25+ny*.35+nz*.9)/len);add(a,shade);add(b,shade);add(c,shade);};
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=samples[j*n+i],b=samples[j*n+i+1],c=samples[(j+1)*n+i],d=samples[(j+1)*n+i+1];triangle(a,b,c);triangle(b,d,c);}
  // Sparse lines reveal the surface topology without suggesting particle paths.
  const line=(a,b)=>{if(a.v===null||b.v===null)return;for(const p of[a,b])grid.push(p.x,p.y,p.z+.004,.7,.85,.9,.19);};
  for(let j=0;j<n;j+=4)for(let i=0;i<n-1;i++)line(samples[j*n+i],samples[j*n+i+1]);
  for(let i=0;i<n;i+=4)for(let j=0;j<n-1;j++)line(samples[j*n+i],samples[(j+1)*n+i]);
  gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);vertexCount=vertices.length/7;
  gl.bindBuffer(gl.ARRAY_BUFFER,gridBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(grid),gl.STATIC_DRAW);gridCount=grid.length/7;
 }
 function drawBuffer(buffer,count,kind){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const p=gl.getAttribLocation(program,'position'),c=gl.getAttribLocation(program,'colour');gl.enableVertexAttribArray(p);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(p,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(c,4,gl.FLOAT,false,28,12);gl.drawArrays(kind,0,count);}
 function drawWebGL(){gl.viewport(0,0,surface.width,surface.height);gl.clearColor(.063,.11,.169,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(program);gl.uniformMatrix4fv(gl.getUniformLocation(program,'camera'),false,matrix());drawBuffer(meshBuffer,vertexCount,gl.TRIANGLES);drawBuffer(gridBuffer,gridCount,gl.LINES);}
 function drawMap(){if(!mapContext||!mesh)return;const ctx=mapContext;ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.fillStyle='#101c2b';ctx.fillRect(0,0,width,height);const {n,step,samples}=mesh;
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const p=samples[j*n+i];if(p.v===null)continue;const col=colour(p.v);ctx.fillStyle=`rgb(${col.map(x=>Math.round(x*255)).join(',')})`;const [x,y]=project(p.x,p.y),[xx,yy]=project(p.x+step,p.y+step);ctx.fillRect(x,yy,xx-x+1,y-yy+1);}
  // Marching squares: linear interpolation on the sampled V map, not field lines.
  for(const level of [-40,-20,-10,0,10,20,40]){ctx.beginPath();for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const p=[samples[j*n+i],samples[j*n+i+1],samples[(j+1)*n+i+1],samples[(j+1)*n+i]];if(p.some(v=>v.v===null))continue;const crossings=[];
    for(let k=0;k<4;k++){const a=p[k],b=p[(k+1)%4];if((a.v<level)!==(b.v<level)){const t=(level-a.v)/(b.v-a.v);crossings.push(project(a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)));}}
    for(let k=0;k+1<crossings.length;k+=2){ctx.moveTo(...crossings[k]);ctx.lineTo(...crossings[k+1]);}}
   ctx.strokeStyle=level===0?'rgba(244,247,251,.72)':'rgba(219,234,244,.27)';ctx.lineWidth=level===0?1.5:1;ctx.stroke();}
 }
 function drawOverlay(){if(!overlayContext)return;const ctx=overlayContext;ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,width,height);ctx.lineWidth=1;ctx.font='12px system-ui';ctx.textAlign='center';
  const segment=(a,b,colour,width=1,dash=[])=>{ctx.beginPath();ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);};
  const label=(text,x,y,colour='#dce9f2',align='center')=>{ctx.textAlign=align;ctx.font='12px system-ui';ctx.fillStyle='#101c2b';const measure=ctx.measureText(text).width;ctx.fillRect(x-(align==='center'?measure/2:align==='right'?measure:0)-4,y-12,measure+8,18);ctx.fillStyle=colour;ctx.fillText(text,x,y);};
  for(let t=-2;t<=2;t+=1){segment(project(t,-DOMAIN),project(t,DOMAIN),'rgba(181,207,225,.11)');segment(project(-DOMAIN,t),project(DOMAIN,t),'rgba(181,207,225,.11)');}
  segment(project(-DOMAIN,0),project(DOMAIN,0),'rgba(211,227,238,.45)');segment(project(0,-DOMAIN),project(0,DOMAIN),'rgba(211,227,238,.45)');
  let p=project(DOMAIN,0);label('x / m',p[0]-7,p[1]+18,'#bccfdd','right');p=project(0,DOMAIN);label('y / m',p[0]+12,p[1]+(state.mode==='2d'?22:5),'#bccfdd','left');
  if(state.mode==='3d'){const origin=project(-DOMAIN,-DOMAIN,0),high=project(-DOMAIN,-DOMAIN,1.5);segment(origin,high,'rgba(242,247,250,.5)',1,[3,3]);label('+60 V',high[0]-7,high[1]-6,'#e0eaf2','right');}
  for(const [i,q]of chargesFor(state).entries()){const [x,y]=project(q.x,q.y);ctx.beginPath();for(let t=0;t<=48;t++){const a=t*Math.PI/24,[xx,yy]=project(q.x+EXCLUSION_RADIUS_M*Math.cos(a),q.y+EXCLUSION_RADIUS_M*Math.sin(a));t?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.setLineDash([3,3]);ctx.strokeStyle='#d1e0e9';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,12,0,2*Math.PI);ctx.fillStyle=q.q>0?'#e47754':'#46aecf';ctx.fill();ctx.strokeStyle='#f0f3f8';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#0c1c28';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText(q.q>0?'+':'−',x,y+6);label((i===0?'q₁ = ':'q₂ = ')+(q.q>0?'+':'−')+fixed(state.qNanoC,1)+' nC',x,y+32);}
  const result=fieldAt(state,state.x,state.y),[x,y]=project(state.x,state.y);
  if(result.valid&&state.mode==='3d'){const top=project(state.x,state.y,heightForPotential(result.potentialV));segment([x,y],top,'#f4ce75',1,[4,4]);ctx.beginPath();ctx.arc(...top,3,0,Math.PI*2);ctx.fillStyle='#f4ce75';ctx.fill();}
  ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fillStyle='#fff7d5';ctx.fill();ctx.strokeStyle='#101c2b';ctx.lineWidth=2;ctx.stroke();
  if(result.valid&&result.magnitude>1e-9){const end=project(state.x+.66*result.ex/result.magnitude,state.y+.66*result.ey/result.magnitude),angle=Math.atan2(end[1]-y,end[0]-x);segment([x,y],end,'#ffdc7f',3);ctx.beginPath();ctx.moveTo(...end);ctx.lineTo(end[0]-10*Math.cos(angle-.45),end[1]-10*Math.sin(angle-.45));ctx.lineTo(end[0]-10*Math.cos(angle+.45),end[1]-10*Math.sin(angle+.45));ctx.closePath();ctx.fillStyle='#ffdc7f';ctx.fill();label('E',end[0]+12,end[1]-7,'#ffe4a0');}
  label(result.valid?'P · sonda':'P · zona esclusa',x,y-15,'#fff0b9');
  if(state.mode==='2d'){ctx.font='11px system-ui';ctx.fillStyle='#b8cbd9';ctx.textAlign='left';ctx.fillText('Curve: V = −40, −20, −10, 0, 10, 20, 40 V',15,height-42);}
 }
 function render(){frame=0;if(dirtyMesh){makeMesh();dirtyMesh=false;}if(state.mode==='3d'&&available3d)drawWebGL();else drawMap();drawOverlay();}
 function schedule(rebuild=false){dirtyMesh||=rebuild;if(!frame)frame=requestAnimationFrame(render);}
 function resize(){const rect=wrapper.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);pixelRatio=Math.min(window.devicePixelRatio||1,2);for(const canvas of[surface,map,overlay]){canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);}schedule();}
 function setMode(mode){state.mode=mode==='3d'&&available3d?'3d':'2d';surface.hidden=state.mode!=='3d';map.hidden=state.mode!=='2d';$('view-3d').setAttribute('aria-pressed',String(state.mode==='3d'));$('view-2d').setAttribute('aria-pressed',String(state.mode==='2d'));$('scene-mode').textContent=state.mode==='3d'?'Superficie V(x, y) · altezza grafica':'Equipotenziali · vista dall’alto';document.querySelector('.camera-controls').hidden=state.mode==='2d';$('scene-help').textContent=state.mode==='3d'?'Trascina la superficie per ruotarla. Puoi anche usare le frecce della tastiera o i pulsanti. La sonda si muove con i controlli x e y.':'Vista dall’alto del piano xy. Sposta la sonda con i controlli x e y; le curve uniscono punti a uguale potenziale. Passa a Superficie 3D per ruotare il paesaggio.';for(const id of['rotate-left','rotate-right','tilt-up','tilt-down','reset-camera'])$(id).disabled=state.mode!=='3d';$('render-status').textContent=available3d?(state.mode==='3d'?'3D WebGL attivo · nessuna animazione automatica.':'Mappa 2D Canvas · gli stessi valori fisici, una vista diversa.'):'WebGL non disponibile: mappa 2D attiva. Modello, controlli e misure restano disponibili.';schedule();}
 function updateMeasurements(){
  const result=fieldAt(state,state.x,state.y);$('charge-label').textContent=fixed(state.qNanoC,2)+' nC';$('separation-label').textContent=fixed(state.separationM,2)+' m';$('x-label').textContent=fixed(state.x,2)+' m';$('y-label').textContent=fixed(state.y,2)+' m';
  $('potential').textContent=result.valid?fixed(result.potentialV)+' V':'Non definito';$('field-strength').textContent=result.valid?fixed(result.magnitude)+' N/C':'Non definito';$('field-components').textContent=result.valid?`Eₓ ${fixed(result.ex)} · Eᵧ ${fixed(result.ey)}`:'Sonda nella zona esclusa';
  const status=$('measurement-status');status.classList.toggle('warning',!result.valid);status.textContent=result.valid?`Sonda P = (${fixed(state.x,2)}; ${fixed(state.y,2)}) m. ${Math.abs(result.potentialV)>DISPLAY_POTENTIAL_LIMIT_V?'La superficie è saturata qui; il potenziale numerico resta quello calcolato.':result.magnitude<1e-9?'Il campo si annulla in questo punto.':Math.abs(result.potentialV)<1e-9?'Qui V è zero, ma il campo può non esserlo: confronta le contribuzioni.':'Il vettore mostra la direzione del campo; per il modulo leggi la misura.'}`:'Sonda a meno di 0,18 m da una carica: punto escluso. Spostala per misurare; non viene inventato un valore per la singolarità.';
  const rows=$('contribution-rows');rows.replaceChildren();for(const [i,item]of result.contributions.entries()){const row=document.createElement('tr');for(const text of[`q${i+1} (${item.chargeC>0?'+':'−'})`,fixed(item.distanceM),fixed(item.potentialV),fixed(item.ex),fixed(item.ey)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}rows.append(row);}
  surface.setAttribute('aria-label',`Superficie del potenziale, ruotabile. ${status.textContent}`);map.setAttribute('aria-label',`Mappa del potenziale sul piano xy. ${status.textContent}`);
 }
 function change(){updateMeasurements();schedule(true);}
 for(const[id,key]of[['charge','qNanoC'],['separation','separationM'],['probe-x','x'],['probe-y','y']])$(id).addEventListener('input',event=>{const value=Number(event.target.value);if(!Number.isFinite(value))return;state[key]=value;updateMeasurements();schedule(key==='qNanoC'||key==='separationM');});
 for(const radio of document.querySelectorAll('input[name=arrangement]'))radio.addEventListener('change',()=>{state.arrangement=radio.value;change();});
 const center=()=>{state.x=0;state.y=0;$('probe-x').value='0';$('probe-y').value='0';updateMeasurements();schedule();};$('center-probe').addEventListener('click',center);
 const rotate=(dx,dy)=>{state.yaw+=dx;state.elevation=clamp(state.elevation+dy,.22,1.42);schedule();};
 $('rotate-left').addEventListener('click',()=>rotate(-.18,0));$('rotate-right').addEventListener('click',()=>rotate(.18,0));$('tilt-up').addEventListener('click',()=>rotate(0,.12));$('tilt-down').addEventListener('click',()=>rotate(0,-.12));$('reset-camera').addEventListener('click',()=>{state.yaw=-.46;state.elevation=.76;schedule();});
 surface.addEventListener('pointerdown',event=>{if(event.button!==0||drag)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};surface.setPointerCapture(event.pointerId);});
 surface.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;rotate((event.clientX-drag.x)*.008,(event.clientY-drag.y)*.005);drag.x=event.clientX;drag.y=event.clientY;});
 const endDrag=event=>{if(drag?.id===event.pointerId)drag=null;};for(const name of['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(name,endDrag);
 surface.addEventListener('keydown',event=>{const directions={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,.09],ArrowDown:[0,-.09]};if(directions[event.key]){event.preventDefault();rotate(...directions[event.key]);}else if(event.key==='Home'){event.preventDefault();$('reset-camera').click();}});
 $('view-3d').addEventListener('click',()=>setMode('3d'));$('view-2d').addEventListener('click',()=>setMode('2d'));
 for(const button of document.querySelectorAll('[data-answer]'))button.addEventListener('click',()=>{for(const b of document.querySelectorAll('[data-answer]'))b.setAttribute('aria-pressed',String(b===button));const good=button.dataset.answer==='different';const box=$('challenge-feedback');box.classList.add('challenge-feedback');box.replaceChildren();const p=document.createElement('p');p.textContent=(good?'Esatto. ':'Rivedi le direzioni. ')+'Al centro del dipolo V₁ e V₂ hanno segno opposto e si annullano. E₁ ed E₂ puntano entrambi verso +x: il campo non è zero. Il valore di V non determina da solo la sua variazione nello spazio. La sfida riguarda il dipolo al centro, anche se hai modificato il laboratorio.';box.append(p);});
 $('challenge-reset').addEventListener('click',()=>{state.arrangement='dipole';document.querySelector('input[value=dipole]').checked=true;center();schedule(true);});
 available3d=initWebGL();surface.addEventListener('webglcontextlost',event=>{event.preventDefault();available3d=false;$('view-3d').disabled=true;setMode('2d');});
 $('field-controls').disabled=false;$('view-3d').disabled=!available3d;$('view-2d').disabled=false;for(const button of document.querySelectorAll('[data-answer],#challenge-reset'))button.disabled=false;
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(wrapper);else window.addEventListener('resize',resize);
 updateMeasurements();setMode(available3d?'3d':'2d');resize();
}
const model=Object.freeze({COULOMB_K,EXCLUSION_RADIUS_M,HEIGHT_VOLTS_PER_UNIT,DISPLAY_POTENTIAL_LIMIT_V,chargesFor,fieldAt,heightForPotential,projectionMatrix});
if(typeof module!=='undefined'&&module.exports)module.exports=model;
if(typeof document!=='undefined')initialize();
})();
