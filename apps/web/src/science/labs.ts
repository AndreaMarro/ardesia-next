import {COMPOSITION_RENDERER, type CompositionBody, type CompositionField, type CompositionNode, type ExtensionDefinition, type ExtensionData, extensionDefinitionDigest} from '@ardesia/contracts';

export type PhysicsLab = {id:string;title:string;aim:string;prediction:string;procedure:string;limits:string;definition:ExtensionDefinition};
const pine='#235e50',rust='#b56e46',blue='#477995',pale='#d8e5df',ink='#444d49';
const f=(key:string,label:string,initial:number,min:number,max:number,step:number,unit=''):CompositionField=>({key,label,kind:'number',initial,min,max,step,unit});
const v=(id:string,label:string,expression:string,unit=''):CompositionNode=>({id,kind:'value',props:{label,expression,unit}});
const plot=(id:string,label:string,expression:string,variable:string,min:number,max:number,unit=''):CompositionNode=>({id,kind:'plot',props:{label,expression,variable,min,max,unit}});
const shape=(id:string,kind:string,x:string,y:string,w:string,h:string,color=pine):CompositionNode=>({id,kind:'shape',props:{shape:kind,x,y,width:w,height:h,color}});
const scene=(id:string,label:string,children:CompositionNode[]):CompositionNode=>({id,kind:'scene',props:{label,width:600,height:280},children});
const line=(id:string,x:string,y:string,w:string,h:string,color=pine)=>shape(id,'line',x,y,w,h,color);
const dot=(id:string,x:string,y:string,r='7',color=pine)=>shape(id,'circle',x,y,r,r,color);
function lab(id:string,title:string,aim:string,fields:CompositionField[],outputs:CompositionNode[],prediction:string,procedure:string,limits:string):PhysicsLab{
  const body:CompositionBody={fields,nodes:[{id:'model',kind:'text',props:{text:aim}},...fields.map(field=>({id:'control_'+field.key,kind:'input',props:{field:field.key,appearance:'slider'}})),...outputs,{id:'limits',kind:'text',props:{text:limits}}]};
  return {id:'physics-'+id,title,aim,prediction,procedure,limits,definition:{format:'ardesia-extension/1',typeId:'ardesia.physics.'+id,version:1,name:title,description:aim,license:'Testi e scene originali Ardesia · tutti i diritti riservati · bozza didattica',renderer:COMPOSITION_RENDERER,body:body as unknown as ExtensionDefinition["body"],fallback:aim+' '+limits}};
}
const vectors=lab('vectors-3d','Vettori nello spazio','Ruota la vista ortografica di due vettori nel piano XY e del loro prodotto vettoriale lungo Z. Verde A, rame B, blu A×B. I risultati non dipendono dall’orientamento della vista.',
 [f('A','Modulo A',2,.2,4,.1),f('B','Modulo B',2,.2,4,.1),f('theta','Angolo fra A e B',60,0,180,1,'°'),f('yaw','Orientamento della vista',30,-180,180,1,'°'),f('tilt','Elevazione della vista',25,5,80,1,'°')],
 [v('scalar','A · B','A*B*cos(theta*pi/180)'),v('cross','Modulo A × B','A*B*sin(theta*pi/180)'),scene('vectors','Vettori 3D in proiezione ortografica',[
 line('x','300','200','140*cos(yaw*pi/180)','-140*sin(yaw*pi/180)*sin(tilt*pi/180)',pale),line('y','300','200','-140*sin(yaw*pi/180)','-140*cos(yaw*pi/180)*sin(tilt*pi/180)',pale),line('z','300','200','0','-150*cos(tilt*pi/180)',pale),
 line('a','300','200','35*A*cos(yaw*pi/180)','-35*A*sin(yaw*pi/180)*sin(tilt*pi/180)'),dot('at','300+35*A*cos(yaw*pi/180)','200-35*A*sin(yaw*pi/180)*sin(tilt*pi/180)','6'),
 line('b','300','200','35*B*cos((theta+yaw)*pi/180)','-35*B*sin((theta+yaw)*pi/180)*sin(tilt*pi/180)',rust),dot('bt','300+35*B*cos((theta+yaw)*pi/180)','200-35*B*sin((theta+yaw)*pi/180)*sin(tilt*pi/180)','6',rust),
 line('c','300','200','0','-8*A*B*sin(theta*pi/180)*cos(tilt*pi/180)',blue)])],
 'Quando l’angolo diventa 90°, quale prodotto si annulla? Ruotare la vista cambia i prodotti?',
 'Fissa i moduli. Misura prodotti a 0°, 60°, 90° e 180°. Ruota poi solo la vista. Giustifica segno e dimensioni; la scala grafica di A×B è distinta, perché le sue unità sono il prodotto delle unità di A e B.',
 'Proiezione ortografica parametrica di coordinate tridimensionali, senza prospettiva. Vettori liberi; A×B rappresentato a scala distinta. Le misure numeriche, non le lunghezze sullo schermo, definiscono i moduli.');
