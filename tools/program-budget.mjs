/** Resource policy v7: 336 KiB aggregate core for public practice and field lab (ADR0025).
 * v6 allowed 320 KiB for complete handout export (ADR0023).
 * v5 allowed 312 KiB for canonical notebooks (ADR0022).
 * v3 separated the lazy PDF runtime; v4 allowed 304 KiB for continuity/courses.
 * Initial JS, optional Program/PDF caps and asset classification are unchanged. */
export const PROGRAM_BUDGET = Object.freeze({coreGzipBytes:336*1024,initialJavaScriptGzipBytes:240*1024,optionalGzipBytes:320*1024,optionalRawBytes:1024*1024,pdfGzipBytes:3*1024*1024,pdfRawBytes:6*1024*1024});
export function isOptionalProgramAsset(file){
  return /^program-runtime\/[a-zA-Z0-9_.-]+\.(?:js|wasm)$/.test(file)
    || /^assets\/(?:ProgramSurface|program-example)-[a-zA-Z0-9_-]+\.js$/.test(file);
}
export function isOptionalPdfAsset(file){return /^assets\/(?:pdf-engine|pdf\.worker\.min)-[a-zA-Z0-9_-]+\.m?js$/.test(file)||/^pdf-runtime\/(?:cmaps|standard_fonts|wasm)\/[a-zA-Z0-9_.-]+$/.test(file);}
export function programBudgetTotals(files){
  const sum=(items,key)=>items.reduce((total,file)=>total+file[key],0);
  const optional=files.filter(file=>isOptionalProgramAsset(file.file)),pdf=files.filter(file=>isOptionalPdfAsset(file.file)),core=files.filter(file=>!isOptionalProgramAsset(file.file)&&!isOptionalPdfAsset(file.file));
  return {initialJavaScriptGzipBytes:sum(files.filter(file=>file.initial&&/\.m?js$/.test(file.file)),'gzipBytes'),coreGzipBytes:sum(core,'gzipBytes'),optionalGzipBytes:sum(optional,'gzipBytes'),optionalRawBytes:sum(optional,'rawBytes'),pdfGzipBytes:sum(pdf,'gzipBytes'),pdfRawBytes:sum(pdf,'rawBytes'),
    allJavaScriptGzipBytes:sum(files.filter(file=>/\.m?js$/.test(file.file)),'gzipBytes'),allWasmGzipBytes:sum(files.filter(file=>file.file.endsWith('.wasm')),'gzipBytes'),
    allRawBytes:sum(files,'rawBytes'),allGzipBytes:sum(files,'gzipBytes')};
}
export function programBudgetMatches(report){
  const validInt=n=>Number.isSafeInteger(n)&&n>0;
  if(report?.metric!=='core-and-optional-runtimes-v3'||!Array.isArray(report.files)||!report.files.length)return false;
  const files=report.files;
  if(new Set(files.map(file=>file.file)).size!==files.length||files.some(file=>typeof file.file!=='string'||!(/\.(?:m?js|wasm)$/.test(file.file)||isOptionalPdfAsset(file.file))
    ||!validInt(file.gzipBytes)||!validInt(file.rawBytes)||typeof file.initial!=='boolean'||(isOptionalProgramAsset(file.file)||isOptionalPdfAsset(file.file))&&file.initial))return false;
  if(!files.some(file=>file.file==='program-runtime/worker.js')||files.filter(file=>isOptionalProgramAsset(file.file)&&file.file.endsWith('.wasm')).length!==1
    ||!files.some(file=>/^program-runtime\/.+\.wasm$/.test(file.file)))return false;
  const totals=programBudgetTotals(files);
  if(Object.entries(totals).some(([key,value])=>report[key]!==value)||Object.entries(PROGRAM_BUDGET).some(([key,value])=>report.limits?.[key]!==value))return false;
  return totals.initialJavaScriptGzipBytes<=PROGRAM_BUDGET.initialJavaScriptGzipBytes&&totals.coreGzipBytes<=PROGRAM_BUDGET.coreGzipBytes&&totals.optionalGzipBytes<=PROGRAM_BUDGET.optionalGzipBytes&&totals.optionalRawBytes<=PROGRAM_BUDGET.optionalRawBytes&&totals.pdfGzipBytes<=PROGRAM_BUDGET.pdfGzipBytes&&totals.pdfRawBytes<=PROGRAM_BUDGET.pdfRawBytes;
}
