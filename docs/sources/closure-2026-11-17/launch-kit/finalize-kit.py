#!/usr/bin/env python3
"""Freeze only a matching, already-public GitHub ZIP into an unsent launch kit."""
import argparse, datetime, hashlib, html.parser, io, json, pathlib, re, urllib.request, zipfile

# Seven-page workbook independently reviewed in docs/media/physics-workbook/artifact.json.
# A replacement PDF requires an updated review and identity, not an inferred page count.
WORKBOOK_SHA256 = '7d91231930f53ade5ac7b2661bece8605e81b295d68f217c6881d6cd4cc70043'
LABS = [
    ('C1', 'Urti: quantità di moto ed energia', 'urti.html', ['m1', 'm2', 'u1', 'u2']),
    ('C2', 'Flusso nei tubi: legge di Poiseuille', 'index.html', ['laboratorio', 'radius']),
    ('C3', 'Trasformazioni termodinamiche', 'termodinamica.html', ['volume', 'pressure']),
    ('C4', 'Campo elettrico', 'campo.html', ['charge', 'separation', 'probe-x', 'probe-y']),
    ('C5', 'Sovrapposizione di onde', 'c5.html', ['interferenza', 'wave-aligned', 'wave-shifted', 'wave-cancelled', 'wave-unequal']),
]

class Page(html.parser.HTMLParser):
    def __init__(self, text):
        super().__init__(); self.questions=0; self.ids=set(); self.data=[]; self.in_data=False; self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.questions += 'reader-question' in a.get('class','').split()
        if a.get('id'): self.ids.add(a['id'])
        if tag=='script' and a.get('id')=='exam-data': self.in_data=True
    def handle_endtag(self, tag):
        if tag=='script': self.in_data=False
    def handle_data(self, text):
        if self.in_data: self.data.append(text)

