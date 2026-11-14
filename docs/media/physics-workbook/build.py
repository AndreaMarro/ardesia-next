from pathlib import Path
import math, json, hashlib, argparse
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Build the original seven-page Ardesia lab workbook.')
parser.add_argument('--font-dir',required=True,type=Path,help='Directory containing DejaVuSans.ttf, DejaVuSans-Bold.ttf and DejaVuSerif.ttf')
parser.add_argument('--output',type=Path,default=ROOT/'Quaderno-degli-esperimenti-C1-C5.pdf')
args=parser.parse_args()
FONTS=args.font_dir
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Title','DejaVuSerif.ttf')]:pdfmetrics.registerFont(TTFont(name,str(FONTS/file)))
INK=HexColor('#203c35');MUTED=HexColor('#54675e');COPPER=HexColor('#ac4e31');BLUE=HexColor('#315c92');RULE=HexColor('#cfd8cc');PAPER=HexColor('#fcfaf5')
W,H=595.276,841.89;L=48;R=W-48;CW=R-L
out=args.output
c=canvas.Canvas(str(out),pagesize=(W,H),pageCompression=1,invariant=1)
c.setTitle('Ardesia - Quaderno degli esperimenti C1-C5');c.setAuthor('Ardesia Next - bozza didattica');c.setSubject('Prevedi, osserva, spiega. Cinque schede da annotare; contenuti DRAFT, revisione scientifica umana pendente.')
styles={k:ParagraphStyle(k,fontName='Body',fontSize=s,leading=l,textColor=INK,spaceAfter=0)for k,s,l in [('body',10.2,15),('small',8.1,11),('lead',11,16)]}
page=0
layout=[]
def text(txt,x,y,width=CW,style='body'):
 p=Paragraph(txt,styles[style]);pw,ph=p.wrap(width,900);p.drawOn(c,x,y-ph);layout.append({'page':page,'top':y,'bottom':y-ph,'text':txt});return y-ph

def line(x1,y1,x2,y2,color=RULE,width=.6):c.setStrokeColor(color);c.setLineWidth(width);c.line(x1,y1,x2,y2)
def label(s,x,y,size=8,color=MUTED):c.setFillColor(color);c.setFont('Body',size);c.drawString(x,y,s)
def title(s,x,y,size=27):c.setFillColor(INK);c.setFont('Title',size);c.drawString(x,y,s)
def page_start(code,name,subtitle,filename):
 global page
 page+=1;c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
 label('ARDESIA NEXT  /  QUADERNO DEGLI ESPERIMENTI',L,H-40,8,COPPER)
 label(code,R-30,H-40,10,COPPER)
 title(name,L,H-82);text(subtitle,L,H-101,style='lead')
 y=H-149;label('Apri nel pacchetto offline: '+filename,L,y,8)
 line(L,y-10,R,y-10)
 return y-26

def footer():
 line(L,47,R,47);label('DRAFT · revisione scientifica umana pendente · 14 novembre 2026',L,31,7)
 label(str(page)+' / 7',R-25,31,8);c.showPage()

def section(n,name,y):
 c.setFillColor(COPPER);c.setFont('Bold',9);c.drawString(L,y,n)
 c.setFillColor(INK);c.setFont('Bold',11);c.drawString(L+28,y,name)
 return y-13

def writing(y,rows=3,caption=None):
 if caption:y=text(caption,L,y,style='small')-8
 for _ in range(rows):line(L,y,R,y);y-=22
 return y-8

def table(y,headers,rows,widths=None):
 widths=widths or [CW/len(headers)]*len(headers)
 h=29;c.setFillColor(HexColor('#e8eee5'));c.rect(L,y-h,CW,h,fill=1,stroke=0)
 for i,v in enumerate(headers):text(v,L+sum(widths[:i])+7,y-7,widths[i]-14,'small')
 y-=h
 for row in rows:
  for i,v in enumerate(row):text(str(v),L+sum(widths[:i])+7,y-8,widths[i]-14,'small')
  y-=33;line(L,y,R,y)
 return y-16

def arrow(x,y,length,color=INK):
 line(x,y,x+length,y,color,1.3);sgn=1 if length>=0 else -1
 line(x+length,y,x+length-6*sgn,y+3,color,1.3);line(x+length,y,x+length-6*sgn,y-3,color,1.3)

