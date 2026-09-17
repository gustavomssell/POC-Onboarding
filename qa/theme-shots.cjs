// Screenshots light/dark x desktop/mobile (playwright-core, Chrome instalado).
// Uso: node qa/theme-shots.cjs [baseUrl]
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || `http://localhost:${process.env.PORT || '5174'}/`;
const RUNTIME = new URL('/onboardings/onboarding-poc-v1/testar', BASE).href;
const SHOT = 'C:/Users/gusta/AppData/Local/Temp/opencode';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  for (const theme of ['light', 'dark']) {
    for (const device of [{ name: 'desktop', w: 1366, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
      const page = await browser.newPage({
        viewport: { width: device.w, height: device.h },
        colorScheme: theme,
      });
      page.setDefaultTimeout(12000);
      await page.addInitScript((t) => localStorage.setItem('poc-theme', t), theme);
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
      await page.goto(RUNTIME, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('step-counter').waitFor();
      await page.waitForTimeout(400);
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      await page.screenshot({ path: `${SHOT}/theme-${device.name}-${theme}.png` });
      console.log(`${theme}/${device.name}: dark-class=${dark} pageerrors=${errs.length} ${errs.join('|')}`);
      await page.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
