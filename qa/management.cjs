const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const BASE = `http://localhost:${process.env.PORT || '5174'}/`;
const DEFAULT_ID = 'onboarding-poc-v1';
const COLLECTION = 'poc-onboardings';
const draftKey = (id) => `poc-onboarding-draft:${id}`;
const editorPath = (id, mode = 'campos') => `/onboardings/${encodeURIComponent(id)}/${mode}`;
const collection = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), COLLECTION);
const goto = (page, path) => page.goto(new URL(path, BASE).href, { waitUntil: 'networkidle' });
const assertPath = async (page, path) => {
  await page.waitForURL(new URL(path, BASE).href);
  assert.equal(new URL(page.url()).pathname, path);
};
const openList = async (page) => {
  await goto(page, '/');
  await assertPath(page, '/onboardings');
  await page.getByTestId(`onboarding-row-${DEFAULT_ID}`).waitFor();
};
const assertFocus = async (locator) => {
  await locator.page().waitForFunction((element) => document.activeElement === element, await locator.elementHandle());
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true);
};
const openCreate = async (page) => {
  await page.getByTestId('open-create-onboarding').click();
  const dialog = page.getByTestId('create-onboarding-dialog');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.evaluate((element) => element instanceof HTMLDialogElement && element.open && element.matches(':modal')), true);
  await assertFocus(page.getByTestId('create-onboarding-title'));
  return dialog;
};
const assertMode = async (page, id, mode) => {
  await assertPath(page, editorPath(id, mode));
  const tab = { campos: 'builder', fluxo: 'flow', testar: 'runtime' }[mode];
  await page.locator(`[data-testid="tab-${tab}"][aria-current="page"]`).waitFor();
  assert.equal(await page.getByTestId(`tab-${tab}`).getAttribute('aria-current'), 'page');
  if (mode === 'campos') await page.getByTestId('builder-add-step').waitFor();
  if (mode === 'fluxo') await page.locator('.react-flow').waitFor();
  if (mode === 'testar') await page.getByTestId('step-counter').waitFor();
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  let pass = 0, fail = 0;
  const step = async (name, fn, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push('CONSOLE: ' + message.text());
    });
    page.on('pageerror', (error) => errors.push('PAGEERROR: ' + error.message));
    try {
      await fn(page);
      assert.deepEqual(errors, [], 'browser console/page errors');
      pass++;
      console.log('PASS: ' + name);
    } catch (error) {
      fail++;
      console.error('FAIL: ' + name + ' :: ' + error.message);
      for (const message of errors) console.error(message);
    } finally {
      await context.close();
    }
  };

  try {
    await step('root list, create two, rename, tabs/history/reload, discard and delete', async (page) => {
      await openList(page);
      assert.equal(await page.getByTestId('list-page').isVisible(), true);
      const initial = await collection(page);
      assert.equal(initial.length, 1);
      assert.equal(initial[0].id, DEFAULT_ID);
      const template = initial[0];
      const create = async (title) => {
        await openCreate(page);
        await page.getByTestId('create-onboarding-title').fill(title);
        await page.getByTestId('create-onboarding-submit').click();
        await page.waitForURL(/\/onboardings\/[^/]+\/campos$/);
        const id = decodeURIComponent(new URL(page.url()).pathname.split('/')[2]);
        await assertMode(page, id, 'campos');
        assert.equal(await page.getByTestId('onboarding-title').inputValue(), title);
        assert.equal((await collection(page)).find((item) => item.id === id).title, title);
        return id;
      };
      const first = await create('QA Jornada A');
      await page.getByRole('link', { name: 'Todos os onboardings', exact: true }).click();
      await assertPath(page, '/onboardings');
      const second = await create('QA Jornada B');
      assert.notEqual(first, second);
      assert.notEqual(first, DEFAULT_ID);
      assert.notEqual(second, DEFAULT_ID);
      assert.equal((await collection(page)).length, 3);
      await page.getByTestId('onboarding-title').fill('QA Jornada B renomeada');
      await page.getByTestId('editor-save').click();
      await page.getByText('Alterações salvas.', { exact: true }).waitFor();
      let items = await collection(page);
      assert.equal(items.find((item) => item.id === second).title, 'QA Jornada B renomeada');
      assert.equal(items.find((item) => item.id === first).title, 'QA Jornada A');
      assert.deepEqual(items.find((item) => item.id === DEFAULT_ID), template);
      await page.reload({ waitUntil: 'networkidle' });
      await assertMode(page, second, 'campos');
      assert.equal(await page.getByTestId('onboarding-title').inputValue(), 'QA Jornada B renomeada');
      await page.getByTestId('tab-runtime').click();
      await assertMode(page, second, 'testar');
      await page.getByTestId('tab-flow').click();
      await assertMode(page, second, 'fluxo');
      await page.getByTestId('tab-builder').click();
      await assertMode(page, second, 'campos');
      await page.goBack();
      await assertMode(page, second, 'fluxo');
      await page.goBack();
      await assertMode(page, second, 'testar');
      await page.goForward();
      await assertMode(page, second, 'fluxo');
      await page.reload({ waitUntil: 'networkidle' });
      await assertMode(page, second, 'fluxo');
      await page.getByTestId('tab-runtime').click();
      await page.reload({ waitUntil: 'networkidle' });
      await assertMode(page, second, 'testar');
      await page.getByTestId('tab-builder').click();
      await page.getByTestId('onboarding-title').fill('QA alteração descartada');
      await page.getByRole('link', { name: 'Todos os onboardings', exact: true }).click();
      await page.getByRole('button', { name: 'Descartar e sair', exact: true }).click();
      await assertPath(page, '/onboardings');
      await page.getByTestId(`onboarding-row-${second}`).getByRole('heading', { name: 'QA Jornada B renomeada', exact: true }).waitFor();
      await page.evaluate(({ firstKey, secondKey }) => {
        localStorage.setItem(firstKey, JSON.stringify({ account_kind: 'pj' }));
        localStorage.setItem(secondKey, JSON.stringify({ account_kind: 'pf' }));
      }, { firstKey: draftKey(first), secondKey: draftKey(second) });
      const beforeDelete = await collection(page);
      await page.getByTestId(`delete-onboarding-${first}`).click();
      await page.getByTestId('cancel-delete').click();
      await page.getByTestId('confirm-delete').waitFor({ state: 'hidden' });
      assert.equal(await page.getByTestId(`onboarding-row-${first}`).isVisible(), true);
      assert.deepEqual(await collection(page), beforeDelete);
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).account_kind, draftKey(first)), 'pj');
      await page.getByTestId(`delete-onboarding-${first}`).click();
      await page.getByTestId('confirm-delete').click();
      await page.getByTestId(`onboarding-row-${first}`).waitFor({ state: 'detached' });
      items = await collection(page);
      assert.deepEqual(items, beforeDelete.filter((item) => item.id !== first));
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey(first)), null);
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).account_kind, draftKey(second)), 'pf');
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId(`onboarding-row-${second}`).waitFor();
      assert.equal(await page.getByTestId(`onboarding-row-${first}`).count(), 0);
    });

    for (const key of ['Tab', 'Shift+Tab']) {
      await step(`create modal initial focus and ${key} stays trapped`, async (page) => {
        await openList(page);
        const dialog = await openCreate(page);
        for (let index = 0; index < 6; index++) {
          await page.keyboard.press(key);
          const focus = await dialog.evaluate((element) => ({
            inside: element.contains(document.activeElement),
            target: document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName,
          }));
          assert.equal(focus.inside, true, `${key} escaped the create dialog at press ${index + 1}: ${focus.target}`);
        }
      });
    }

    await step('Escape closes create modal and restores trigger without creation', async (page) => {
      await openList(page);
      const before = await collection(page);
      const dialog = await openCreate(page);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await dialog.evaluate((element) => element.open), false);
      await assertFocus(page.getByTestId('open-create-onboarding'));
      await assertPath(page, '/onboardings');
      assert.deepEqual(await collection(page), before);
    });

    await step('cancel create preserves collection and resets title on reopening', async (page) => {
      await openList(page);
      const before = await collection(page);
      const dialog = await openCreate(page);
      await page.getByTestId('create-onboarding-title').fill('QA Cancelled creation');
      await page.getByTestId('cancel-create-onboarding').click();
      await dialog.waitFor({ state: 'hidden' });
      await assertFocus(page.getByTestId('open-create-onboarding'));
      await assertPath(page, '/onboardings');
      assert.deepEqual(await collection(page), before);
      await openCreate(page);
      assert.equal(await page.getByTestId('create-onboarding-title').inputValue(), '');
      await page.getByTestId('cancel-create-onboarding').click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId(`onboarding-row-${DEFAULT_ID}`).waitFor();
      assert.deepEqual(await collection(page), before);
    });

    await step('blank and whitespace titles validate without creation; reopening clears validation', async (page) => {
      await openList(page);
      const before = await collection(page);
      const dialog = await openCreate(page);
      const title = page.getByTestId('create-onboarding-title');
      for (const value of ['', '   ']) {
        await title.fill(value);
        await page.getByTestId('create-onboarding-submit').click();
        await dialog.getByText('Informe um nome para o onboarding.', { exact: true }).waitFor();
        assert.equal(await title.getAttribute('aria-invalid'), 'true');
        await assertFocus(title);
        assert.equal(await dialog.isVisible(), true);
        await assertPath(page, '/onboardings');
        assert.deepEqual(await collection(page), before);
        await page.getByTestId('cancel-create-onboarding').click();
        await dialog.waitFor({ state: 'hidden' });
        await openCreate(page);
        assert.equal(await title.inputValue(), '');
        assert.equal(await title.getAttribute('aria-invalid'), 'false');
        assert.equal(await dialog.getByRole('alert').count(), 0);
      }
    });

    await step('creation failure preserves title and collection; reopening clears server error', async (page) => {
      await openList(page);
      const before = await collection(page);
      const dialog = await openCreate(page);
      const title = page.getByTestId('create-onboarding-title');
      await title.fill('QA Failed creation');
      await page.evaluate((key) => {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key) {
            Storage.prototype.setItem = setItem;
            throw new DOMException('QA simulated storage failure', 'QuotaExceededError');
          }
          return setItem.call(this, name, value);
        };
      }, COLLECTION);
      await page.getByTestId('create-onboarding-submit').click();
      await dialog.getByText('Não foi possível criar o onboarding. O nome foi mantido; tente novamente.', { exact: true }).waitFor();
      assert.equal(await title.inputValue(), 'QA Failed creation');
      await assertPath(page, '/onboardings');
      assert.deepEqual(await collection(page), before);
      await page.getByTestId('cancel-create-onboarding').click();
      await dialog.waitFor({ state: 'hidden' });
      await openCreate(page);
      assert.equal(await title.inputValue(), '');
      assert.equal(await dialog.getByRole('alert').count(), 0);
      assert.equal(await dialog.getByText('Não foi possível criar o onboarding. O nome foi mantido; tente novamente.', { exact: true }).count(), 0);
    });

    await step('Enter with a valid title creates exactly once and persists after reload', async (page) => {
      await openList(page);
      const before = await collection(page);
      await openCreate(page);
      await page.getByTestId('create-onboarding-title').fill('QA Enter creation');
      await page.evaluate((key) => {
        const setItem = Storage.prototype.setItem;
        window.qaCreationWrites = 0;
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key) window.qaCreationWrites++;
          return setItem.call(this, name, value);
        };
      }, COLLECTION);
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/onboardings\/[^/]+\/campos$/);
      const id = decodeURIComponent(new URL(page.url()).pathname.split('/')[2]);
      await assertMode(page, id, 'campos');
      assert.equal(await page.getByTestId('onboarding-title').inputValue(), 'QA Enter creation');
      const items = await collection(page);
      assert.equal(items.length, before.length + 1);
      assert.equal(items.filter((item) => item.title === 'QA Enter creation').length, 1);
      assert.equal(items.find((item) => item.id === id).title, 'QA Enter creation');
      assert.deepEqual(items.filter((item) => item.id !== id), before);
      assert.equal(await page.evaluate(() => window.qaCreationWrites), 1);
      await page.reload({ waitUntil: 'networkidle' });
      await assertMode(page, id, 'campos');
      assert.deepEqual(await collection(page), items);
    });

    await step('unknown ID, unknown mode and unknown route preserve collection', async (page) => {
      await openList(page);
      const before = await collection(page);
      for (const mode of ['campos', 'fluxo', 'testar']) {
        await goto(page, editorPath('qa-missing-onboarding', mode));
        await page.getByRole('heading', { name: 'Onboarding indisponível', exact: true }).waitFor();
        assert.equal(await page.getByTestId('step-counter').count(), 0);
        await page.getByRole('link', { name: 'Voltar aos onboardings', exact: true }).click();
        await assertPath(page, '/onboardings');
      }
      for (const path of ['/qa-missing-route', editorPath(DEFAULT_ID, 'qa-missing-mode')]) {
        await goto(page, path);
        await page.getByRole('heading', { name: 'Página não encontrada', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Voltar aos onboardings', exact: true }).click();
        await assertPath(page, '/onboardings');
      }
      assert.deepEqual(await collection(page), before);
    });

    await step('scoped PJ/PF drafts stay isolated across template runtimes and reload', async (page) => {
      await openList(page);
      const [template] = await collection(page);
      const ids = ['qa-template-pj', 'qa-template-pf'];
      const configs = ids.map((id) => ({ ...structuredClone(template), id, title: id }));
      await page.evaluate(({ key, configs, drafts }) => {
        localStorage.setItem(key, JSON.stringify(configs));
        for (const [draft, value] of drafts) localStorage.setItem(draft, JSON.stringify(value));
      }, { key: COLLECTION, configs, drafts: [[draftKey(ids[0]), { account_kind: 'pj' }], [draftKey(ids[1]), { account_kind: 'pf' }]] });
      const checkRuntime = async (id, kind) => {
        await assertMode(page, id, 'testar');
        assert.equal(await page.getByTestId(`buttons-account_kind-${kind}`).getAttribute('aria-checked'), 'true');
        assert.equal(await page.getByTestId(`buttons-account_kind-${kind === 'pj' ? 'pf' : 'pj'}`).getAttribute('aria-checked'), 'false');
        await page.getByTestId('btn-next').click();
        await page.getByTestId('step-form-account').waitFor();
        assert.equal(await page.getByTestId('field-company').count(), kind === 'pj' ? 1 : 0);
        assert.equal(await page.getByTestId('field-cpf').count(), kind === 'pf' ? 1 : 0);
      };
      for (const [id, kind] of [[ids[0], 'pj'], [ids[1], 'pf'], [ids[0], 'pj'], [ids[1], 'pf']]) {
        await goto(page, editorPath(id, 'testar'));
        await checkRuntime(id, kind);
        await page.reload({ waitUntil: 'networkidle' });
        await checkRuntime(id, kind);
      }
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).account_kind, draftKey(ids[0])), 'pj');
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).account_kind, draftKey(ids[1])), 'pf');
      assert.equal(await page.evaluate(() => localStorage.getItem('poc-onboarding-draft')), null);
      assert.deepEqual(await collection(page), configs);
    });

    await step('legacy config and draft migrate once without replacing the collection', async (page) => {
      await openList(page);
      const [template] = await collection(page);
      const legacy = { ...template, title: 'QA Modelo legado', version: 7 };
      await page.evaluate(({ key, legacy }) => {
        localStorage.removeItem(key);
        localStorage.setItem('poc-onboarding-config', JSON.stringify(legacy));
        localStorage.setItem('poc-onboarding-draft', JSON.stringify({ account_kind: 'pj' }));
      }, { key: COLLECTION, legacy });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId(`onboarding-row-${DEFAULT_ID}`).getByRole('heading', { name: legacy.title, exact: true }).waitFor();
      assert.deepEqual(await collection(page), [legacy]);
      assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).account_kind, draftKey(DEFAULT_ID)), 'pj');
      assert.equal(await page.evaluate(() => localStorage.getItem('poc-onboarding-draft')), null);
      await goto(page, editorPath(DEFAULT_ID, 'testar'));
      await page.getByTestId('step-counter').waitFor();
      assert.equal(await page.getByTestId('buttons-account_kind-pj').getAttribute('aria-checked'), 'true');
      await page.evaluate(() => localStorage.setItem('poc-onboarding-draft', JSON.stringify({ account_kind: 'pf' })));
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByTestId('step-counter').waitFor();
      assert.equal(await page.getByTestId('buttons-account_kind-pj').getAttribute('aria-checked'), 'true');
      assert.deepEqual(await collection(page), [legacy]);
    });

    for (const theme of ['light', 'dark']) {
      for (const device of [{ name: 'desktop', width: 1366, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
        await step(`list and create modal ${theme}/${device.name} fit viewport without horizontal overflow`, async (page) => {
          await page.addInitScript((value) => localStorage.setItem('poc-theme', value), theme);
          await openList(page);
          const [template] = await collection(page);
          await page.evaluate(({ key, template }) => localStorage.setItem(key, JSON.stringify([
            template,
            { ...template, id: 'qa-long-title', title: 'Q'.repeat(120) },
          ])), { key: COLLECTION, template });
          await page.reload({ waitUntil: 'networkidle' });
          await page.getByTestId('onboarding-row-qa-long-title').waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
          const assertNoOverflow = async () => {
            const size = await page.evaluate(async () => {
              await document.fonts.ready;
              return { width: document.documentElement.clientWidth, scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) };
            });
            assert.ok(size.scroll <= size.width, `horizontal overflow: ${size.scroll} > ${size.width}`);
          };
          await assertNoOverflow();
          const beforeCreate = await collection(page);
          const dialog = await openCreate(page);
          const assertModalFits = async () => {
            await assertNoOverflow();
            const size = await dialog.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return {
                x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
                width: rect.width, height: rect.height,
                viewportWidth: document.documentElement.clientWidth,
                viewportHeight: document.documentElement.clientHeight,
                clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
              };
            });
            assert.ok(size.width > 0 && size.height > 0, 'create modal has no visible area');
            assert.ok(size.x >= 0 && size.y >= 0 && size.right <= size.viewportWidth && size.bottom <= size.viewportHeight, `create modal exceeds viewport: ${JSON.stringify(size)}`);
            assert.ok(size.scrollWidth <= size.clientWidth, `create modal has internal horizontal overflow: ${JSON.stringify(size)}`);
            for (const testId of ['create-onboarding-title', 'cancel-create-onboarding', 'create-onboarding-submit']) {
              const control = page.getByTestId(testId);
              assert.equal(await control.isVisible(), true);
              const bounds = await control.boundingBox();
              assert.ok(bounds && bounds.x >= size.x && bounds.y >= size.y && bounds.x + bounds.width <= size.right && bounds.y + bounds.height <= size.bottom, `${testId} is outside the visible create modal`);
            }
          };
          await assertModalFits();
          await page.getByTestId('create-onboarding-submit').click();
          await dialog.getByText('Informe um nome para o onboarding.', { exact: true }).waitFor();
          await assertModalFits();
          await page.getByTestId('cancel-create-onboarding').click();
          await dialog.waitFor({ state: 'hidden' });
          await assertFocus(page.getByTestId('open-create-onboarding'));
          assert.deepEqual(await collection(page), beforeCreate);
          await page.getByTestId('delete-onboarding-qa-long-title').click();
          await page.getByTestId('confirm-delete').waitFor();
          await assertNoOverflow();
          await page.getByTestId('cancel-delete').click();
        }, { colorScheme: theme, viewport: { width: device.width, height: device.height }, isMobile: device.name === 'mobile', hasTouch: device.name === 'mobile' });
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`RESULT: ${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
})().catch((error) => { console.error('FATAL: ' + error.message); process.exitCode = 2; });
