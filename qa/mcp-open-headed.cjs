// Abre o Chrome VISÍVEL via chrome-devtools-mcp e mantém aberto na URL da POC.
// Uso: Start-Process node qa/mcp-open-headed.cjs (destacado). Log em %TEMP%/opencode/mcp-headed.log
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || '5174'}/`;
const RUNTIME = new URL('/onboardings/onboarding-poc-v1/testar', BASE).href;
const LOG = 'C:/Users/gusta/AppData/Local/Temp/opencode/mcp-headed.log';
const log = (s) => fs.appendFileSync(LOG, new Date().toLocaleTimeString('pt-BR') + ' ' + s + '\n');

const server = spawn('npx', ['-y', 'chrome-devtools-mcp@latest', '--screenshotFormat=jpeg'], {
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
server.stderr.on('data', (d) => log('[srv] ' + String(d).split('\n')[0].slice(0, 200)));

function send(method, params = {}, timeoutMs = 120000) {
  return new Promise((res, rej) => {
    const id = ++idc;
    pending.set(id, res);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout em ' + method)); } }, timeoutMs);
  });
}
const call = (name, args) => send('tools/call', { name, arguments: args });
const textOf = (resp) => (resp?.result?.content ?? []).map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('\n');

(async () => {
  fs.writeFileSync(LOG, '');
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'poc', version: '1.0' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const out = textOf(await call('new_page', { url: RUNTIME }));
  log('ABERTO: ' + out.split('\n').find((l) => l.includes('[selected]'))?.trim());
  // mantém o processo vivo para o Chrome não fechar
  setInterval(() => {}, 60000);
})().catch((e) => { log('FALHA: ' + e.message); process.exit(1); });
