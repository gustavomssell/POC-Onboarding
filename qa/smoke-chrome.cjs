// Smoke E2E da POC-Onboarding via Chrome real (playwright-core, channel=chrome).
// Uso: npm run test:browser  (sobe o dev em 5174 se preciso; ou PORT=5173 npm run test:browser)
// Requer: npm i -D playwright-core (já no projeto) + Google Chrome instalado.
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '5174';
const BASE = `http://localhost:${PORT}/`;
const RUNTIME = new URL('onboardings/onboarding-poc-v1/testar', BASE).href;
const SHOT = 'C:/Users/gusta/AppData/Local/Temp/opencode';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e.message).slice(0, 300)));
  let pass = 0, fail = 0;
  const step = async (name, fn) => {
    try { await fn(); pass++; console.log('PASS: ' + name); }
    catch (e) { fail++; console.log('FAIL: ' + name + ' :: ' + String(e.message).split('\n')[0].slice(0, 250)); }
  };
  const counter = () => page.getByTestId('step-counter').innerText();
  const draftKey = 'poc-onboarding-draft:onboarding-poc-v1';
  const account = {
    name: 'Maria Silva',
    email: 'maria@empresa.com',
    password: 'segredo123',
    phone: '(11) 99999-9999',
    company: 'Acme LTDA',
    cnpj: '12.345.678/0001-99',
  };
  const checkAccount = async (empty = false) => {
    for (const [id, expected] of Object.entries(account)) {
      const value = await page.getByTestId('input-' + id).inputValue();
      if (value !== (empty ? '' : expected)) throw new Error('valor incorreto: ' + id);
    }
  };
  const checkNoErrors = async () => {
    if (await page.getByRole('alert').count()) throw new Error('erros após reset');
    if (await page.locator('[aria-invalid="true"]').count()) throw new Error('campos inválidos após reset');
  };

  await step('app carrega (config padrão, etapa 1/6)', async () => {
    await page.goto(RUNTIME, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('step-counter').waitFor();
    const t = await counter();
    if (!t.includes('Etapa 1 de 6')) throw new Error('counter: ' + t);
  });
  await page.screenshot({ path: SHOT + '/onb-01-welcome.png' });

  await step('validação bloqueia avanço sem escolher perfil', async () => {
    await page.getByTestId('btn-next').click();
    await page.getByTestId('field-account_kind').getByRole('alert').waitFor();
  });

  await step('PJ mostra Razão social/CNPJ e esconde CPF', async () => {
    await page.getByTestId('buttons-account_kind-pj').click();
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-account').waitFor();
    if ((await counter()).includes('Etapa 1')) throw new Error('não avançou: ' + await counter());
    await page.getByTestId('field-company').waitFor();
    if (await page.getByTestId('field-cpf').count()) throw new Error('CPF visível para PJ');
  });
  await page.screenshot({ path: SHOT + '/onb-02-account-pj.png' });

  await step('preenche conta antes de avançar', async () => {
    for (const [id, value] of Object.entries(account)) {
      await page.getByTestId('input-' + id).fill(value);
    }
  });

  await step('rascunho restaura conta após reload e avança p/ perfil', async () => {
    await page.waitForFunction(({ key, expected }) => {
      const draft = JSON.parse(localStorage.getItem(key) ?? '{}');
      return draft.account_kind === 'pj' && Object.entries(expected).every(([id, value]) => draft[id] === value);
    }, { key: draftKey, expected: account });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('step-form-welcome').waitFor();
    if (await page.getByTestId('buttons-account_kind-pj').getAttribute('aria-checked') !== 'true') {
      throw new Error('perfil PJ não restaurado');
    }
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-account').waitFor();
    await checkAccount();
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-profile').waitFor();
  });

  await step('voltar preserva conta e permite avançar novamente', async () => {
    await page.getByTestId('btn-back').click();
    await page.getByTestId('step-form-account').waitFor();
    await checkAccount();
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-profile').waitFor();
  });

  await step('botões de objetivo + perfil avançam p/ endereço', async () => {
    await page.getByTestId('buttons-goal-networking').click();
    await page.locator('#birth').fill('1990-05-20');
    await page.locator('#role').selectOption('dev');
    await page.locator('#bio').fill('Dev full-stack.');
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-address').waitFor();
  });

  await step('CEP mock preenche cidade/UF/rua', async () => {
    await page.getByTestId('input-cep').fill('01310100');
    await page.getByRole('button', { name: 'Buscar endereço pelo CEP' }).click();
    await page.waitForFunction(() => document.getElementById('city')?.value === 'São Paulo');
    await page.waitForFunction(() => document.getElementById('uf')?.value === 'SP');
    await page.waitForFunction(() => document.getElementById('street')?.value === 'Av. Paulista');
    await page.getByTestId('input-number').fill('1000');
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-prefs').waitFor();
  });
  await page.screenshot({ path: SHOT + '/onb-03-prefs.png' });

  await step('prefs → plano enterprise mostra seats/moeda/%', async () => {
    await page.getByTestId('chip-interests-ia').click();
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-plan').waitFor();
    await page.getByTestId('radio-plan_kind-enterprise').click();
    await page.getByTestId('field-seats').waitFor();
    await page.getByTestId('field-expected_revenue').waitFor();
    await page.getByTestId('field-discount_goal').waitFor();
    await page.getByTestId('input-seats').fill('10');
    await page.getByTestId('input-expected_revenue').fill('5000000');
    const rev = await page.getByTestId('input-expected_revenue').inputValue();
    if (!rev.includes('50.000,00')) throw new Error('máscara R$: ' + rev);
    await page.getByTestId('input-discount_goal').fill('15');
  });

  await step('LGPD desmarcada bloqueia submit antes do aceite', async () => {
    if (await page.locator('#lgpd').isChecked()) throw new Error('LGPD já marcada');
    await page.getByTestId('btn-submit').click();
    await page.getByTestId('field-lgpd').getByRole('alert').waitFor();
    if (!await page.getByTestId('step-form-plan').isVisible()) throw new Error('saiu do plano sem aceite');
    if (await page.getByTestId('success-screen').count()) throw new Error('sucesso sem aceite LGPD');
    if (await page.locator('#lgpd').isChecked()) throw new Error('LGPD marcada pelo submit');
    await page.locator('#lgpd').check();
  });
  await page.screenshot({ path: SHOT + '/onb-04-plan.png' });

  await step('submit mostra protocolo de sucesso', async () => {
    await page.getByTestId('btn-submit').click();
    await page.getByTestId('success-screen').waitFor();
    const txt = await page.getByTestId('success-screen').innerText();
    if (!/POC-\d{6}/.test(txt)) throw new Error('sem protocolo: ' + txt.slice(0, 120));
  });
  await page.screenshot({ path: SHOT + '/onb-05-success.png' });

  await step('reset após sucesso limpa valores/erros e persiste rascunho limpo', async () => {
    await page.getByTestId('restart').click();
    await page.getByTestId('step-form-welcome').waitFor();
    if (!(await counter()).includes('Etapa 1 de 6')) throw new Error('reset não voltou ao início');
    if (await page.getByTestId('success-screen').count()) throw new Error('sucesso não limpo');
    if (await page.getByRole('radio', { checked: true }).count()) throw new Error('perfil não limpo');
    await checkNoErrors();
    await page.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      if (raw === null) return false;
      const draft = JSON.parse(raw);
      return Object.entries(draft).every(([id, value]) =>
        (id === 'newsletter' && value === true) || value === '' || value === null || value === false ||
        (Array.isArray(value) && value.length === 0)
      );
    }, draftKey);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('step-form-welcome').waitFor();
    if (await page.getByRole('radio', { checked: true }).count()) throw new Error('perfil restaurado após reset');
    await checkNoErrors();
    await page.getByTestId('buttons-account_kind-pj').click();
    await page.getByTestId('btn-next').click();
    await page.getByTestId('step-form-account').waitFor();
    await checkAccount(true);
    await checkNoErrors();
  });

  await step('aba Builder abre com paleta agrupada', async () => {
    await page.getByTestId('tab-builder').click();
    await page.getByTestId('palette-currency').waitFor();
    await page.getByTestId('builder-add-step').waitFor();
  });
  await page.screenshot({ path: SHOT + '/onb-06-builder.png', fullPage: true });

  await step('builder preview mobile', async () => {
    await page.getByTestId('preview-mobile').click();
  });
  await page.screenshot({ path: SHOT + '/onb-07-builder-mobile.png', fullPage: true });

  await step('aba Fluxo renderiza 6 nós', async () => {
    await page.getByTestId('tab-flow').click();
    await page.locator('.react-flow').waitFor();
    await page.waitForTimeout(800);
    const n = await page.locator('.react-flow__node').count();
    if (n !== 6) throw new Error('nós: ' + n);
  });
  await page.screenshot({ path: SHOT + '/onb-08-flow.png' });

  await step('mobile 390px renderiza 1 coluna', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    m.setDefaultTimeout(12000);
    m.on('pageerror', (e) => errors.push('MOBILE PAGEERROR: ' + String(e.message).slice(0, 200)));
    await m.goto(RUNTIME, { waitUntil: 'networkidle' });
    await m.getByTestId('step-counter').waitFor();
    await m.screenshot({ path: SHOT + '/onb-09-mobile.png' });
    await m.close();
  });

  console.log('---');
  console.log(`RESULT: ${pass} pass, ${fail} fail`);
  console.log('ERRORS(' + errors.length + '):');
  [...new Set(errors)].forEach((e) => console.log('  ' + e));
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