# C1
p=page_start('C1','Un urto. Due bilanci.','Prima ragiona sul sistema; poi guarda che cosa cambia quando cambia il modello dell’urto.','urti.html')
y=section('01','Prevedi prima di premere il pulsante',p)
y=text('Imposta m<sub>A</sub> = 1 kg, m<sub>B</sub> = 3 kg, u<sub>A</sub> = +3 m/s e u<sub>B</sub> = 0. Il verso positivo è a destra. Sistema isolato lungo l’asse: impulso esterno trascurabile.',L,y)-10
c.setFillColor(HexColor('#dfe9dc'));c.roundRect(95,y-43,65,29,4,fill=1,stroke=0);c.roundRect(365,y-43,110,29,4,fill=1,stroke=0)
label('A · 1 kg',103,y-32,9,INK);label('B · 3 kg',387,y-32,9,INK);arrow(173,y-28,70);label('+3 m/s',184,y-16,9);label('fermo',399,y-16,9);line(70,y-46,520,y-46)
y-=67
y=text('Nell’aggancio, prevedi il verso finale e se l’energia cinetica si conserva. Motiva senza usare ancora i risultati del laboratorio.',L,y)-8
y=writing(y,2)
y=section('02','Confronta aggancio ed elastico',y)
y=table(y,['Modello','p finale / (kg m/s)','K finale / J','v<sub>A</sub>, v<sub>B</sub> / (m/s)'],[['Aggancio','','',''],['Elastico','','','']],[100,135,112,CW-347])
y=text('Calcola prima p iniziale e K iniziale. Poi verifica il bilancio: che cosa può diventare l’energia cinetica mancante? Distingui energia cinetica ed energia totale.',L,y)-7
y=writing(y,2)
y=section('03','Trasferisci l’idea',y)
y=text('Nuovo aggancio: m<sub>A</sub> = 2 kg, m<sub>B</sub> = 1 kg, u<sub>A</sub> = +2 m/s, u<sub>B</sub> = -1 m/s. Trova velocità comune e perdita di energia cinetica. Quale segno decide il verso?',L,y)-9
y=writing(y,2);footer()

# C2
p=page_start('C2','Un raggio, alla quarta.','Una relazione non lineare può rendere enorme un cambiamento che sembra piccolo.','index.html, sezione laboratorio')
y=section('01','Dichiara che cosa resta fisso',p)
y=text('Tubo rigido circolare; fluido newtoniano incomprimibile; flusso laminare stazionario, completamente sviluppato; non slittamento alla parete. Tieni fissi differenza di pressione, viscosità e lunghezza.',L,y)-12
y=text('Modello: Q/Q<sub>0</sub> = (r/r<sub>0</sub>)<super>4</super>. Prima di spostare il cursore, prevedi: dimezzare r dimezza anche Q? Scrivi una motivazione.',L,y)-7
y=writing(y,2)
y=section('02','Metti a confronto previsione e misura',y)
y=table(y,['r/r<sub>0</sub>','La mia previsione Q/Q<sub>0</sub>','Valore letto nel laboratorio'],[['0,50','',''],['1,00','',''],['1,50','','']],[90,205,CW-295])
y=text('Esprimi Q a r/r<sub>0</sub> = 0,50 anche come percentuale della portata iniziale. Se la previsione era diversa, individua il passaggio che correggi.',L,y)-8
y=writing(y,3)
y=section('03','Quando il modello non basta',y)
y=text('Per ridurre la portata a metà, quale rapporto r/r<sub>0</sub> richiede il modello? Risolvi x<super>4</super> = 1/2. Poi spiega perché non basta questa formula per descrivere un’arteria reale con pareti elastiche e flusso pulsatile.',L,y)-8
y=writing(y,3);footer()

