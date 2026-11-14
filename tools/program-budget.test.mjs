import test from 'node:test';
import assert from 'node:assert/strict';
import {PROGRAM_BUDGET,programBudgetTotals,programBudgetMatches} from './program-budget.mjs';

const fixture=()=>{
  const files=[
    {file:'assets/index-main.js',rawBytes:500000,gzipBytes:220000,initial:true},
    {file:'plugins/example/plugin.js',rawBytes:10000,gzipBytes:9000,initial:false},
    {file:'assets/ProgramSurface-ui.js',rawBytes:10000,gzipBytes:5000,initial:false},
    {file:'program-runtime/worker.js',rawBytes:150000,gzipBytes:50000,initial:false},
    {file:'program-runtime/engine.wasm',rawBytes:500000,gzipBytes:200000,initial:false},
  ];
  return {metric:'core-and-optional-runtimes-v3',files,limits:PROGRAM_BUDGET,...programBudgetTotals(files)};
};
test('program budget retains the total cost and the initial threshold and explicit product total',()=>{
  const report=fixture();assert.equal(programBudgetMatches(report),true);
  assert.equal(report.coreGzipBytes,229000);assert.equal(report.optionalGzipBytes,255000);assert.equal(report.allGzipBytes,484000);
  report.files[1].gzipBytes=PROGRAM_BUDGET.coreGzipBytes-220000+1;Object.assign(report,programBudgetTotals(report.files));assert.equal(programBudgetMatches(report),false);
});
test('program budget refuses eager interpreter, missing WASM, forged totals, duplicates and raised caps',()=>{
  for(const change of [r=>{r.files[0].gzipBytes=250000;Object.assign(r,programBudgetTotals(r.files));},r=>{r.files[3].initial=true;},r=>{r.files.pop();},r=>{r.allGzipBytes--;},r=>{r.files.push(r.files[0]);},r=>{r.limits={...r.limits,coreGzipBytes:r.limits.coreGzipBytes+1};},r=>{r.files[4].rawBytes=2e6;Object.assign(r,programBudgetTotals(r.files));}]){
    const report=fixture();change(report);assert.equal(programBudgetMatches(report),false);
  }
});

test('PDF costs include worker mjs and support files, never permit eager loading or reclassification of existing assets',()=>{
 const report=fixture();report.files.push({file:'assets/pdf-engine-abc.js',rawBytes:450000,gzipBytes:140000,initial:false},{file:'assets/pdf.worker.min-abc.mjs',rawBytes:1300000,gzipBytes:400000,initial:false},{file:'pdf-runtime/cmaps/test.bcmap',rawBytes:2000,gzipBytes:1000,initial:false});Object.assign(report,programBudgetTotals(report.files));
 assert.equal(report.pdfGzipBytes,541000);assert.equal(report.allJavaScriptGzipBytes,824000);assert.equal(programBudgetMatches(report),true);
 report.files.at(-2).initial=true;Object.assign(report,programBudgetTotals(report.files));assert.equal(programBudgetMatches(report),false);
});
