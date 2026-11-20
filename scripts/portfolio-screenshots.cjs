const { chromium } = require('/tmp/portfolio-playwright/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Your name').fill('Demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Load sample data' }).click();
    await page.waitForTimeout(4500);
    await page.screenshot({ path: 'screenshots/caderninho-' + name + '.png' });
    await context.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