const projectile=lab('projectile','Un lancio, due moti','Moto parabolico ideale: x=v₀ cos(θ)t; y=v₀ sin(θ)t−gt²/2. Lancio e arrivo alla stessa quota.',
 [f('speed','Velocità iniziale',10,1,20,.5,'m/s'),f('angle','Angolo di lancio',45,5,85,1,'°'),f('phase','Frazione del volo',.4,0,1,.01)],
 [v('range','Gittata','speed^2*sin(2*angle*pi/180)/9.81','m'),v('height','Altezza massima','speed^2*sin(angle*pi/180)^2/(2*9.81)','m'),v('flight','Durata del volo','2*speed*sin(angle*pi/180)/9.81','s'),
 plot('trajectory','Altezza y (m) durante il volo','2*speed^2*sin(angle*pi/180)^2/9.81*s*(1-s)','s',0,1,'frazione del volo'),
 scene('flight_scene','Posizione sul piano: scala fissa, x 0–41 m e y 0–21 m',[line('ground','30','250','540','0',ink),dot('ball','30+12*speed^2*sin(2*angle*pi/180)/9.81*phase','250-24*speed^2*sin(angle*pi/180)^2/9.81*phase*(1-phase)')])],
 'Due lanci a 30° e 60° con lo stesso modulo hanno la stessa gittata? Anche la stessa altezza e durata?',
 'Confronta 30°, 45° e 60°. Arresta il cursore a metà volo e calcola vx e vy; poi raddoppia v₀ e verifica i fattori di scala della gittata e della durata.',
 'Punto materiale, g=9,81 m/s² uniforme, assenza di resistenza dell’aria e di rotazione terrestre. Il grafico usa la frazione del tempo di volo, non metri sull’asse orizzontale.');
const energy=lab('energy','Energia lungo un piano','Discesa da fermo su un piano inclinato con attrito cinetico costante: K=mgℓ(sinθ−μcosθ), finché il moto è una discesa già avviata.',
 [f('mass','Massa',1,.1,10,.1,'kg'),f('angle','Inclinazione',30,10,80,1,'°'),f('mu','Attrito cinetico',.1,0,.15,.01),f('distance','Distanza sul piano',2,0,5,.1,'m')],
 [v('kinetic','Energia cinetica','mass*9.81*distance*(sin(angle*pi/180)-mu*cos(angle*pi/180))','J'),v('heat','Energia dissipata','mu*mass*9.81*cos(angle*pi/180)*distance','J'),v('velocity','Velocità','sqrt(2*9.81*distance*(sin(angle*pi/180)-mu*cos(angle*pi/180)))','m/s'),plot('energy_plot','Energia cinetica K (J)','mass*9.81*s*(sin(angle*pi/180)-mu*cos(angle*pi/180))','s',0,5,'m')],
 'Raddoppiare la massa raddoppia anche la velocità alla base?',
 'Confronta due masse alla stessa quota. Calcola K, energia dissipata e perdita di potenziale e verifica K+Ediss=mgℓ sinθ.',
 'Modello cinetico: non decide l’innesco con attrito statico. Gli intervalli garantiscono sinθ>μcosθ. Nessuna resistenza dell’aria.');
