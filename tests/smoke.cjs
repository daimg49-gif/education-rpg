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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=()=>assert.deepEqual(errors,[],'Browser JavaScript errors');
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('education-rpg-v15')));
 try{
  await page.goto(url);
  assert.match(await page.locator('h1').innerText(),/v1\.5/);
  assert.match(await page.locator('#message').innerText(),/匿名訊息/);
  await page.locator('[data-dir=right]').dispatchEvent('pointerdown',{pointerId:1});
  await page.locator('[data-dir=right]').dispatchEvent('pointerup',{pointerId:1});
  assert.equal((await state()).x,3,'Direction key moves one tile');
  check();
  // Inject a valid game position through the same save format, then test normal UI.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('education-rpg-v15'));s.scene=0;s.x=3;s.y=3;localStorage.setItem('education-rpg-v15',JSON.stringify(s));});
  await page.reload();
  await page.locator('#interact').click();
  assert.match(await page.locator('#message').innerText(),/借閱統計表/);
  await page.getByRole('button',{name:'貼到事件紀錄板'}).click();
  assert.match(await page.locator('#board').innerText(),/借閱統計表/);
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('education-rpg-v15'));s.scene=2;s.x=4;s.y=4;localStorage.setItem('education-rpg-v15',JSON.stringify(s));});
  await page.reload();
  await page.locator('#interact').click();
  await page.getByRole('button',{name:/四年級閱讀週借閱冊數從80冊增至164冊/}).click();
  await page.getByRole('button',{name:'確認發表報導'}).click();
  assert.equal((await state()).publications.length,1);
  await page.locator('#interact').click();
  await page.getByRole('button',{name:'確認發表報導'}).click();
  assert.equal((await state()).publications.length,2);
  assert.match(await page.locator('#history').innerText(),/第 2 版/);
  await page.getByRole('button',{name:'閱讀第一章尾聲'}).click();
  assert.match(await page.locator('#message').innerText(),/第一章・尾聲/);
  await page.reload();
  assert.equal((await state()).publications.length,2,'Reload retains report versions');
  page.once('dialog',d=>d.accept());
  await page.locator('#reset').click();
  assert.equal((await state()).publications.length,0,'Reset clears reports');
  assert.match(await page.locator('#message').innerText(),/匿名訊息/);
  check();
  console.log('PASS: mobile layout, movement, evidence, board, article, revisions, ending, reload, reset');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
