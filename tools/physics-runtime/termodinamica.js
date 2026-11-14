(()=>{'use strict';
// Closed, classical monatomic ideal gas; quasistatic boundary work only.
function solve(v,p){
 if(![v,p].every(Number.isFinite)||v<.5||v>2||p<.5||p>2)throw Error('Invalid state ratios');
 const R=8.31446261815324,PV=R*300,Vi=PV/100000,du=1.5*PV*(p*v-1),wa=PV*(v-1),wb=p*wa;
 return{v,p,Vi,Vf:Vi*v,Tf:300*p*v,du,wa,wb,qa:du+wa,qb:du+wb,dw:wb-wa};
}
if(typeof module==='object'&&module.exports)module.exports=Object.freeze({solve});
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),form=$('prediction');
const fmt=n=>(Math.abs(n)<1e-8?0:n).toLocaleString('it-IT',{maximumFractionDigits:2});
const put=(id,value)=>{$(id).textContent=value;},attr=(id,key,value)=>$(id).setAttribute(key,value);
let state;
function reset(){
 state=solve(Number($('volume').value),Number($('pressure').value));
 const {v,p}=state,x=60+200*v,y=300-120*p;
 put('volume-value',fmt(v)+' × Vᵢ = '+fmt(state.Vf*1000)+' L');
 put('pressure-value',fmt(p)+' × pᵢ = '+fmt(p*100)+' kPa');
 attr('volume','aria-valuetext',$('volume-value').textContent);attr('pressure','aria-valuetext',$('pressure-value').textContent);
 put('final-state','F: V = '+fmt(state.Vf*1000)+' L; p = '+fmt(p*100)+' kPa; T = '+fmt(state.Tf)+' K.');
 attr('path-a','d',`M260 180 H${x} V${y}`);
 attr('path-b','d',`M260 180 V${y} H${x}`);
 const mx=(260+x)/2,my=(180+y)/2,dx=Math.sign(x-260)*8,dy=Math.sign(y-180)*8;
 const arrow=(id,a,b,c,d)=>{attr(id,'d',`M${a} ${b}L${c} ${d}`);attr(id,'visibility',a===c&&b===d?'hidden':'visible');};
 arrow('dir-ah',mx-dx,180,mx,180);arrow('dir-av',x,my-dy,x,my);
 arrow('dir-bh',mx-dx,y,mx,y);arrow('dir-bv',260,my-dy,260,my);
 attr('end','cx',x);attr('end','cy',y);
 attr('area','x',Math.min(260,x));attr('area','y',Math.min(180,y));
 attr('area','width',Math.abs(x-260));attr('area','height',Math.abs(y-180));
 put('geometry',v===1&&p===1?'I e F coincidono: entrambi i percorsi sono nulli.':v===1?'Solo isocore: i percorsi coincidono.':p===1?'Solo isobare: i percorsi coincidono.':'Da I a F: A prima orizzontale, poi verticale; B prima verticale, poi orizzontale.');
 $('results').hidden=true;form.reset();
}
for(const id of ['volume','pressure'])$(id).addEventListener('input',reset);
document.querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>{
 const [v,p]=button.dataset.case.split(',');$('volume').value=v;$('pressure').value=p;reset();$('volume').focus();
}));
form.addEventListener('submit',event=>{
 event.preventDefault();const answers=new FormData(form),difference=state.dw;
 const correct=Math.abs(difference)<1e-8?'equal':difference>0?'b':'a';
 put('energy-feedback',answers.get('energy')==='same'?'ΔU: previsione corretta.':'ΔU: rivedi la previsione.');
 put('work-feedback',answers.get('work')===correct?'W: previsione corretta.':'W: rivedi la previsione.');
 document.querySelectorAll('[data-value]').forEach(node=>{node.textContent=fmt(state[node.dataset.value]);});
 put('work-order',correct==='equal'?'I lavori sono uguali.':correct==='b'?'W_B è maggiore di W_A.':'W_A è maggiore di W_B.');
 put('sign-note',state.v===1?'Non cambia il volume: W_A = W_B = 0.':state.v>1?'Espansione: il gas compie lavoro positivo in entrambi i percorsi.':'Compressione: entrambi i lavori sono negativi. “Maggiore” confronta i numeri con il segno, non i loro moduli.');
 $('results').hidden=false;$('feedback').focus();
});
$('transfer').addEventListener('submit',event=>{
 event.preventDefault();const ok=new FormData(event.currentTarget).get('transfer')==='negative';
 put('transfer-feedback',(ok?'Corretto. ':'Rivedi il segno. ')+'ΔU = 0 perché p_f V_f = p_i V_i. W_B = 200 000 × (0,010 − 0,020) = −2000 J. Q_B = ΔU + W_B = −2000 J: il gas cede calore.');
 $('transfer-feedback').hidden=false;$('transfer-feedback').focus();
});
reset();$('controls').disabled=false;$('prediction-controls').disabled=false;$('transfer-controls').disabled=false;
})();