const oscillator=lab('oscillator','Oscillatore armonico','Una massa su molla ideale: x=A cos(ωt+φ), ω=√(k/m). Le energie cinetica ed elastica si scambiano; la loro somma resta costante.',
 [f('m','Massa',1,.1,5,.1,'kg'),f('k','Costante elastica',20,1,100,1,'N/m'),f('A','Ampiezza',.2,.01,.5,.01,'m'),f('phase','Fase',0,0,360,1,'°')],
 [v('period','Periodo','2*pi*sqrt(m/k)','s'),v('x','Spostamento','A*cos(phase*pi/180)','m'),v('K','Energia cinetica','k*A^2*sin(phase*pi/180)^2/2','J'),v('U','Energia elastica','k*A^2*cos(phase*pi/180)^2/2','J'),plot('osc_plot','Spostamento x (m)','A*cos(2*pi*s)','s',0,2,'periodi'),scene('osc_scene','Massa lungo la coordinata orizzontale',[line('axis','50','150','500','0',pale),line('spring','50','150','250+350*A*cos(phase*pi/180)','0',pine),shape('mass','rect','290+350*A*cos(phase*pi/180)','130','40','40',rust)])],
 'Al passaggio per l’equilibrio l’accelerazione è massima o nulla? Quale energia è massima?',
 'Esplora un periodo con la fase. Registra x, K e U a 0°, 90°, 180°. Quadruplica la massa: verifica il periodo e distingui energia da potenza.',
 'Molla lineare senza smorzamento, massa concentrata. La fase è un cursore controllato, non una misura di tempo reale.');
const hydro=lab('hydrostatic','Pressione, profondità e galleggiamento','p−p₀=ρgh e spinta di Archimede F_A=ρgV immerso. Volume in litri convertito in m³; pressione relativa distinta dall’assoluta.',
 [f('rho','Densità del fluido',1000,600,1400,10,'kg/m³'),f('h','Profondità',1,0,5,.1,'m'),f('volume','Volume immerso',1,.1,5,.1,'L')],
 [v('p','Pressione relativa','rho*9.81*h/1000','kPa'),v('absolute','Pressione assoluta con p₀=101,325 kPa','101.325+rho*9.81*h/1000','kPa'),v('buoyancy','Spinta','rho*9.81*volume/1000','N'),plot('pressure','Pressione relativa (kPa)','rho*9.81*z/1000','z',0,5,'m'),scene('tank','Colonna di fluido e punto di misura',[shape('water','rect','180','20','240','240',pale),dot('sensor','300','20+48*h','8',blue)])],
 'A pari profondità conta la forma del recipiente? Un oggetto completamente immerso riceve più spinta se scende ancora?',
 'Mantieni ρ e V fissi, varia h. Confronta pressione e spinta; spiega perché possono cambiare in modo diverso.',
 'Fluido omogeneo incomprimibile a riposo; g uniforme. Il punto grafico non rappresenta la dimensione del corpo. Per il galleggiamento va confrontata la spinta col peso.');
const continuity=lab('continuity','Continuità e Bernoulli','In un tubo orizzontale ideale Q=Av costante; p₂−p₁=ρ(v₁²−v₂²)/2. Un restringimento accelera il flusso e riduce la pressione statica.',
 [f('Q','Portata',2,.1,5,.1,'L/min'),f('r1','Raggio iniziale',4,1,10,.1,'mm'),f('r2','Raggio finale',2,1,10,.1,'mm'),f('rho','Densità',1000,800,1200,10,'kg/m³')],
 [v('v1','Velocità iniziale','Q/60000/(pi*(r1/1000)^2)','m/s'),v('v2','Velocità finale','Q/60000/(pi*(r2/1000)^2)','m/s'),v('dp','p₂ − p₁','rho*((Q/60000/(pi*(r1/1000)^2))^2-(Q/60000/(pi*(r2/1000)^2))^2)/2000','kPa'),plot('velocity_radius','Velocità v (m/s)','Q/60000/(pi*(r/1000)^2)','r',1,10,'mm')],
 'Dimezzare il raggio raddoppia o quadruplica la velocità a portata fissa?',
 'Parti da raggi uguali e registra Δp. Dimezza r₂, poi scambia i raggi e controlla il segno. Distingui pressione statica da energia totale per volume.',
 'Flusso stazionario incomprimibile senza viscosità; stessa quota, nessuna pompa fra sezioni. Non applicare insieme perdite viscose non modellate.');
