(()=>{'use strict';
function solve(m1,m2,u1,u2,mode){
 if(![m1,m2,u1,u2].every(Number.isFinite)||m1<.5||m1>4||m2<.5||m2>4||u1<.5||u1>4||u2< -2||u2>0||!['stick','elastic'].includes(mode))throw Error('Invalid experiment');
 const mass=m1+m2,p=m1*u1+m2*u2,joined=p/mass;
 const v1=mode==='stick'?joined:((m1-m2)*u1+2*m2*u2)/mass;
 const v2=mode==='stick'?joined:(2*m1*u1+(m2-m1)*u2)/mass;
 const ki=(m1*u1*u1+m2*u2*u2)/2,kf=(m1*v1*v1+m2*v2*v2)/2;
 return{m1,m2,u1,u2,mode,v1,v2,p,pf:m1*v1+m2*v2,ki,kf,loss:mode==='elastic'?0:Math.max(0,ki-kf)};
}
function pose(s,t){return t<=.8?[s.u1*(t-.8),s.u2*(t-.8)]:[s.v1*(t-.8),s.v2*(t-.8)];}
function bounds(s){const points=[...pose(s,0),...pose(s,1.6),0];return[Math.min(...points)-.6,Math.max(...points)+.6];}
if(typeof module==='object'&&module.exports)module.exports=Object.freeze({solve,pose,bounds});
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),inputs=['m1','m2','u1','u2'],time=$('time'),play=$('play'),form=$('prediction');
const fmt=n=>(Math.abs(n)<1e-9?0:n).toLocaleString('it-IT',{maximumFractionDigits:3});
const show=(id,on)=>{$(id).hidden=!on;};
const presets=[[1,3,3,0,'stick'],[1,1,2,0,'elastic'],[1,2,3,-1,'stick'],[1,3,1,-1,'stick']];
let state,range,revealed=false,frame=0,start=0;
function stop(){cancelAnimationFrame(frame);frame=0;play.textContent='Riproduci';play.setAttribute('aria-pressed','false');}
function draw(){const t=Number(time.value),positions=pose(state,t),scale=520/(range[1]-range[0]);
 for(let i=0;i<2;i++)$('cart-'+(i?'b':'a')).setAttribute('transform','translate('+(40+(positions[i]-range[0])*scale+(i?26:-26))+',0)');
 $('time-value').textContent=fmt(t)+' s';$('stage').textContent=t<.8?'Prima del contatto':t===.8?'Contatto ideale':'Dopo il contatto';
}
function reset(){stop();revealed=false;time.value='0';time.disabled=true;play.disabled=true;form.reset();show('results',false);
 state=solve(...inputs.map(id=>Number($(id).value)),$('mode').value);range=bounds(state);
 for(const id of inputs)$(id+'-value').textContent=fmt(state[id])+(id[0]==='m'?' kg':' m/s');
 draw();
}
for(const id of [...inputs,'mode'])$(id).addEventListener('input',reset);
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
 const preset=presets[Number(button.dataset.preset)];inputs.forEach((id,i)=>{$(id).value=String(preset[i]);});$('mode').value=preset[4];reset();$('setup-title').scrollIntoView({block:'start'});$('mode').focus({preventScroll:true});
}));
form.addEventListener('submit',event=>{event.preventDefault();stop();const data=new FormData(form),sign=Math.abs(state.p)<1e-9?'zero':state.p>0?'positive':'negative';
 const p=data.get('momentum')===sign,e=data.get('energy')===(state.mode==='elastic'?'same':'less');
 show('p-right',p);show('p-wrong',!p);show('e-right',e);show('e-wrong',!e);
 document.querySelectorAll('[data-value]').forEach(node=>{node.textContent=fmt(state[node.dataset.value]);});
 $('remaining').style.width=100*state.kf/state.ki+'%';$('converted').style.width=100*state.loss/state.ki+'%';
 show('stick-note',state.mode==='stick');show('elastic-note',state.mode==='elastic');revealed=true;show('results',true);time.disabled=false;play.disabled=false;time.value='1.6';draw();$('feedback').focus();
});
time.addEventListener('input',()=>{stop();draw();});
function tick(now){time.value=String(Math.min(1.6,(now-start)/1000));draw();if(Number(time.value)<1.6)frame=requestAnimationFrame(tick);else stop();}
play.addEventListener('click',()=>{if(!revealed)return;if(frame){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){time.value=Number(time.value)>=1.6?'0':'1.6';draw();return;}if(Number(time.value)>=1.6)time.value='0';start=performance.now()-Number(time.value)*1000;play.textContent='Pausa';play.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('transfer').addEventListener('submit',event=>{event.preventDefault();const ok=new FormData(event.currentTarget).get('transfer')==='left';show('transfer-ok',ok);show('transfer-retry',!ok);show('transfer-result',true);});
reset();show('lab',true);
})();
