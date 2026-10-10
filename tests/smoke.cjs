const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async()=>{
 const server=http.createServer((req,res)=>{
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
   res.end(fs.readFileSync('index.html'));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 // Verify the fixed world map is symmetric before browser interactions.
 const positions=[[-1,0],[1,0],[0,-1],[0,0],[0,1]];
 const dirs={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
 for(let i=0;i<positions.length;i++)for(const [d,[dx,dy]] of Object.entries(dirs)){
  const j=positions.findIndex(([x,y])=>x===positions[i][0]+dx&&y===positions[i][1]+dy);
  if(j!==-1)assert.notEqual(j,i,'No room connects to itself');
 }
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=()=>assert.deepEqual(errors,[],'Browser JavaScript errors');
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('education-rpg-v28')));
 try{
  await page.goto(url);
  assert.match(await page.locator('h1').innerText(),/v2\.8/);
  assert.match(await page.locator('#message').innerText(),/阿甘的來信/);
  await page.locator('[data-dir=right]').dispatchEvent('pointerdown',{pointerId:1});
  await page.locator('[data-dir=right]').dispatchEvent('pointerup',{pointerId:1});
  assert.equal((await state()).x,3,'Direction key moves one tile');
  assert.equal((await state()).scene,0,'Ordinary movement must never change scene');
  await page.locator('[data-dir=right]').dispatchEvent('pointerdown',{pointerId:9});
  await page.locator('[data-dir=right]').dispatchEvent('pointerup',{pointerId:9});
  assert.equal((await state()).scene,0,'Repeated ordinary movement stays in valid scene');
  check();
  await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('education-rpg-v28'));v.scene=3;v.x=7;v.y=2;localStorage.setItem('education-rpg-v28',JSON.stringify(v));});
  await page.reload();
  await page.locator('[data-dir=up]').dispatchEvent('pointerdown',{pointerId:2});
  await page.locator('[data-dir=up]').dispatchEvent('pointerup',{pointerId:2});
  assert.equal((await state()).scene,2,'North door leads from corridor to newsroom');
  await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('education-rpg-v28'));v.scene=3;v.x=7;v.y=6;localStorage.setItem('education-rpg-v28',JSON.stringify(v));});
  await page.reload();
  await page.locator('[data-dir=down]').dispatchEvent('pointerdown',{pointerId:3});
  await page.locator('[data-dir=down]').dispatchEvent('pointerup',{pointerId:3});
  assert.equal((await state()).scene,4,'South door leads to records archive');
  check();
  // Inject a valid game position through the same save format, then test normal UI.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('education-rpg-v28'));s.scene=0;s.x=3;s.y=3;localStorage.setItem('education-rpg-v28',JSON.stringify(s));});
  await page.reload();
  await page.locator('#interact').click();
  assert.match(await page.locator('#message').innerText(),/借閱統計表/);
  await page.getByRole('button',{name:'貼到事件紀錄板'}).click();
  assert.match(await page.locator('#board').innerText(),/借閱統計表/);
  // Supply required evidence via the persisted save format, then finish through UI.
  await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('education-rpg-v28'));
    s.scene=2;s.x=4;s.y=4;s.found=['stats','notice','hua','ledger'];
    s.citations=['stats','ledger'];s.headline=null;
    localStorage.setItem('education-rpg-v28',JSON.stringify(s));
  });
  await page.reload();
  await page.locator('#interact').click();
  await page.getByRole('button',{name:/閱讀週借閱量從80冊增加到164冊/}).click();
  await page.getByRole('button',{name:'提交調查報導並結案'}).click();
  assert.equal((await state()).publications.length,1);
  assert.equal((await state()).chapterDone,true);
  assert.match(await page.locator('#message').innerText(),/事件結案/);
  await page.reload();
  assert.equal((await state()).publications.length,1,'Reload retains published report');
  assert.equal((await state()).chapterDone,true,'Reload retains ending');
  page.once('dialog',d=>d.accept());
  await page.locator('#reset').click();
  assert.equal((await state()).publications.length,0,'Reset clears reports');
  assert.deepEqual((await state()).boardNotes,[],'Reset restores boardNotes');
  await page.locator('[data-dir=right]').dispatchEvent('pointerdown',{pointerId:7});
  await page.locator('[data-dir=right]').dispatchEvent('pointerup',{pointerId:7});
  assert.equal((await state()).x,3,'Movement still works immediately after reset');
  assert.match(await page.locator('#message').innerText(),/阿甘的來信/);
  check();
  console.log('PASS: mobile movement, exits, evidence board, report, case ending, reload and reset');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
