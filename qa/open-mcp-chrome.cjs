// Abre o frontend no Chrome dirigido pelo servidor chrome-devtools-mcp (protocolo MCP via stdio).
// Uso: node qa/open-mcp-chrome.cjs [url]
const { spawn } = require('node:child_process');

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || '5174'}/`;
const RUNTIME = new URL('/onboardings/onboarding-poc-v1/testar', BASE).href;
const SHOT = 'C:/Users/gusta/AppData/Local/Temp/opencode/mcp-chrome.png';

const server = spawn('npx', ['-y', 'chrome-devtools-mcp@latest', '--headless', '--isolated', '--screenshotFormat=jpeg'], {
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
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
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
server.stderr.on('data', (d) => process.stderr.write('[mcp] ' + String(d).slice(0, 300)));

function send(method, params = {}, timeoutMs = 90000) {
  return new Promise((res, rej) => {
    const id = ++idc;
    pending.set(id, res);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error('timeout em ' + method)); }
    }, timeoutMs);
  });
}

function textOf(resp) {
  const c = resp?.result?.content ?? [];
  return c.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('\n');
}

(async () => {
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'poc-onboarding', version: '1.0' },
  }, 120000);
  console.log('MCP conectado. Servidor:', init?.result?.serverInfo?.name, init?.result?.serverInfo?.version);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await send('tools/list', {});
  const names = tools.result.tools.map((t) => t.name);
  console.log('TOOLS (' + names.length + '): ' + names.join(', '));

  if (!names.includes('new_page')) throw new Error('servidor sem new_page');

  console.log('Abrindo ' + RUNTIME + ' ...');
  console.log(textOf(await send('tools/call', { name: 'new_page', arguments: { url: RUNTIME } }, 120000)).slice(0, 400));

  const pagesRaw = textOf(await send('tools/call', { name: 'list_pages', arguments: {} }));
  console.log(pagesRaw.slice(0, 400));
  const m = pagesRaw.match(/^(\d+): .*\[selected\]/m);
  const pageId = m ? Number(m[1]) : 1;
  console.log('pageId selecionada: ' + pageId);

  console.log('Aguardando conteúdo (Etapa 1 de 6) ...');
  console.log(textOf(await send('tools/call', { name: 'wait_for', arguments: { pageId, text: ['Etapa 1 de 6'], timeout: 15000 } })).slice(0, 300));

  console.log('Snapshot da página:');
  console.log(textOf(await send('tools/call', { name: 'take_snapshot', arguments: { pageId } })).slice(0, 2500));

  console.log('Screenshot -> ' + SHOT);
  console.log(textOf(await send('tools/call', { name: 'take_screenshot', arguments: { pageId, filePath: SHOT } })).slice(0, 400));

  console.log('MCP-CHROME-OK');
  server.kill();
  process.exit(0);
})().catch((e) => {
  console.error('MCP-CHROME-FALHA: ' + e.message);
  try { server.kill(); } catch {}
  process.exit(1);
});