# C3
p=page_start('C3','Stessi stati, percorsi diversi.','Calore e lavoro raccontano il percorso. L’energia interna confronta gli estremi.','termodinamica.html')
y=section('01','Disegna e prevedi',p)
y=text('1 mol di gas ideale monoatomico; T<sub>i</sub> = 300 K, p<sub>i</sub> = 100 kPa. Imposta p<sub>f</sub>/p<sub>i</sub> = 2 e V<sub>f</sub>/V<sub>i</sub> = 1,5. Solo lavoro p-V quasistatico. Q positivo entra nel gas; W positivo è compiuto dal gas.',L,y)-5
# Diagram at right and prediction at left
text('A: prima isobara, poi isocora.<br/>B: prima isocora, poi isobara.<br/><br/>Quale W è maggiore?<br/>Le due ΔU sono diverse?',L,y-8,245)
x=350;dy=y-90;line(x,dy,x+140,dy,INK,1);line(x,dy,x,dy+85,INK,1);label('V',x+145,dy-3);label('p',x-3,dy+91)
line(x+25,dy+25,x+110,dy+25,COPPER,2);line(x+110,dy+25,x+110,dy+72,COPPER,2)
line(x+25,dy+25,x+25,dy+72,BLUE,2);line(x+25,dy+72,x+110,dy+72,BLUE,2)
label('I',x+12,dy+12,9);label('F',x+115,dy+74,9);label('A',x+66,dy+9,9,COPPER);label('B',x+65,dy+79,9,BLUE)
y-=111;y=writing(y,1)
y=section('02','Ricostruisci il bilancio in joule',y)
y=table(y,['Percorso','ΔU / J','W / J','Q / J'],[['A','','',''],['B','','','']])
y=text('Usa R = 8,314462618 J/(mol K), pV = nRT e ΔU = 3nRΔT/2. Ricorda: nelle isocore W = 0. Controlla Q - W per entrambi i percorsi.',L,y)-8
y=writing(y,2)
y=section('03','Una controprova sul calore',y)
y=text('Un altro gas ideale passa da 100 kPa e 20 L a 200 kPa e 10 L. Il percorso B è prima isocoro, poi isobaro alla pressione finale. Trova ΔU, W e Q. Stessa temperatura finale significa Q = 0?',L,y)-8
y=writing(y,2);footer()

# C4
p=page_start('C4','Zero non significa assenza.','Potenziale scalare e campo vettoriale rispondono a due domande diverse.','campo.html')
y=section('01','Prevedi nel punto medio',p)
y=text('Scegli un dipolo nel vuoto: +1 nC a sinistra, -1 nC a destra, separazione 1,6 m. Poni la sonda in x = 0, y = 0. Il riferimento del potenziale è V = 0 all’infinito.',L,y)-8
for x,sign,col in [(150,'+',COPPER),(445,'-',BLUE)]:
 c.setFillColor(col);c.circle(x,y-32,16,fill=1,stroke=0);c.setFillColor(white);c.setFont('Bold',18);c.drawCentredString(x,y-38,sign)
c.setFillColor(INK);c.circle(W/2,y-32,3,fill=1,stroke=0);label('sonda',W/2-15,y-55);line(173,y-32,279,y-32);line(316,y-32,423,y-32)
label('x = -0,8 m',120,y-65);label('x = +0,8 m',412,y-65);y-=84
y=text('Prevedi separatamente V, il modulo di E e la direzione di E. Le grandezze che si sommano sono numeri con segno oppure vettori?',L,y)-8
y=writing(y,2)
y=section('02','Cambia un solo elemento',y)
y=table(y,['Configurazione, sonda al centro','V / V','|E| / (N/C)','Direzione di E'],[['Dipolo: + e -','','',''],['Due cariche positive','','','']],[200,88,105,CW-393])
y=text('Leggi i contributi delle due cariche. Spiega perché cambiare il segno della seconda carica scambia quale grandezza si annulla nel punto medio.',L,y)-7
y=writing(y,2)
y=section('03','Controlla il significato del disegno',y)
y=text('Nel dipolo sposta la sonda su x = 0, y = 1 m. Il potenziale resta nullo? E il campo? La superficie 3D mostra V, non una traiettoria: l’altezza visiva è saturata a ±60 V; leggi i valori numerici. Evita le zone escluse entro 0,18 m dalle cariche.',L,y)-8
y=writing(y,2);footer()