const poiseuille=lab('poiseuille','Quanto conta un raggio?','Flusso laminare newtoniano in tubo cilindrico: Q=πr⁴Δp/(8ηL). Il modello mostra la sensibilità alla geometria e calcola Reynolds come controllo di regime.',
 [f('r','Raggio',1,.2,3,.1,'mm'),f('dp','Caduta di pressione',100,10,500,10,'Pa'),f('eta','Viscosità dinamica',4,1,10,.5,'mPa·s'),f('L','Lunghezza',20,5,100,1,'cm')],
 [v('flow','Portata','pi*(r/1000)^4*dp/(8*(eta/1000)*(L/100))*60000000','mL/min'),v('Re','Reynolds (ρ=1060 kg/m³)','1060*(r/1000)^3*dp/(4*(eta/1000)^2*(L/100))'),plot('r4','Portata Q (mL/min)','pi*(x/1000)^4*dp/(8*(eta/1000)*(L/100))*60000000','x',.2,3,'mm')],
 'Una riduzione del raggio del 20% riduce la portata del 20%?',
 'Confronta r e 0,8r: Q₂/Q₁=0,4096. Raddoppia η e poi L. Controlla Re: se vicino o sopra 2000, non usare la formula come previsione attendibile.',
 'Tubo rigido diritto, flusso laminare pienamente sviluppato, fluido newtoniano. Il sangue reale e i vasi elastici richiedono ulteriori modelli. Il grafico mostra l’equazione anche fuori dal regime: controlla Reynolds.');
const gas=lab('ideal-gas','Gas ideale: stati e trasformazioni','pV=nRT; per un gas monoatomico U=3nRT/2. Isoterma: il lavoro compiuto dal gas è W=nRT ln(V₂/V₁).',
 [f('n','Quantità di sostanza',1,.1,3,.1,'mol'),f('T','Temperatura assoluta',300,100,700,10,'K'),f('V','Volume',20,2,50,1,'L'),f('ratio','Rapporto V₂/V₁',2,.2,4,.1)],
 [v('pressure','Pressione','n*8.314462618*T/(V/1000)/1000','kPa'),v('internal','Energia interna monoatomica','1.5*n*8.314462618*T','J'),v('work','Lavoro isotermo del gas','n*8.314462618*T*log(ratio)','J'),plot('isotherm','Isoterma p (kPa)','n*8.314462618*T/x','x',2,50,'L')],
 'Se il gas si espande isotermicamente, l’energia interna deve diminuire perché produce lavoro?',
 'Confronta espansione ratio=2 e compressione ratio=0,5. Verifica lavori opposti e ΔU=0: col primo principio ΔU=Q−W, determina il calore.',
 'Gas ideale monoatomico; trasformazione isotermica quasi statica. Kelvin obbligatori, ln naturale. Fuori dall’idealità o vicino a condensazione il modello non basta.');
