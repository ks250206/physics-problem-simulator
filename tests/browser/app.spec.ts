import { test, expect } from '@playwright/test';
test('four physical scenes render, advance, reset and expose equations',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
 for(const id of ['track','spring','induction','pulley']){
  await page.getByTestId(`scene-${id}`).click();await expect(page.locator('canvas')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByTestId('play').click();await page.waitForTimeout(250);await expect.poll(async()=>Number(await page.getByTestId('time').textContent())).toBeGreaterThan(0);
  await page.getByRole('button',{name:'リセット',exact:true}).click();await expect(page.getByTestId('time')).toHaveText('0.00');
  await page.getByRole('button',{name:'1コマ進む'}).click();await expect(page.getByTestId('time')).not.toHaveText('0.00');
  await page.screenshot({path:`test-results/${id}-desktop.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});
test('all variants, parameters, share link and CSV export',async({page})=>{
 await page.goto('./');await page.getByLabel('台の形',{exact:true}).selectOption('asymmetric');await page.getByLabel('台の条件',{exact:true}).selectOption('1');
 await page.getByLabel('落下高さ',{exact:false}).focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'条件を共有'}).click();await expect(page).toHaveURL(/#scene=track/);await page.reload();await expect(page.getByLabel('台の形',{exact:true})).toHaveValue('asymmetric');await expect(page.getByLabel('台の条件',{exact:true})).toHaveValue('1');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV出力'}).click();expect((await download).suggestedFilename()).toBe('physics-track.csv');
 await page.getByTestId('scene-induction').click();for(const mode of ['brake','force','speed']){await page.getByLabel('駆動方法').selectOption(mode);await page.getByRole('button',{name:'1コマ進む'}).click();await expect(page.getByRole('alert')).toHaveCount(0);}
 await page.getByTestId('scene-pulley').click();for(const mode of ['single','movable','compound']){await page.getByLabel('滑車の構成').selectOption(mode);await page.getByRole('button',{name:'1コマ進む'}).click();await expect(page.getByRole('alert')).toHaveCount(0);}
 await page.getByRole('tab',{name:'参考にした入試問題'}).click();await expect(page.getByRole('link',{name:/中部大学/})).toBeVisible();
});
test('phone layout fits and invalid shared parameters are sanitized',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./#scene=track&p='+encodeURIComponent(JSON.stringify({m:0,M:999,drop:999,shape:'broken'})));
 await expect(page.getByLabel('小球の質量 m',{exact:true})).toHaveValue('0.5');await expect(page.getByLabel('台の形',{exact:true})).toHaveValue('bowl');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('canvas')).toBeVisible();await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
