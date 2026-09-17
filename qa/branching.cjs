const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const BASE = 'http://localhost:5174/';
const branches = ['tech', 'design', 'business'];
const fixture = (id) => ({
  id,
  version: 1,
  title: 'QA Interesses e caminhos',
  steps: [
    {
      id: 'interests',
      title: 'Interesses',
      fields: [{
        id: 'interests',
        type: 'multiselect',
        label: 'Escolha seus interesses',
        required: true,
        options: branches.map((value) => ({ value, label: value })),
      }],
    },
    ...branches.map((branch) => ({
      id: branch,
      title: branch,
      fields: [{ id: `${branch}_detail`, type: 'text', label: `Detalhes de ${branch}`, required: true }],
    })),
    {
      id: 'final',
      title: 'Final',
      fields: [{ id: 'accept', type: 'checkbox', label: 'Confirmo meus dados', required: true }],
    },
  ],
  edges: [
    ...branches.map((branch) => ({ id: `interests-${branch}`, from: 'interests', to: branch, when: { field: 'interests', equals: branch } })),
    ...branches.map((branch) => ({ id: `${branch}-final`, from: branch, to: 'final' })),
  ],
});
const collection = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('poc-onboardings')));
const draft = (page, id) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), `poc-onboarding-draft:${id}`);
const assertStep = async (page, config, id) => {
  await page.getByTestId(`step-form-${id}`).waitFor();
  const index = config.steps.findIndex((step) => step.id === id);
  assert.equal(await page.getByTestId('step-counter').textContent(), `Etapa ${index + 1} de 5 — ${config.steps[index].title}`);
  assert.equal(await page.getByTestId(`goto-step-${index}`).getAttribute('aria-current'), 'step');
};

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let passed = 0;
  let failed = 0;
  try {
    for (const selected of [['tech'], ['design'], ['business'], ['design', 'tech']]) {
      const chosen = branches.find((branch) => selected.includes(branch));
      const name = `${selected.join('+')} -> ${chosen} -> final`;
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      try {
        await page.goto(BASE);
        await page.getByTestId('open-create-onboarding').click();
        const modal = page.getByTestId('create-onboarding-dialog');
        await modal.waitFor();
        assert.equal(await modal.evaluate((element) => element.matches(':modal')), true);
        const before = await collection(page);
        await page.getByTestId('create-onboarding-title').fill(`QA ${selected.join('+')}`);
        await page.getByTestId('create-onboarding-submit').click();
        await page.waitForURL(/\/onboardings\/[^/]+\/campos$/);
        const id = decodeURIComponent(new URL(page.url()).pathname.split('/')[2]);
        assert.ok(!before.some((item) => item.id === id));
        const config = fixture(id);
        await page.getByTestId('builder-import-toggle').click();
        await page.getByLabel('Cole o JSON do onboarding', { exact: true }).fill(JSON.stringify(config));
        await page.getByRole('button', { name: 'Aplicar JSON', exact: true }).click();
        await page.locator('#import-json').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('[data-testid^="builder-step-"]').count(), 5);
        await page.getByTestId('editor-save').click();
        await page.getByText('Alterações salvas.', { exact: true }).waitFor();
        const saved = { ...config, version: 2 };
        assert.deepEqual(await collection(page), [...before, saved]);
        await page.getByTestId('tab-runtime').click();
        await assertStep(page, config, 'interests');
        await page.getByTestId('btn-next').click();
        await page.getByTestId('field-interests').getByRole('alert').waitFor();
        await assertStep(page, config, 'interests');
        for (const branch of selected) await page.getByTestId(`multi-interests-${branch}`).click();
        await page.getByTestId('btn-next').click();
        await assertStep(page, config, chosen);
        await page.getByTestId('btn-next').click();
        await page.getByTestId(`field-${chosen}_detail`).getByRole('alert').waitFor();
        await assertStep(page, config, chosen);
        const answer = `QA resposta ${chosen}`;
        await page.getByTestId(`input-${chosen}_detail`).fill(answer);
        await page.getByTestId('btn-next').click();
        await assertStep(page, config, 'final');
        await page.getByTestId('btn-submit').click();
        await page.getByTestId('field-accept').getByRole('alert').waitFor();
        await assertStep(page, config, 'final');
        await page.getByRole('checkbox', { name: 'Confirmo meus dados' }).check();
        const expectedDraft = { interests: selected, [`${chosen}_detail`]: answer, accept: true };
        await page.waitForFunction(({ key, expected }) => {
          const value = JSON.parse(localStorage.getItem(key));
          return value && Object.entries(expected).every(([field, expectedValue]) => JSON.stringify(value[field]) === JSON.stringify(expectedValue));
        }, { key: `poc-onboarding-draft:${id}`, expected: expectedDraft });
        assert.deepEqual(await draft(page, id), expectedDraft);
        await page.reload();
        await assertStep(page, config, 'interests');
        assert.deepEqual(await collection(page), [...before, saved]);
        assert.deepEqual(await draft(page, id), expectedDraft);
        for (const branch of branches) assert.equal(await page.getByTestId(`multi-interests-${branch}`).getAttribute('aria-pressed'), String(selected.includes(branch)));
        await page.getByTestId('btn-next').click();
        await assertStep(page, config, chosen);
        assert.equal(await page.getByTestId(`input-${chosen}_detail`).inputValue(), answer);
        await page.getByTestId('btn-next').click();
        await assertStep(page, config, 'final');
        assert.equal(await page.getByRole('checkbox', { name: 'Confirmo meus dados' }).isChecked(), true);
        for (const branch of branches.filter((branch) => branch !== chosen)) {
          assert.equal(await page.getByTestId(`field-${branch}_detail`).count(), 0);
          assert.equal(await page.getByTestId(`goto-step-${branches.indexOf(branch) + 1}`).isDisabled(), true);
          assert.equal((await draft(page, id))[`${branch}_detail`], undefined);
        }
        await page.getByTestId('btn-submit').click();
        await page.getByTestId('success-screen').waitFor();
        const protocol = await page.getByTestId('protocol').textContent();
        assert.match(protocol, /^POC-\d{6}$/);
        assert.equal(await draft(page, id), null);
        assert.deepEqual(await collection(page), [...before, saved]);
        assert.deepEqual(errors, []);
        passed++;
        console.log(`PASS: ${name}; config/draft reload restored; unvisited required fields skipped; ${protocol}; draft cleared`);
      } catch (error) {
        failed++;
        console.error(`FAIL: ${name}: ${error.stack}`);
        for (const error of errors) console.error(error);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`RESULT: ${passed} pass, ${failed} fail`);
  process.exitCode = failed ? 1 : 0;
}

module.exports = { fixture };
if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
