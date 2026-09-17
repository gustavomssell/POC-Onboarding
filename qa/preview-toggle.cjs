// Preview Testar: toggle mobile/desktop com container queries.
// Uso: node qa/preview-toggle.cjs  (requer dev em http://localhost:5174)
const { chromium } = require('playwright-core');
const BASE = process.env.PORT ? `http://localhost:${process.env.PORT}/` : 'http://localhost:5174/';
const ID = 'onboarding-poc-v1';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  let pass = 0; let fail = 0;
  const step = async (name, fn) => {
    try { await fn(); pass++; console.log('PASS: ' + name); }
    catch (e) { fail++; console.log('FAIL: ' + name + ' :: ' + String(e.message).split('\n')[0].slice(0, 200)); }
  };

  const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(`${BASE}onboardings/${ID}/testar`, { waitUntil: 'networkidle' });
  await page.getByTestId('step-counter').waitFor();

  await step('toggle existe com Desktop pressionado por padrão', async () => {
    if (await page.getByTestId('runtime-preview-desktop').getAttribute('aria-pressed') !== 'true') throw new Error('desktop não é o padrão');
  });

  await step('desktop em viewport largo: 12 colunas e stepper visível', async () => {
    await page.getByTestId('runtime-preview-desktop').click();
    await page.waitForTimeout(400);
    const cols = await page.evaluate(() => {
      const form = document.querySelector('form[data-testid^="step-form"]');
      return getComputedStyle(form).gridTemplateColumns.split(' ').length;
    });
    if (cols !== 12) throw new Error('colunas: ' + cols);
    const stepper = await page.evaluate(() => getComputedStyle(document.querySelector('ol[aria-label="Etapas do onboarding"]')).display);
    if (stepper === 'none') throw new Error('stepper oculto no desktop');
  });

  await step('mobile em viewport largo: moldura ~418px, 1 coluna, stepper oculto', async () => {
    await page.getByTestId('runtime-preview-mobile').click();
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const form = document.querySelector('form[data-testid^="step-form"]');
      const frame = form.closest('.rounded-\\[2\\.5rem\\]');
      const stepper = document.querySelector('ol[aria-label="Etapas do onboarding"]');
      return {
        cols: getComputedStyle(form).gridTemplateColumns.split(' ').length,
        frameW: Math.round(frame.getBoundingClientRect().width),
        overflowX: frame.scrollWidth > frame.clientWidth,
        stepper: getComputedStyle(stepper).display,
        viewportW: window.innerWidth,
      };
    });
    if (m.cols !== 1) throw new Error('colunas: ' + m.cols);
    if (m.frameW < 400 || m.frameW > 440) throw new Error('frame: ' + m.frameW);
    if (m.overflowX) throw new Error('frame com scroll horizontal');
    if (m.stepper !== 'none') throw new Error('stepper visível no frame mobile');
  });

  await step('sm:/md: respondem ao FRAME, não à janela (container query)', async () => {
    const m = await page.evaluate(() => {
      const actions = document.querySelector('form div.col-span-1 > div:last-of-type');
      const footer = Array.from(document.querySelectorAll('form p')).find((p) => p.textContent.includes('Pressione Enter'));
      return { actions: getComputedStyle(actions).flexDirection, footer: getComputedStyle(footer).textAlign, vw: window.innerWidth };
    });
    if (m.vw < 1024) throw new Error('viewport deveria ser largo: ' + m.vw);
    if (m.footer !== 'left') throw new Error('footer: ' + m.footer);
  });

  await step('toggle alternado N vezes mantém estado consistente', async () => {
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('runtime-preview-desktop').click();
      await page.getByTestId('runtime-preview-mobile').click();
    }
    await page.waitForTimeout(400);
    const pressed = await page.getByTestId('runtime-preview-mobile').getAttribute('aria-pressed');
    const cols = await page.evaluate(() => {
      const form = document.querySelector('form[data-testid^="step-form"]');
      return getComputedStyle(form).gridTemplateColumns.split(' ').length;
    });
    if (pressed !== 'true' || cols !== 1) throw new Error(`pressed=${pressed} cols=${cols}`);
  });

  await page.close();
  await browser.close();
  console.log('---');
  console.log(`RESULT: ${pass} pass, ${fail} fail`);
  if (errors.length) { console.log('PAGEERRORS:'); [...new Set(errors)].forEach((e) => console.log('  ' + e)); }
  process.exit(fail || errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
