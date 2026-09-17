// Dirige o frontend via chrome-devtools-mcp (oficial): simula usuário,
// valida correção no navegador e diagnostica console + rede.
// Uso: node qa/mcp-drive.cjs [url]
const { spawn } = require('node:child_process');

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || '5174'}/`;
const RUNTIME = new URL('/onboardings/onboarding-poc-v1/testar', BASE).href;
const SHOT = (n) => `C:/Users/gusta/AppData/Local/Temp/opencode/mcp-${n}.jpeg`;

const server = spawn('npx', ['-y', 'chrome-devtools-mcp@latest', '--headless', '--isolated', '--screenshotFormat=jpeg'], {
  shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});

let buf = '';
const pending = new Map();
let idc = 0;
server.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
server.stderr.on('data', () => {});

function send(method, params = {}, timeoutMs = 90000) {
  return new Promise((res, rej) => {
    const id = ++idc;
    pending.set(id, res);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout em ' + method)); } }, timeoutMs);
  });
}
const call = (name, args) => send('tools/call', { name, arguments: args });
const textOf = (resp) => (resp?.result?.content ?? []).map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('\n');

function findUid(snap, pattern) {
  for (const line of snap.split('\n')) {
    if (pattern.test(line)) {
      const m = line.match(/uid=(\S+)/);
      if (m) return m[1];
    }
  }
  return null;
}

let pass = 0, fail = 0;
const step = async (name, fn) => {
  try { await fn(); pass++; console.log('PASS: ' + name); }
  catch (e) { fail++; console.log('FAIL: ' + name + ' :: ' + String(e.message).split('\n')[0].slice(0, 220)); }
};

(async () => {
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'poc', version: '1.0' } }, 120000);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const pages = textOf(await call('new_page', { url: RUNTIME }));
  const pageId = Number((pages.match(/^(\d+): .*\[selected\]/m) || [])[1] || 2);
  await call('wait_for', { pageId, text: ['Etapa 1 de 6'], timeout: 15000 });
  const snap = () => call('take_snapshot', { pageId }).then(textOf);

  await step('Continuar sem perfil mostra erro inline', async () => {
    let s = await snap();
    const btn = findUid(s, /button "Continuar"/);
    if (!btn) throw new Error('botão Continuar não achado');
    await call('click', { pageId, uid: btn });
    s = await snap();
    if (!/Campo obrigatório/.test(s)) throw new Error('mensagem de validação ausente');
  });
  await call('take_screenshot', { pageId, filePath: SHOT('validacao') });

  await step('PJ avança p/ Conta com razão social', async () => {
    let s = await snap();
    // escolhe Empresa (PJ): segunda opção do grupo (botões com role=radio)
    const radios = s.split('\n').filter((l) => /radio "/.test(l));
    const pjUid = (radios[1] || '').match(/uid=(\S+)/)?.[1];
    if (!pjUid) throw new Error('radio PJ não achado');
    await call('click', { pageId, uid: pjUid });
    const btn = findUid(await snap(), /button "Continuar"/);
    await call('click', { pageId, uid: btn });
    await call('wait_for', { pageId, text: ['Etapa 2 de 6'], timeout: 10000 });
    s = await snap();
    if (!/Razão social/.test(s)) throw new Error('campo condicional ausente');
  });
  await call('take_screenshot', { pageId, filePath: SHOT('pj') });

  await step('console limpo (zero erros)', async () => {
    const out = textOf(await call('list_console_messages', { pageId, types: ['error'] }));
    if (/error/i.test(out) && !/0 messages|no errors/i.test(out)) {
      const lines = out.split('\n').filter(Boolean).slice(0, 5).join(' | ');
      if (lines.trim()) throw new Error(lines.slice(0, 200));
    }
  });

  await step('rede: página e assets 200', async () => {
    const out = textOf(await call('list_network_requests', { pageId }));
    if (/Failed|ERR_/i.test(out)) throw new Error(out.split('\n').find((l) => /Failed|ERR_/i.test(l)).slice(0, 200));
    if (!out.includes(new URL(BASE).host)) throw new Error('sem requests registradas');
  });

  console.log('---');
  console.log(`RESULT: ${pass} pass, ${fail} fail`);
  server.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('MCP-DRIVE-FALHA: ' + e.message);
  try { server.kill(); } catch {}
  process.exit(2);
});
