import { expect, test } from '@playwright/test';

// Native file pickers can't be driven by Playwright, so force the app's
// download / <input type="file"> fallbacks (the path Firefox and Safari use).
const NO_FS_ACCESS = `
  delete window.showSaveFilePicker;
  delete window.showOpenFilePicker;
`;

test('an Advanced project survives save to .json and reopen in a fresh browser', async ({
  page,
  browser,
}, testInfo) => {
  await page.addInitScript(NO_FS_ACCESS);
  await page.goto('./#advanced');
  await page.getByRole('button', { name: 'Box frame…' }).click();
  await page.getByRole('dialog', { name: 'Box frame' }).getByRole('button', { name: 'Create frame' }).click();

  const memberCount = page.locator('.panel:not(.right) .stat-card', { hasText: 'Members' }).locator('span');
  await expect(memberCount).toHaveText('12');

  await page.getByRole('button', { name: 'File', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Save project file…' }).click();
  const download = await downloadPromise;
  const file = testInfo.outputPath('project.json');
  await download.saveAs(file);

  // A brand-new context has empty storage: only the file can bring it back.
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await fresh.newPage();
  await page2.addInitScript(NO_FS_ACCESS);
  await page2.goto('./');
  const chooserPromise = page2.waitForEvent('filechooser');
  await page2.getByRole('button', { name: 'Open a saved project' }).click();
  await (await chooserPromise).setFiles(file);

  await expect(page2).toHaveURL(/#advanced$/);
  await expect(
    page2.locator('.panel:not(.right) .stat-card', { hasText: 'Members' }).locator('span'),
  ).toHaveText('12');
  await fresh.close();
});
