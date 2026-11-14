const radius=document.getElementById('radius'),ratio=document.getElementById('ratio'),flow=document.getElementById('flow');
if(radius&&ratio&&flow){
 radius.disabled=false;
 radius.addEventListener('input',()=>{
  const r=Number(radius.value),q=r**4;
  if(!Number.isFinite(r)||r<0.5||r>1.5)return;
  ratio.textContent=`r/r₀ = ${r.toFixed(2).replace('.',',')} · Q/Q₀ = ${q.toFixed(4).replace('.',',')}`;
  flow.setAttribute('width',String(100*q));
 });
}