const calorimetry=lab('calorimetry','Equilibrio termico','Due quantità d’acqua in un recipiente isolato, senza cambiamento di fase: T_f=(m₁T₁+m₂T₂)/(m₁+m₂). Il calore scambiato ha segni opposti.',
 [f('m1','Massa 1',.2,.05,1,.05,'kg'),f('T1','Temperatura 1',70,5,95,1,'°C'),f('m2','Massa 2',.3,.05,1,.05,'kg'),f('T2','Temperatura 2',20,5,95,1,'°C')],
 [v('Tf','Temperatura finale','(m1*T1+m2*T2)/(m1+m2)','°C'),v('Q1','Calore assorbito dall’acqua 1','m1*4180*((m1*T1+m2*T2)/(m1+m2)-T1)','J'),v('Q2','Calore assorbito dall’acqua 2','m2*4180*((m1*T1+m2*T2)/(m1+m2)-T2)','J'),plot('Tfplot','T finale al variare di m₁ (°C)','(x*T1+m2*T2)/(x+m2)','x',.05,1,'kg')],
 'La temperatura finale è sempre la media aritmetica? Che cosa cambia se una massa è nove volte l’altra?',
 'Controlla che T_f sia fra le temperature iniziali e Q₁+Q₂=0. Dimezza entrambe le masse: quali risultati cambiano?',
 'Stesso calore specifico costante c=4180 J/(kg·K), nessuna perdita e capacità termica recipiente trascurata. Non eseguire esperimenti con acqua bollente.');
const coulomb=lab('coulomb','Campo e potenziale','Una carica puntiforme: E_r=kq/r² e V=kq/r, con V=0 all’infinito. Il segno di E_r indica direzione radiale uscente o entrante.',
 [f('q','Carica',2,-5,5,.1,'nC'),f('r','Distanza',.3,.05,1,.01,'m'),f('test','Carica di prova',1,-3,3,.1,'nC')],
 [v('field','Componente radiale del campo','8.9875517923*q/r^2','N/C'),v('potential','Potenziale','8.9875517923*q/r','V'),v('force','Forza radiale sulla carica di prova','8.9875517923*q*test/r^2','nN'),plot('fieldplot','Campo radiale E (N/C)','8.9875517923*q/x^2','x',.05,1,'m')],
 'Raddoppia r: campo e potenziale si riducono dello stesso fattore? Cambiare la carica di prova cambia E?',
 'Misura E e V a r e 2r. Cambia il segno di q e poi della sola carica di prova; distingui campo, forza ed energia potenziale.',
 'Elettrostatica nel vuoto, carica puntiforme e r>0. La carica di prova non perturba la sorgente. Non è un modello della membrana cellulare.');
const circuit=lab('circuit','Resistori: serie e parallelo','Due resistori ideali alimentati da un generatore di tensione: confronta corrente totale, potenza e ripartizione delle tensioni.',
 [f('V','Tensione',12,0,24,1,'V'),f('R1','Resistenza 1',100,10,500,10,'Ω'),f('R2','Resistenza 2',200,10,500,10,'Ω')],
 [v('series','Corrente in serie','1000*V/(R1+R2)','mA'),v('parallel','Corrente totale in parallelo','1000*V*(1/R1+1/R2)','mA'),v('drop','Tensione R₁ in serie','V*R1/(R1+R2)','V'),v('power','Potenza totale in serie','V^2/(R1+R2)','W'),plot('iv','Corrente in serie I (mA)','1000*x/(R1+R2)','x',0,24,'V')],
 'Aggiungere un resistore in parallelo aumenta o diminuisce la corrente prelevata dal generatore ideale?',
 'Confronta R₁=R₂ con R₂=2R₁. Verifica Kirchhoff alle maglie e ai nodi, poi controlla P=VI e la conservazione della potenza.',
 'Regime DC, resistori ohmici e generatore ideale. Non eseguire prove sulla rete elettrica; il modello non include riscaldamento o limiti del generatore.');
