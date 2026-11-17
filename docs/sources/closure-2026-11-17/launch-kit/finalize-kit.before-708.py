#!/usr/bin/env python3
"""Freeze only a matching, already-public GitHub ZIP into an unsent launch kit."""
import argparse, datetime, hashlib, html.parser, io, json, pathlib, re, urllib.request, zipfile

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
            if 'export-readable' not in page.ids: raise ValueError('Readable report feature is absent: use its matching historical kit instead')
            editions.append({'label':label,'examId':exam['id'],'questions':31,'sourceSha256':source['sourceSha256']})
        for required in ['index.html','exam.js','urti.html','urti.js','campo.html','campo.js','LEGGIMI.txt']:
            if required not in names: raise ValueError('Missing reviewed resource: '+required)
        return {'lessons':len(pages),'lessonQuestions':count,'editions':editions,'offlineFiles':len(names),'readableReport':True}

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
    receipt={'status':'DRAFT_NOT_SENT','sourceCommit':args.sha,'url':url,'checkedAt':checked,'httpStatus':status,'authenticated':False,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'publicBytesMatch':True,'contactSourceSha256':hashlib.sha256(contact_source).hexdigest(),'inventory':facts,'scope':'Public-download identity and measured inventory only; not CI, deployment, human approval, sales or delivery of a paid service.'}
    phone=contact['display']; email=contact['email']; count=facts['lessonQuestions']
    intro=f'''**La fisica comincia con un perché.**\n\nCinque percorsi di Fisica per il semestre aperto di Medicina: 38 lezioni consultabili, {count} problemi e verifiche nelle lezioni, laboratori interattivi e due prove originali da 31 domande.\n\n[Scarica l’anteprima gratuita]({url}). Dal computer, estrai tutto lo ZIP e apri `index.html` nel browser. Alla fine di una prova puoi salvare un ripasso leggibile con risposte e spiegazioni e riaprirlo offline.\n\nI contenuti sono in revisione scientifica. Le prove sono strumenti di allenamento indipendenti, non esami ufficiali. Per conoscere disponibilità, accesso e condizioni dei percorsi con Andrea Marro, scrivi al **{phone}** oppure a **{email}**. La richiesta non comporta acquisti o prenotazioni.\n'''
    instructions=f'''# Comincia dall’anteprima\n\n1. [Scarica lo ZIP]({url}) sul computer ed estrai **tutti** i file in una cartella. Non aprire le pagine direttamente dall’anteprima dello ZIP.\n2. Apri `index.html` nel browser. Scegli C1–C5, apri il programma del percorso e seleziona una lezione. Mantieni insieme i file estratti.\n3. Per allenarti apri la prova A (`simulazione.html`) o B (`simulazione-b.html`): allenamento libero oppure 50 minuti. Le interazioni richiedono JavaScript.\n4. Alla consegna scegli **Salva il ripasso leggibile**. Il file HTML scaricato è autonomo: riaprilo anche senza rete oppure usa Stampa nel browser per ottenere un PDF.\n\nLa pagina non salva automaticamente: usa i pulsanti di salvataggio disponibili prima di chiuderla. Il ripasso è una copia personale; condividilo solo se lo desideri. Fonti, contatti e spazio Ardesia online richiedono rete; l’accesso a lavagna e servizi online viene fornito separatamente. L’apertura diretta da gestori file di telefoni/tablet non è stata verificata.\n\n**Anteprima in revisione**, non esame ufficiale e non iscrizione a un corso. Informazioni: {phone} · {email}.\n'''
    owner=f'''# Kit 16 novembre — bozza non inviata\n\nIl collegamento di `testo-pronto.md` identifica uno ZIP anonimo verificato byte per byte il {checked}. Non inoltrare varianti con URL di preview protetti da SSO come se fossero demo pubbliche.\n\nProposta sostenuta: anteprima gratuita offline + richiesta informativa non vincolante. Sono presenti 38 lezioni, {count} problemi/verifiche e due prove da31domande; non sommare questi numeri chiamandoli quiz certificati. Contenuti DRAFT/humanApproval=false. Il ripasso HTML conserva spiegazioni; un eventuale checkpoint di una prova in corso richiede propria verifica e istruzioni, non è inferito da questo kit.\n\nPrima di proporre una vendita restano da definire l’offerta effettiva e la consegna applicabile: cosa è incluso, durata/accesso, calendario, prezzo e condizioni. Non sono attestati checkout, iscrizioni, pagamenti, risultati didattici, revisione umana, app iPad o sincronizzazione. Il companion macOS locale non è incluso né promesso da questi testi.\n\nSorgente pubblicata: `{args.sha}`. ZIP: {len(data)}byte, SHA256 `{receipt['sha256']}`. Evidenza dettagliata in `public-download-evidence.json`. Una modifica a URL/versione richiede nuova verifica: aggiornare insieme inventario, link e copy.\n\nI testi sono preparati per revisione del titolare; nessun messaggio è stato inviato.\n'''
    output.mkdir(parents=True,exist_ok=True)
    for name,text in [('testo-pronto.md',intro),('istruzioni-studente.md',instructions),('README.md',owner)]: (output/name).write_text(text)
    (output/'public-download-evidence.json').write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n')
    (output/'contact.json').write_bytes(contact_source)
    print(json.dumps({'output':str(output),'sourceCommit':args.sha,'sha256':receipt['sha256'],'files':5,'status':'DRAFT_NOT_SENT'},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['sha','zip','contact','output']: p.add_argument('--'+name,required=True)
    finalize(p.parse_args())
