/** Original synthetic three-page PDF with real xref offsets, no external material. */
export function pdfFixture(){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>'];
  for(let i=1;i<=3;i++){
    const text=`BT /F1 24 Tf 50 700 Td (Materiale Ardesia - pagina ${i}) Tj ET\n0.2 0.4 0.3 rg 50 500 200 90 re f\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 9 0 R >> >> /Contents ${objects.length+2} 0 R >>`,`<< /Length ${text.length} >>\nstream\n${text}endstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let body='%PDF-1.7\n',offsets=[0];
  for(const [i,value] of objects.entries()){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${value}\nendobj\n`;}
  const xref=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');
  body+=`trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
