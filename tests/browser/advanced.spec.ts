import { test, expect } from '@playwright/test';
const ids = ['cartSpring','cartPendulum','pendulum','coupledPendulum','elasticPendulum','conveyor','relative','rotating','accelerator','millikan'];
test('all ten advanced labs and their presets render and advance without errors', async ({ page }) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('./');
  for (const id of ids) {
    await page.getByTestId(`scene-${id}`).click(); await expect(page.locator('canvas')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
    const presets = page.locator('[data-testid^="preset-"]');
    for (let i = 0; i < await presets.count(); i++) { await presets.nth(i).click(); await page.getByRole('button', { name: '1コマ進む' }).click(); await expect(page.getByRole('alert')).toHaveCount(0); }
    await page.getByRole('button', { name: '初期値', exact: true }).click(); await page.getByTestId('play').click(); await page.waitForTimeout(240); await page.getByTestId('play').click();
    await expect.poll(async () => Number(await page.getByTestId('time').textContent())).toBeGreaterThan(0);
    await page.getByRole('button', { name: '正面', exact: true }).click();
    await page.screenshot({ path: `test-results/${id}-advanced.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
test('catalog filters, source distinctions, actual reference frame and tiny-energy display', async ({ page }) => {
  await page.goto('./'); await page.getByLabel('実験を検索', { exact: true }).fill('京都大学'); await expect(page.getByTestId('scene-coupledPendulum')).toBeVisible(); await page.getByLabel('実験を検索', { exact: true }).fill('東大');
  await expect(page.locator('.scenario')).toHaveCount(1); await page.getByTestId('scene-conveyor').click();
  await page.getByRole('tab', { name: '参考にした入試問題' }).click(); await expect(page.getByRole('link', { name: /東京大学.*2024/ })).toBeVisible();
  await page.getByLabel('実験を検索', { exact: true }).fill(''); await page.getByLabel('実験の分野').selectOption('台車・相対運動'); await page.getByTestId('scene-relative').click();
  await page.getByLabel('表示する座標系').selectOption('ground'); await page.getByRole('button', { name: '条件を共有' }).click(); await page.reload(); await expect(page.getByLabel('表示する座標系')).toHaveValue('ground');
  await page.getByTestId('scene-millikan').click(); await expect(page.locator('.chart-wrap')).toContainText('fJ'); await expect(page.locator('.metric').last()).toContainText('e-19');
  await page.getByTestId('preset-1').click(); await page.getByLabel('時刻', { exact: true }).fill('4'); await expect(page.getByTestId('energy-error')).toContainText(/収支誤差/);
});
test('advanced mobile layout, searchable navigation and preset interaction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('./#scene=cartPendulum');
  await page.getByTestId('preset-2').click(); await expect(page.getByLabel('表示する座標系')).toHaveValue('cart');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/advanced-mobile.png', fullPage: true });
});