const wave=lab('wave','Un’onda, due letture','Onda armonica progressiva y(x,t)=A sin[2π(x/λ−ft)]. Distingui il profilo spaziale, il moto del punto e la velocità di propagazione v=λf.',
 [f('A','Ampiezza',.4,.05,1,.05,'cm'),f('lambda','Lunghezza d’onda',2,.5,4,.1,'m'),f('frequency','Frequenza',2,.5,5,.5,'Hz'),f('time','Tempo',0,0,2,.01,'s')],
 [v('velocity','Velocità di propagazione','lambda*frequency','m/s'),v('period','Periodo','1/frequency','s'),plot('waveplot','Profilo y (cm)','A*sin(2*pi*(x/lambda-frequency*time))','x',0,8,'m'),plot('pointplot','Moto del punto x=0: y (cm)','A*sin(-2*pi*frequency*t)','t',0,2,'s')],
 'Se aumenti la frequenza mantenendo la velocità del mezzo, la lunghezza d’onda deve aumentare o diminuire?',
 'Sposta il cursore tempo e segui una cresta; confronta con l’oscillazione a x=0. Qui f e λ sono indipendenti: per simulare lo stesso mezzo mantieni λf costante.',
 'Onda armonica in mezzo lineare non dispersivo. I cursori indipendenti descrivono famiglie di onde, non tutte nello stesso mezzo. L’ampiezza è in centimetri.');
const refraction=lab('refraction','Rifrazione e angolo limite','Legge di Snell n₁ sinθ₁=n₂ sinθ₂. Se n₁>n₂ e sinθ₁>n₂/n₁, non esiste un raggio rifratto propagante: riflessione totale interna.',
 [f('n1','Indice iniziale',1,1,2,.01),f('n2','Indice finale',1.5,1,2,.01),f('angle','Angolo dalla normale',30,0,89,1,'°')],
 [v('sine','sinθ₂ richiesto','n1*sin(angle*pi/180)/n2'),v('tir','Riflessione totale (1 sì, 0 no)','if(n1*sin(angle*pi/180)>n2,1,0)'),v('speed','Velocità nel secondo mezzo','299792458/n2','m/s'),plot('snell','sinθ₂ richiesto (oltre 1: riflessione totale)','n1*sin(a*pi/180)/n2','a',0,89,'°'),scene('interface','Raggio incidente e normale all’interfaccia',[line('boundary','50','160','500','0',pale),line('normal','300','20','0','240',ink),line('incident','300-120*sin(angle*pi/180)','160-120*cos(angle*pi/180)','120*sin(angle*pi/180)','120*cos(angle*pi/180)',pine),line('refracted','300','160','if(n1*sin(angle*pi/180)<=n2,100*n1*sin(angle*pi/180)/n2,0)','if(n1*sin(angle*pi/180)<=n2,100*sqrt(max(0,1-(n1*sin(angle*pi/180)/n2)^2)),0)',blue),line('reflected','300','160','if(n1*sin(angle*pi/180)>n2,120*sin(angle*pi/180),0)','if(n1*sin(angle*pi/180)>n2,-120*cos(angle*pi/180),0)',rust)])],
 'Passando dall’acqua all’aria il raggio si avvicina alla normale o se ne allontana? Esiste sempre un raggio rifratto?',
 'Imposta n₁=1,5 e n₂=1 e trova l’angolo oltre cui sinθ₂ richiesto supera 1. Confronta con arcsin(1/1,5)≈41,81°. Ripeti scambiando gli indici.',
 'Ottica geometrica, mezzi trasparenti isotropi, angoli dalla normale. Il grafico mostra il seno richiesto: valori >1 non sono angoli fisici. Nessuna dispersione o coefficienti di Fresnel.');
const decay=lab('decay','Decadimento e attività','Decadimento esponenziale: N(t)=N₀ 2^(−t/T½), attività A=ln(2)N/T½. Il valore medio non predice il tempo di decadimento del singolo nucleo.',
 [f('N0','Nuclei iniziali',10000,1000,100000,1000),f('half','Tempo di dimezzamento',10,1,60,1,'min'),f('elapsed','Tempo trascorso',20,0,180,1,'min')],
 [v('remaining','Nuclei attesi','N0*2^(-elapsed/half)'),v('activity','Attività','log(2)*N0*2^(-elapsed/half)/(60*half)','Bq'),v('fraction','Frazione residua','2^(-elapsed/half)'),plot('decayplot','Frazione residua N/N₀','2^(-x)','x',0,6,'tempi di dimezzamento')],
 'Dopo due tempi di dimezzamento resta metà, un quarto o nessun nucleo? Due campioni identici devono avere esattamente lo stesso numero?',
 'Confronta la previsione dopo 1, 2 e 3 dimezzamenti. Controlla la conversione minuti→secondi nel calcolo dei Bq. Distingui attività, dose assorbita e dose equivalente.',
 'Singolo radionuclide senza produzione né catena di decadimenti. Valori medi continui; non dosimetria medica né stima del rischio individuale.');