# C5
p=page_start('C5','Due onde, una somma.','Somma gli spostamenti nello stesso punto e nello stesso istante, conservando il segno.','c5.html, sezione interferenza')
y=section('01','Un’istantanea non è un’ampiezza',p)
y=text('Nel regime lineare, due oscillazioni coerenti hanno f = 2 Hz: y<sub>1</sub> = A<sub>1</sub> sin(4πt), y<sub>2</sub> = A<sub>2</sub> sin(4πt + φ). Le ampiezze sono positive e φ è lo sfasamento nello stesso punto.',L,y)-10
y=text('Con A<sub>1</sub> = A<sub>2</sub> = 1 cm e φ = 120°, prevedi y a t = 0,125 s. Questo valore coincide necessariamente con l’ampiezza della somma?',L,y)-7
y=writing(y,2)
y=section('02','Confronta tre configurazioni',y)
y=table(y,['Sfasamento (A<sub>1</sub> = A<sub>2</sub> = 1 cm)','y a 0,125 s / cm','Ampiezza della somma / cm'],[['0° (in fase)','',''],['120°','',''],['180° (opposte e uguali)','','']],[200,140,CW-340])
y=text('Usa le curve sulla stessa scala. Per riconoscere un’ampiezza guarda l’intera oscillazione: è il massimo modulo dello spostamento, non il valore di un istante scelto.',L,y)-8
y=writing(y,2)
y=section('03','Una linea nulla, una conclusione troppo rapida',y)
y=text('Una cancellazione degli spostamenti in un punto dimostra che tutta l’energia del sistema è nulla? Distingui spostamento, velocità e distribuzione spaziale dell’energia. Come cambia la cancellazione se le ampiezze opposte sono diverse?',L,y)-8
y=writing(y,4);footer()

# Solutions 1
p=page_start('↗','Confronta il tuo ragionamento.','Apri queste pagine dopo aver scritto una previsione e completato almeno un bilancio.','riferimenti delle schede precedenti')
y=section('C1','Quantità di moto ed energia',p)
y=text('All’inizio p = 1×3 + 3×0 = 3 kg m/s e K = 1×3²/2 = 4,5 J. Nell’aggancio v = p/(1+3) = 0,75 m/s; K finale = 4×0,75²/2 = 1,125 J. La perdita di energia cinetica è 3,375 J, convertita in altre forme: non è una scomparsa di energia totale.',L,y)-9
y=text('Nell’urto elastico unidimensionale, v<sub>A</sub> = -1,5 m/s e v<sub>B</sub> = +1,5 m/s. Controlli: p = -1,5 + 4,5 = 3 kg m/s; K = 1,125 + 3,375 = 4,5 J. Nel trasferimento: p = 2×2 + 1×(-1) = 3, v = 1 m/s, K iniziale = 4,5 J, K finale = 1,5 J; perdita = 3 J.',L,y)-20
y=section('C2','La quarta potenza e le sue ipotesi',y)
y=text('I rapporti Q/Q<sub>0</sub> sono 0,0625; 1; 5,0625. Dimezzare il raggio porta al 6,25% della portata iniziale. Per Q/Q<sub>0</sub> = 1/2, r/r<sub>0</sub> = (1/2)<super>1/4</super> ≈ 0,8409: basta ridurre il raggio di circa il 15,9% nel modello assegnato.',L,y)-9
y=text('La relazione è condizionata alle ipotesi. Pareti deformabili, andamento pulsatile, viscosità non costante o flusso non laminare richiedono un modello adeguato: i rapporti calcolati non sono una previsione clinica.',L,y)-20
y=section('C3','Lo stato finale non fissa il calore',y)
y=text('p<sub>i</sub>V<sub>i</sub> = nRT<sub>i</sub> ≈ 2494,34 J. Il prodotto finale p<sub>f</sub>V<sub>f</sub> è tre volte quello iniziale, quindi T<sub>f</sub> = 900 K e ΔU ≈ 7483,02 J in entrambi i percorsi. W<sub>A</sub> ≈ 1247,17 J; W<sub>B</sub> ≈ 2494,34 J. Dal primo principio Q<sub>A</sub> ≈ 8730,19 J e Q<sub>B</sub> ≈ 9977,36 J.',L,y)-9
y=text('B richiede più calore e compie più lavoro, della stessa differenza. Non è un ciclo: I e F sono distinti. Nel trasferimento, p<sub>i</sub>V<sub>i</sub> = p<sub>f</sub>V<sub>f</sub> = 2000 J, quindi ΔU = 0; W<sub>B</sub> = 200000×(0,010-0,020) = -2000 J. Perciò Q<sub>B</sub> = -2000 J: il gas cede calore pur tornando alla stessa temperatura.',L,y)-10
text('Se il tuo risultato differisce, verifica prima unità e segni: kPa→Pa, L→m³, W positivo nell’espansione. Non cambiare convenzione a metà del bilancio.',L,y,style='small');footer()

