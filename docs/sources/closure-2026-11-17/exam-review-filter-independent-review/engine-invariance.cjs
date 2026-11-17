const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');const root=__dirname;
const read=f=>{const ctx={module:{exports:{}},TextEncoder};vm.runInNewContext(fs.readFileSync(f,'utf8'),ctx);return ctx.module.exports};
const before=read(path.join(root,'../exam-resume-independent-review/candidate/tools/physics-runtime/exam.js')),after=read(path.join(root,'candidate/tools/physics-runtime/exam.js'));
assert.deepEqual(Object.keys(after),Object.keys(before));const results=Object.keys(before).map(name=>{assert.equal(String(after[name]),String(before[name]),name);return{name,identical:true}});fs.writeFileSync(path.join(root,'engine-invariance.json'),JSON.stringify(results,null,2));console.log(results.length+' exported engine functions identical');
