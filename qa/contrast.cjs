// Auditoria de contraste WCAG (light/dark) + footer grudado no final.
// Uso: node qa/contrast.cjs  (dev em http://localhost:5174)
const { chromium } = require('playwright-core');
const BASE = `http://localhost:${process.env.PORT || '5174'}/`;
const RUNTIME = new URL('onboardings/onboarding-poc-v1/testar', BASE).href;

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
};
// oklch(L C H) -> [r,g,b] sRGB 0-255 (Bottosson). Canvas headless não resolve oklch.
const oklchToRgb = (L, C, Hdeg) => {
  const H = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(H); const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3; const m = m_ ** 3; const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2681437731 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(g * 255);
  });
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  let fail = 0;
  for (const theme of ['light', 'dark']) {
    console.log('== ' + theme + ' ==');
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, colorScheme: theme });
    page.setDefaultTimeout(12000);
    await page.addInitScript((t) => localStorage.setItem('poc-theme', t), theme);
    await page.goto(RUNTIME, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('step-counter').waitFor();
    const all = await page.evaluate(() => {
      const res = (s) => {
        if (!s) return null;
        let m = s.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (m) return { oklch: [Number(m[1]), Number(m[2]), Number(m[3])] };
        m = s.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const n = m[1].split(',').map((x) => Number(x.trim()));
          return { rgb: [n[0], n[1], n[2]] };
        }
        m = s.match(/^#([0-9a-f]{6})$/i);
        if (m) return { rgb: [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] };
        return null;
      };
      const css = (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[prop] : null;
      };
      const bg = getComputedStyle(document.body).backgroundColor;
      const btn = getComputedStyle(document.querySelector('[data-testid="btn-next"]'));
      const foot = document.querySelector('footer').getBoundingClientRect();
      return {
        bg: res(bg),
        body: res(css('main', 'color')),
        muted: res(css('.text-muted-foreground', 'color')),
        btnTx: res(btn.color),
        btnBg: res(btn.backgroundColor),
        footBottom: Math.round(foot.bottom + window.scrollY),
        docH: document.documentElement.scrollHeight,
      };
    });
    const toRgb = (v) => {
      if (!v) return null;
      if (v.rgb) return v.rgb;
      return oklchToRgb(v.oklch[0], v.oklch[1], v.oklch[2]);
    };
    const show = (name, fg, bgT, min) => {
      const f = toRgb(fg); const b = toRgb(bgT);
      if (!f || !b) { console.log('  ' + name + ': sem amostra'); return; }
      const v = ratio(f, b);
      const ok = v >= min;
      if (!ok) fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}: ${v} (mín ${min})`);
    };
    show('corpo/fundo', all.body, all.bg, 4.5);
    show('muted/fundo', all.muted, all.bg, 4.5);
    show('botão Continuar', all.btnTx, all.btnBg, 4.5);
    const stuck = all.footBottom === all.docH;
    if (!stuck) fail++;
    console.log(`  ${stuck ? 'PASS' : 'FAIL'} footer no final: bottom=${all.footBottom} docH=${all.docH}`);
    await page.close();
  }
  await browser.close();
  console.log(fail ? `RESULTADO: ${fail} FALHA(S)` : 'RESULTADO: tudo PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
