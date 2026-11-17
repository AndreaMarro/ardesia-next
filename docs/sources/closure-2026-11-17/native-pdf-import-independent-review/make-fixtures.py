from pathlib import Path
p=Path(__file__).resolve().parent/'fixtures';p.mkdir(exist_ok=True)
def pdf(name,crop='20 40 320 140',rotation=0,inherit=False,annotation=False):
 geom=f'/MediaBox [20 40 420 240] /CropBox [{crop}] /Rotate {rotation}'
 content='1 0 1 rg 20 40 400 200 re f\n1 0 0 rg 20 40 150 50 re f\n0 1 0 rg 170 40 150 50 re f\n0 0 1 rg 20 90 150 50 re f\n1 1 0 rg 170 90 150 50 re f\n0 0 0 rg BT /F1 10 Tf 40 100 Td (INDEPENDENT) Tj ET\n'
 objects=['<< /Type /Catalog /Pages 2 0 R >>',f'<< /Type /Pages /Count 1 /Kids [3 0 R] {geom if inherit else ""} >>',f'<< /Type /Page /Parent 2 0 R {"" if inherit else geom} /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',f'<< /Length {len(content)} >>\nstream\n{content}endstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
 s='%PDF-1.7\n';offsets=[]
 for i,o in enumerate(objects,1):offsets.append(len(s.encode()));s+=f'{i} 0 obj\n{o}\nendobj\n'
 start=len(s.encode());s+='xref\n0 6\n0000000000 65535 f \n'+''.join(f'{x:010d} 00000 n \n' for x in offsets)+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'
 (p/name).write_bytes(s.encode())
for angle in [0,90,180,270,-90,450]:pdf(f'rotation-{angle}.pdf',rotation=angle,inherit=True)
pdf('partial-crop.pdf',crop='-80 -60 320 140')
pdf('crop-overflow.pdf',crop='20 40 320 140')
pdf('invalid-rotation.pdf',rotation=1)
pdf('no-intersection.pdf',crop='1000 1000 1100 1100')
print(p)
