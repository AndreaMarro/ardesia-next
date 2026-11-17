import contextlib, importlib.util, io, json, pathlib, tempfile, types, zipfile
from unittest.mock import patch
root=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('finalize',root/'finalize-kit.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data=(root/'708-source.zip').read_bytes();facts=m.inventory(data);checks=[]
def ok(name,v):
 assert v,name
 checks.append({'name':name,'pass':True})
def rewritten(change):
 out=io.BytesIO()
 with zipfile.ZipFile(io.BytesIO(data)) as src,zipfile.ZipFile(out,'w') as dest:
  for name in src.namelist():
   value=change(name,src.read(name))
   if value is not None:dest.writestr(name,value)
 return out.getvalue()
def reject(name,b):
 try:m.inventory(b)
 except (ValueError,KeyError,zipfile.BadZipFile):checks.append({'name':name,'pass':True});return
 raise AssertionError(name+' accepted')
ok('current inventory',facts['lessons']==38 and facts['lessonQuestions']==279 and len(facts['labs'])==5 and facts['workbook']['pages']==7 and facts['offlineFiles']==65)
reject('prior launch ZIP without checkpoint', (root.parent/'candidate.zip').read_bytes())
reject('malformed ZIP',b'not a zip')
reject('missing thermodynamics script',rewritten(lambda n,b:None if n=='termodinamica.js' else b))
reject('missing wave comparison control',rewritten(lambda n,b:b.replace(b'id="wave-cancelled"',b'id="removed"') if n=='c5.html' else b))
reject('missing resume input',rewritten(lambda n,b:b.replace(b'id="resume-file"',b'id="removed"') if n=='simulazione-b.html' else b))
reject('changed workbook rejected',rewritten(lambda n,b:b+b'\n' if n=='quaderno-esperimenti.pdf' else b))
reject('human approval cannot be invented',rewritten(lambda n,b:b.replace(b'"humanApproval":false',b'"humanApproval":true') if n=='simulazione.html' else b))
preview=root.parents[1]/'launch-kit-708-preview';receipt=json.loads((preview/'public-download-evidence.json').read_text())
ok('five generated files',len(list(preview.iterdir()))==5)
ok('public immutable SHA and bytes verified',receipt['publicBytesMatch'] is True and receipt['authenticated'] is False and receipt['httpStatus']==200 and receipt['sourceCommit']=='708f5a9c54d60043f7b06a7d87ea1e8b50f84922' and receipt['inventory']==facts)
text=(preview/'istruzioni-studente.md').read_text();intro=(preview/'testo-pronto.md').read_text()
for term in ['tutti','index.html','stessa prova A/B e della stessa edizione','scadenza originale','non si mette in pausa','JSON del risultato finale non servono a riprendere','quaderno-esperimenti.pdf','7 pagine','DRAFT','revisione scientifica umana pendente']:
 ok('student instruction '+term,term in text)
for _,_,name,_ in m.LABS:ok('lab entry '+name,name in text)
ok('no sale call to action',all(term not in intro.lower() for term in ['checkout','acquista','prenota ora','€','prezzo']))
ok('no app promise','macOS' not in intro and 'iPad' not in intro)
with tempfile.TemporaryDirectory(dir=root,prefix='negative-') as temp:
 folder=pathlib.Path(temp);output=folder/'kit';args=types.SimpleNamespace(sha='708f5a9c54d60043f7b06a7d87ea1e8b50f84922',zip=str(root/'708-source.zip'),contact=str(root/'708-contact.json'),output=str(output))
 class DifferentResponse:
  status=200
  def __enter__(self):return self
  def __exit__(self,*unused):pass
  def read(self,n):return b'different bytes'
 with patch.object(m.urllib.request,'urlopen',return_value=DifferentResponse()):
  try:m.finalize(args)
  except ValueError:pass
  else:raise AssertionError('mismatch accepted')
 ok('download mismatch writes nothing',not output.exists())
 args.sha='708f5a9'
 with patch.object(m.urllib.request,'urlopen') as call:
  try:m.finalize(args)
  except ValueError:pass
  else:raise AssertionError('short SHA accepted')
  ok('short SHA rejected before network/write',call.call_count==0 and not output.exists())
 args.sha='708f5a9c54d60043f7b06a7d87ea1e8b50f84922';args.output=str(preview)
 with patch.object(m.urllib.request,'urlopen') as call:
  try:m.finalize(args)
  except ValueError:pass
  else:raise AssertionError('overwrite allowed')
  ok('existing preview never overwritten',call.call_count==0)
(root/'checks-708.json').write_text(json.dumps({'checks':checks,'count':len(checks),'allPass':True},indent=2,ensure_ascii=False)+'\n')
print('PASS',len(checks),'checks')