def inventory(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        entries=z.infolist()
        if len(entries)>256 or sum(x.file_size for x in entries)>16*1024*1024 or any(x.file_size>2*1024*1024 for x in entries):
            raise ValueError('ZIP exceeds reviewed resource limits')
        if z.testzip() is not None: raise ValueError('ZIP CRC failure')
        names=z.namelist()
        if len(names)!=len(set(names)) or any(n.startswith('/') or '..' in pathlib.PurePosixPath(n).parts for n in names): raise ValueError('Unsafe/duplicate ZIP paths')
        pages=[n for n in names if re.fullmatch(r'sf-2026-u[1-7]-\d{2}\.html',n)]
        if len(pages)!=38: raise ValueError('Expected reviewed 38-lesson edition')
        count=sum(Page(z.read(n).decode('utf8')).questions for n in pages)
        editions=[]
        for label,name in [('A','simulazione.html'),('B','simulazione-b.html')]:
            page=Page(z.read(name).decode('utf8')); source=json.loads(''.join(page.data)); exam=source['exam']
            if exam['status']!='DRAFT' or exam['humanApproval'] is not False or len(exam['questions'])!=31 or exam['durationMinutes']!=50: raise ValueError('Unexpected exam/status')
            if sum(q['type']=='choice' for q in exam['questions'])!=21 or sum(q['type']=='completion' for q in exam['questions'])!=10 or not re.fullmatch('[a-f0-9]{64}',source['sourceSha256']): raise ValueError('Unexpected exam format/provenance')
            if not {'export-readable','export-result','save-attempt','resume-file'}.issubset(page.ids): raise ValueError('Reviewed report/resume controls absent: use the matching historical kit')
            editions.append({'label':label,'examId':exam['id'],'questions':31,'sourceSha256':source['sourceSha256']})
        for required in ['index.html','exam.js','demo.js','demo.css','urti.html','urti.js','campo.html','campo.js','termodinamica.html','termodinamica.js','quaderno-esperimenti.pdf','LEGGIMI.txt']:
            if required not in names: raise ValueError('Missing reviewed resource: '+required)
        labs=[]
        for course,title,file,ids in LABS:
            if not set(ids).issubset(Page(z.read(file).decode('utf8')).ids): raise ValueError('Missing reviewed lab controls: '+course)
            labs.append({'course':course,'title':title,'file':file})
        pdf=z.read('quaderno-esperimenti.pdf'); digest=hashlib.sha256(pdf).hexdigest()
        if digest!=WORKBOOK_SHA256: raise ValueError('Workbook differs from the reviewed seven-page PDF; update its review first')
        return {'lessons':len(pages),'lessonQuestions':count,'editions':editions,'offlineFiles':len(names),'readableReport':True,'explicitAttemptFile':True,'labs':labs,'workbook':{'file':'quaderno-esperimenti.pdf','pages':7,'sha256':digest,'bytes':len(pdf),'draft':True,'humanApproval':False}}

def finalize(args):
    if not re.fullmatch('[a-f0-9]{40}',args.sha): raise ValueError('Use the complete immutable Git commit SHA')
    output=pathlib.Path(args.output)
    if output.exists() and any(output.iterdir()): raise ValueError('Output must be a new or empty directory')
    data=pathlib.Path(args.zip).read_bytes(); facts=inventory(data)
    contact_source=pathlib.Path(args.contact).read_bytes(); contact=json.loads(contact_source)['contact']
    if not re.fullmatch(r'\d{8,15}',contact['whatsapp']) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',contact['email']): raise ValueError('Invalid versioned contact')
    url=f'https://raw.githubusercontent.com/AndreaMarro/ardesia-next/{args.sha}/apps/web/public/fisica/ardesia-prova-fisica-offline.zip'
    request=urllib.request.Request(url,headers={'User-Agent':'Ardesia-release-artifact-check/1'})
    with urllib.request.urlopen(request,timeout=30) as response:
        status=response.status; downloaded=response.read(len(data)+1)
    if status!=200 or downloaded!=data: raise ValueError('Anonymous public ZIP is not byte-identical; no kit was written')
    checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
    receipt={'status':'DRAFT_NOT_SENT','sourceCommit':args.sha,'url':url,'checkedAt':checked,'httpStatus':status,'authenticated':False,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'publicBytesMatch':True,'contactSourceSha256':hashlib.sha256(contact_source).hexdigest(),'generatorSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'inventory':facts,'scope':'Public-download identity and measured inventory only; not CI, deployment, human approval, sales or delivery of a paid service.'}
    phone=contact['display']; email=contact['email']; count=facts['lessonQuestions']
    intro=f'''**La fisica comincia con un perché.**

Esplora l’anteprima gratuita di cinque percorsi di Fisica per il semestre aperto di Medicina: 38 lezioni, {count} problemi e verifiche nelle lezioni e due prove originali da 31 domande.

Prevedi, osserva, spiega: cinque laboratori su urti, flusso nei tubi, trasformazioni termodinamiche, campo elettrico e sovrapposizione di onde. Un quaderno PDF di 7 pagine accompagna gli esperimenti. Puoi salvare su file una prova in corso e, alla consegna, conservare il ripasso con risposte e spiegazioni.

[Scarica l’anteprima gratuita]({url}). Dal computer, estrai **tutto lo ZIP** e apri `index.html` nel browser.

**Contenuti DRAFT, con revisione scientifica umana ancora da completare.** Le prove sono allenamenti indipendenti, non esami ufficiali. Per informazioni sui percorsi con Andrea Marro: **{phone}** · **{email}**. La richiesta è non vincolante e non comporta acquisti o prenotazioni.
'''
    instructions=f'''# Comincia dall’anteprima

1. [Scarica lo ZIP]({url}) sul computer ed estrai **tutti** i file in una cartella. Non aprire le pagine dall’anteprima dello ZIP.
2. Apri `index.html` nel browser. Scegli C1–C5, apri il programma e una lezione. Mantieni insieme i file estratti.
3. Prova i cinque laboratori indicati sotto. Apri anche `quaderno-esperimenti.pdf`: 7 pagine da stampare e annotare con previsioni, osservazioni e confronti.
4. Apri la prova A (`simulazione.html`) o B (`simulazione-b.html`): allenamento libero oppure 50 minuti.
5. Per interrompere e riprendere, durante la prova scegli **Salva il tentativo**. Conserva il JSON scaricato; alla riapertura della **stessa prova A/B e della stessa edizione**, scegli **Riprendi un tentativo salvato** e seleziona quel file. La pagina non salva automaticamente: ogni nuova risposta richiede un nuovo salvataggio. Il timer **non si mette in pausa**: resta la scadenza originale, anche a pagina chiusa. Se è già scaduto, la prova viene consegnata subito.
6. Alla consegna scegli **Salva il ripasso leggibile**. Il file HTML è autonomo: riaprilo offline oppure usa Stampa nel browser per ottenere un PDF. **Il ripasso HTML e il JSON del risultato finale non servono a riprendere la prova**: per quello occorre il JSON scaricato durante il tentativo.

| Percorso | Esperimento | Apri nello ZIP estratto |
| --- | --- | --- |
| C1 | Urti: quantità di moto ed energia | `urti.html` |
| C2 | Flusso nei tubi: legge di Poiseuille | `index.html`, sezione laboratorio |
| C3 | Trasformazioni termodinamiche | `termodinamica.html` |
| C4 | Campo elettrico | `campo.html` |
| C5 | Sovrapposizione di onde: quattro casi da confrontare | `c5.html`, sezione «Due onde. Una somma da prevedere.» |

Le prove e i laboratori dinamici richiedono JavaScript. Fonti e contatti esterni richiedono rete. I file delle tue risposte sono personali e modificabili: non certificano identità, tempi o punteggi. Condividili solo se lo desideri. L’apertura diretta da gestori file di telefoni/tablet non è stata verificata.

**Anteprima DRAFT, revisione scientifica umana pendente.** Non è un esame ufficiale né un’iscrizione a un corso. Informazioni: {phone} · {email}.
'''
    owner=f'''# Kit Fisica — chiusura del 17 novembre, bozza non inviata

Proposta sostenuta: anteprima gratuita offline + richiesta informativa non vincolante. Il link identifica lo ZIP GitHub verificato senza autenticazione, byte per byte, il {checked}. La verifica non riguarda CI o deployment Vercel.

Contenuto: 38 lezioni, {count} problemi/verifiche nelle lezioni, cinque laboratori, quaderno PDF di 7 pagine, prove A/B da 31 domande con salvataggio manuale del tentativo e ripasso HTML finale. Non sommare le quantità chiamandole quiz certificati. Contenuti DRAFT, `humanApproval=false`; revisione scientifica umana da completare. Le istruzioni distinguono checkpoint JSON, risultato JSON e ripasso HTML e descrivono stessa edizione e scadenza originale.

Prima di un’offerta a pagamento servono condizioni e modalità di consegna definite. Questo kit non attesta acquisti, prenotazioni, pagamenti o risultati didattici. Le applicazioni native, l’importazione PDF nel companion macOS, l’accesso Core e la sincronizzazione non sono inclusi nell’anteprima descritta. L’obiettivo originario del 16 novembre è trascorso: non è attestato un lancio commerciale completo.

Sorgente pubblicata: `{args.sha}`. ZIP: {len(data)} byte, SHA-256 `{receipt['sha256']}`. Evidenza in `public-download-evidence.json`; include anche identità del generatore e del quaderno. Una nuova versione richiede un nuovo kit con link, inventario e verifica aggiornati. Non sostituire il link con una preview protetta da SSO presentandola come demo pubblica.

Testi preparati per revisione del titolare. Nessun messaggio o post è stato inviato.
'''
    output.mkdir(parents=True,exist_ok=True)
    for name,text in [('testo-pronto.md',intro),('istruzioni-studente.md',instructions),('README.md',owner)]: (output/name).write_text(text)
    (output/'public-download-evidence.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
    (output/'contact.json').write_bytes(contact_source)
    print(json.dumps({'output':str(output),'sourceCommit':args.sha,'sha256':receipt['sha256'],'files':5,'status':'DRAFT_NOT_SENT'},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['sha','zip','contact','output']: p.add_argument('--'+name,required=True)
    finalize(p.parse_args())
