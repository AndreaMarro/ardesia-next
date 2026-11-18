const {chromium,devices} = require(process.cwd()+'/node_modules/@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = process.argv[2];
const url = process.argv[3] ?? 'http://127.0.0.1:4182/fisica/';
const manifest = JSON.parse(fs.readFileSync('apps/web/public/fisica/practice-manifest.json'));
const profiles = [
  ['desktop',{viewport:{width:1440,height:960}}],
  ['smartphone',{...devices['Pixel 7'],viewport:{width:360,height:800}}],
  ['ipad-verticale',{...devices['iPad (gen 7)']}],
  ['ipad-orizzontale',{...devices['iPad (gen 7) landscape']}]
];
async function runProfile(browser, [profile, options]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(4500);
  const exercised = [], problems=[], errors=[];
  let figures = 0, equationChecks = 0;
  page.on('pageerror', error=>errors.push(error.message));
  try {
    for (const row of manifest.rows) {
      const exercise = page.locator('#'+row.id);
      try {
        const response = await page.goto(new URL(row.lesson+'#'+row.id,url).href);
        assert.equal(response?.status()??200,200);
        await exercise.locator(':scope > summary').waitFor();
        assert.equal(await exercise.getAttribute('open'),'');
        const hint = exercise.locator('.reviewed-hint summary').first();
        const check = exercise.getByRole('button',{name:'Controlla la risposta'});
        const feedback = exercise.locator('output');
        await (options.hasTouch?hint.tap():hint.click());
        await exercise.locator('.reviewed-hint[open]').waitFor();
        assert.equal(await exercise.locator('.reviewed-solution').getAttribute('open'),null);
        const form = exercise.locator('form');
        const expected = JSON.parse(await form.getAttribute('data-practice-answer'));
        if (expected.kind==='choice') {
          const wrong = expected.id==='A'?'B':'A';
          await form.locator('input[value='+wrong+']').check();
          await check.click();
          assert.equal(await feedback.innerText(),'Rivedi la scelta.');
          assert.equal(await form.locator('[data-practice-option]:visible').count(),1);
          await form.locator('input[value='+expected.id+']').check();
        } else {
          await form.locator('input[name=answer]').fill('1/0');
          await check.click();
          assert.notEqual(await feedback.innerText(),'Risposta corretta.');
          await form.locator('input[name=answer]').fill(expected.exact??expected.accepted[0]);
        }
        await check.click();
        assert.equal(await feedback.innerText(),'Risposta corretta.');
        const reveal = exercise.locator('.reviewed-solution summary');
        await (options.hasTouch?reveal.tap():reveal.press('Enter'));
        assert.ok(await exercise.locator('.reviewed-solution p:visible').count()>1);
        const measurements = await exercise.evaluate(el=>{
          const forms=el.querySelector('form');
          const math=[...el.querySelectorAll('.practice-math')].filter(node=>node.clientWidth>0);
          const svgs=[...el.querySelectorAll('figure svg')];
          const outOfBounds=svgs.flatMap(svg=>[...svg.querySelectorAll('text')].flatMap(node=>{
            const b=node.getBBox();
            return b.x <0 || b.y <0 || b.x+b.width>400 || b.y+b.height>180 ? [node.textContent] : [];
          }));
          return {
            width:document.documentElement.scrollWidth,viewport:innerWidth,
            formWidth:forms.scrollWidth,formClient:forms.clientWidth,
            equations:math.length, mathTooWide:math.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.querySelector('annotation')?.textContent),
            figures:svgs.length,outOfBounds
          };
        });
        assert.equal(measurements.figures,row.stagedFigure?2:row.figure?1:0);
        assert.deepEqual(measurements.outOfBounds,[]);
        assert.ok(measurements.width<=measurements.viewport+1&&measurements.formWidth<=measurements.formClient+1&&measurements.mathTooWide.length===0,JSON.stringify(measurements));
        if (row.id==='u7-absorbed-radiant-power-13') {
          await exercise.locator('.reviewed-solution').evaluate(node=>node.scrollIntoView({block:'start'}));
          await page.screenshot({path:output+'/'+profile+'.png'});
        }
        exercised.push(row.id);
        figures+=measurements.figures;
        equationChecks+=measurements.equations;
      } catch (error) {
        problems.push([row.id,error.message]);
      }
    }
  } finally {await context.close();}
  return {profile,exercised,figures,equationChecks,problems,errors};
}
(async()=>{
 const browser=await chromium.launch();
 try {
  const results=await Promise.all(profiles.map(profile=>runProfile(browser, profile)));
  fs.writeFileSync(output+'/browser-grid.json',JSON.stringify(results,null,2)+'\n');
  for(const {exercised, ...rest} of results)console.log(JSON.stringify({exercised:exercised.length,...rest}));
  if(results.some(x=>x.problems.length||x.errors.length))process.exitCode=1;
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
