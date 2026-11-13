import { expect, type Page, test } from '@playwright/test';

/** Start an empty Advanced project and create the default 600×400×400 box frame. */
async function createBoxFrame(page: Page) {
  await page.goto('./#advanced');
  await page.getByRole('button', { name: 'Box frame…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Box frame' });
  await expect(dialog.getByLabel(/^Width/)).toHaveValue('600');
  await dialog.getByRole('button', { name: 'Create frame' }).click();
  await expect(dialog).toBeHidden();
}

test.describe('Advanced builder cut list', () => {
  test('a box frame produces joint-compensated parts A–D', async ({ page }) => {
    await createBoxFrame(page);

    const members = page.getByRole('list', { name: 'Members' }).getByRole('button');
    await expect(members).toHaveCount(12);

    // Blind joints, 20 mm profile: through members keep full length, butting
    // members lose half the through section (10 mm) at each butting end.
    const texts = (await members.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
    const expected: [string, number][] = [
      ['A', 600],
      ['B', 590],
      ['C', 390],
      ['D', 380],
    ];
    for (const [part, mm] of expected) {
      const rows = texts.filter((t) => t.startsWith(part));
      expect(rows.length, `part ${part}`).toBeGreaterThan(0);
      for (const row of rows) expect(row, `part ${part}`).toContain(`${mm} mm`);
    }
    expect(texts.filter((t) => t.startsWith('D'))).toHaveLength(6);
  });

  test('kerf changes the cut plan waste live', async ({ page }) => {
    await createBoxFrame(page);
    const kerf = page.getByLabel('Kerf / blade (mm)');
    const firstBar = page.locator('#cut-plan .cut-group-head').first();

    await kerf.fill('0');
    await expect(firstBar).toContainText('waste 560 mm'); // 6000 − 5440 cut

    await kerf.fill('3');
    await expect(firstBar).toContainText('waste 527 mm'); // 11 saw cuts × 3 mm
  });
});
