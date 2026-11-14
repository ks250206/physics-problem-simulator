import { test, expect } from '@playwright/test';
const ids=['railSpring','collisionSpring','loopFlight','crossedFields','lcCircuit','dielectric','gasCycle','gasPiston','standingWave','doppler','interference','refraction','thinLens'];
for (const id of ids) test(`${id}: all presets, time evolution, observables and live 3D`,async({page})=>{
  test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`./#scene=${id}`);
  await expect(page.locator('canvas')).toBeVisible();await expect(page.getByTestId('observable-panel')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  const presets=page.locator('[data-testid^="preset-"]');const count=await presets.count();expect(count).toBeGreaterThanOrEqual(4);
  for(let i=0;i<count;i++){
    await presets.nth(i).click();await page.getByRole('button',{name:'1コマ進む'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
    const slider=page.getByLabel('時刻',{exact:true}),max=Number(await slider.getAttribute('max'));await slider.fill(String(max*.6));
    await expect(page.getByTestId('time')).not.toHaveText('0.00');
    if(['doppler','interference','refraction','thinLens'].includes(id)){await expect(page.getByTestId('energy-error')).toHaveCount(0);await expect(page.locator('.energy-panel')).toContainText('計算していません');}
    else await expect(page.getByTestId('energy-error')).toBeVisible();
  }
  await page.getByRole('button',{name:'初期値',exact:true}).click();const slider=page.getByLabel('時刻',{exact:true});await slider.fill(String(Math.min(1,Number(await slider.getAttribute('max'))*.65)));
  await page.getByRole('button',{name:'正面',exact:true}).click();await page.screenshot({path:`test-results/${id}-v3.png`,fullPage:true});
  expect(errors).toEqual([]);
});
test('coverage map, university search, scientific notation and explicit optical singularities',async({page})=>{
  await page.goto('./#scene=thinLens');await page.getByTestId('preset-3').click();await expect(page.locator('.metrics')).toContainText('無限遠');await expect(page.locator('.metrics')).not.toContainText('NaN');
  await page.getByRole('tab',{name:'出題カバレッジ'}).click();await expect(page.locator('.coverage-panel')).toContainText('未実装');await page.getByRole('button',{name:'二室の気体とばねピストン ↗',exact:true}).click();await expect(page.locator('h2')).toHaveText('二室の気体とばねピストン');
  await page.getByLabel('実験を検索',{exact:true}).fill('科学大');await expect(page.getByTestId('scene-railSpring')).toBeVisible();await expect(page.getByTestId('scene-lcCircuit')).toBeVisible();
  await page.getByTestId('scene-lcCircuit').click();await page.getByRole('tab',{name:'参考にした入試問題'}).click();await expect(page.locator('.references')).toContainText('2026年度');
  await page.getByLabel('実験を検索',{exact:true}).fill('');await page.getByTestId('scene-dielectric').click();await expect(page.locator('.chart-wrap')).toContainText('μJ');
});
test('extended mobile layout across heat, circuits and optics, with shared conditions',async({page})=>{
  await page.setViewportSize({width:390,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['gasCycle','lcCircuit','interference','thinLens']){
    await page.goto(`./#scene=${id}`);await expect(page.locator('canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByTestId('preset-1').click();await page.getByRole('button',{name:'1コマ進む'}).click();
  }
  await page.getByRole('button',{name:'条件を共有'}).click();await page.reload();await expect(page.getByLabel('物体距離 a')).toHaveValue('2');
  await page.screenshot({path:'test-results/extended-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('select domains and export actual physical data',async({page})=>{
  await page.goto('./');await page.getByLabel('実験の分野').selectOption('熱力学');await expect(page.locator('.scenario')).toHaveCount(2);await page.getByTestId('scene-gasCycle').click();
  await page.getByLabel('時刻',{exact:true}).fill('12');await expect(page.locator('.end-message')).toContainText('1サイクル完了');await expect(page.locator('.metrics')).toContainText('50.000');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV出力'}).click();expect((await download).suggestedFilename()).toBe('physics-gasCycle.csv');
  await page.getByRole('tab',{name:'モデルと方程式'}).click();await expect(page.locator('.explanation')).toContainText('Qin');
});
