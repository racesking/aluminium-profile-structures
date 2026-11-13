import { expect, test } from '@playwright/test';

test.describe('Express builder', () => {
  test('changing a dimension updates the BOM, and the drawing has a parts list', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Express Builder/ }).click();
    await page.getByRole('button', { name: /Shelving rack/ }).click();

    const totalCut = page.locator('.bom-stats .stat-card', { hasText: 'Total cut' }).locator('span');
    await expect(totalCut).toHaveText(/\d/);
    const before = await totalCut.textContent();

    const width = page.getByRole('spinbutton', { name: /^Width/ });
    await width.fill('1500');
    await width.press('Tab');
    await expect(totalCut).not.toHaveText(before ?? '');

    await page.getByRole('button', { name: 'Drawing' }).click();
    const dialog = page.getByRole('dialog', { name: /Technical drawing/ });
    await expect(dialog).toBeVisible();
    const sheet = page.frameLocator('.drawing-frame');
    await expect(sheet.locator('table').first()).toBeVisible();
    expect(await sheet.locator('table').first().locator('tbody tr').count()).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