const emFields=[f('phase','Fase dell’onda',0,0,360,1,'°'),f('yaw','Rotazione della vista',25,-35,35,1,'°'),f('tilt','Elevazione',30,10,50,1,'°'),f('amplitude','Campo elettrico massimo',10,1,30,1,'V/m')];
const emScene:CompositionNode[]=[line('prop','300-200*cos(yaw*pi/180)','140+200*sin(yaw*pi/180)*sin(tilt*pi/180)','400*cos(yaw*pi/180)','-400*sin(yaw*pi/180)*sin(tilt*pi/180)',pale)];
for(let i=0;i<31;i++){
 const x=i/31*400-200,amp=`(45*sin(${i/31*4}*pi-phase*pi/180))`;
 const next=`(45*sin(${(i+1)/31*4}*pi-phase*pi/180))`,dx=400/31;
 emScene.push(line('electric'+i,`300+${x}*cos(yaw*pi/180)-${amp}*sin(yaw*pi/180)`, `140-(${x}*sin(yaw*pi/180)+${amp}*cos(yaw*pi/180))*sin(tilt*pi/180)`,`${dx}*cos(yaw*pi/180)-(${next}-${amp})*sin(yaw*pi/180)`,`-(${dx}*sin(yaw*pi/180)+(${next}-${amp})*cos(yaw*pi/180))*sin(tilt*pi/180)`,pine));
 emScene.push(line('magnetic'+i,`300+${x}*cos(yaw*pi/180)`,`140-${x}*sin(yaw*pi/180)*sin(tilt*pi/180)-${amp}*cos(tilt*pi/180)`,`${dx}*cos(yaw*pi/180)`,`-${dx}*sin(yaw*pi/180)*sin(tilt*pi/180)-(${next}-${amp})*cos(tilt*pi/180)`,rust));
}
const emWave=lab('em-wave-3d','Un’onda elettromagnetica nello spazio','E e B sono trasversi, in fase e perpendicolari fra loro; E/B=c nel vuoto. Verde E lungo Y, rame B lungo Z, propagazione lungo +X.',emFields,
 [v('Bmax','Campo magnetico massimo','amplitude/299792458*1000000000','nT'),v('intensity','Intensità media','8.8541878128e-12*299792458*amplitude^2/2','W/m²'),scene('em3d','Campi trasversi normalizzati, proiezione tridimensionale',emScene)],
 'I campi possono avere lo stesso valore numerico in unità SI? Se raddoppi E massimo, come cambia l’intensità media?',
 'Ruota la vista per distinguere i piani dei due campi. Sposta la fase e segui una cresta. Raddoppia il campo e verifica B e intensità; spiega perché il disegno usa campi normalizzati.',
 'Onda piana sinusoidale nel vuoto. E/Emax e B/Bmax disegnati con la stessa ampiezza normalizzata; i valori SI sono distinti. Proiezione ortografica parametrica, non una misura delle lunghezze dei vettori.');
export const physicsLabs:PhysicsLab[]=[vectors,projectile,energy,oscillator,hydro,continuity,poiseuille,gas,calorimetry,coulomb,circuit,wave,refraction,decay,emWave];
export async function physicsLabData(id:string):Promise<ExtensionData>{
 const source=physicsLabs.find(lab=>lab.id===id);if(!source)throw Error('Laboratorio non disponibile.');
 const definition=structuredClone(source.definition),body=definition.body as unknown as CompositionBody;
 return {definition,definitionDigest:await extensionDefinitionDigest(definition),state:Object.fromEntries(body.fields.map(field=>[field.key,field.initial]))};
}