# Solutions 2 and use
p=page_start('↗','Dal confronto alla spiegazione.','Il risultato è un controllo. Il passo successivo è spiegare perché deve avere quel segno.','schede C4 e C5')
y=section('C4','V = 0 ed E = 0 sono condizioni diverse',p)
y=text('Al centro del dipolo, i potenziali +kq/0,8 e -kq/0,8 si cancellano. I due campi sono invece entrambi diretti verso destra: |E| = 2kq/(0,8²) ≈ 28,086 N/C. Con due cariche positive, i campi al centro sono opposti e si cancellano; V = 2kq/0,8 ≈ 22,469 V.',L,y)-9
y=text('Sull’asse x = 0 del dipolo le distanze dalle cariche sono uguali: V = 0 anche a y = 1 m. Le componenti verticali del campo si cancellano, quelle orizzontali si sommano. Quindi E è non nullo, diretto a destra. Un valore nullo della funzione non implica che il suo gradiente sia nullo.',L,y)-20
y=section('C5','Somma istantanea e ampiezza',y)
y=text('A t = 0,125 s, 4πt = π/2. In fase: y = 2 cm e ampiezza 2 cm. A 120°: y = 1 + sin(7π/6) = 0,5 cm; l’ampiezza è però 1 cm. A 180° con ampiezze uguali: y = 0 sempre, ampiezza risultante nulla nel punto considerato.',L,y)-9
y=text('Per la stessa frequenza, A risultante = √(A<sub>1</sub>² + A<sub>2</sub>² + 2A<sub>1</sub>A<sub>2</sub> cos φ). Se φ = 180° e A<sub>1</sub> ≠ A<sub>2</sub>, resta |A<sub>1</sub>-A<sub>2</sub>|. Una cancellazione locale non dimostra energia totale nulla: servono anche il moto e la distribuzione spaziale del campo o del mezzo.',L,y)-20
y=section('→','Come conservare il lavoro',y)
y=text('Stampa le prime cinque pagine oppure annota questo PDF. Puoi importarlo come materiale in Ardesia Next: il PDF resta il documento di partenza e le nuove annotazioni appartengono allo spazio di studio. Il companion macOS oggi esporta PDF dai propri quaderni, ma non importa questo PDF come sfondo.',L,y)-9
y=text('Scrivi data, configurazione e correzione del ragionamento. Questo quaderno non assegna un livello di competenza, non invia risposte e non è una prova ufficiale. I contenuti restano DRAFT: revisione AI e controlli numerici non sostituiscono l’approvazione scientifica umana.',L,y)-16
y=text('Fonti: modelli originali Ardesia dei laboratori C1-C5; lezioni canoniche sf-2026-u2-04, sf-2026-u3-04, sf-2026-u5-04, sf-2026-u6-04 e sf-2026-u4-02. Perimetro didattico: syllabus MUR Fisica 2026/27, disponibile nei riferimenti dell’anteprima. Licenza dei testi: patrimonio originale Ardesia, tutti i diritti riservati.',L,y,style='small')
footer();c.save()
# Preserve the embedded typefaces' notice inside the distributable PDF.
from pypdf import PdfReader,PdfWriter
writer=PdfWriter(clone_from=PdfReader(out))
writer.add_attachment('FONT-LICENSE.txt',(ROOT/'FONT-LICENSE.txt').read_bytes())
with out.open('wb') as stream:writer.write(stream)

assert page==7
assert all(row['bottom']>54 for row in layout),min(layout,key=lambda row:row['bottom'])
(ROOT/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n')
(ROOT/'artifact.json').write_text(json.dumps({'file':out.name,'pages':page,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'draft':True,'humanApproval':False},indent=2)+'\n')
print(out)
