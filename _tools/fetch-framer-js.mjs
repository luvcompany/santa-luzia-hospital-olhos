// Baixa recursivamente a árvore de módulos JS (.mjs) e JSON da Framer
// referenciados pelo site, salvando em framerusercontent.com/... para uso local.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// 1) Coleta URLs iniciais absolutas dos HTMLs
async function collectFromHtml() {
  const urls = new Set();
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.html')) {
        const txt = await readFile(p, 'utf8');
        const re = /https:\/\/framerusercontent\.com\/[^"'\s)\\]+/g;
        let m; while ((m = re.exec(txt))) urls.add(m[0].replace(/&amp;/g, '&'));
      }
    }
  }
  await walk(path.join(ROOT, 'santaluziahospitaldeolhos.com'));
  return [...urls];
}

// converte URL framerusercontent -> caminho local
function urlToLocal(u) {
  const url = new URL(u);
  return path.join(ROOT, url.hostname, decodeURIComponent(url.pathname));
}

const seen = new Set();
const queue = [];
let downloaded = 0, failed = 0;

async function enqueue(u) {
  if (seen.has(u)) return;
  seen.add(u);
  queue.push(u);
}

async function processUrl(u) {
  const local = urlToLocal(u);
  await mkdir(path.dirname(local), { recursive: true });
  let body;
  if (existsSync(local)) {
    body = await readFile(local, 'utf8').catch(() => null);
  }
  if (body == null) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': UA } });
      if (!res.ok) { failed++; console.log('FAIL', res.status, u); return; }
      body = await res.text();
      await writeFile(local, body);
      downloaded++;
      if (downloaded % 10 === 0) console.log('...baixados', downloaded);
    } catch (e) { failed++; console.log('ERR', u, e.message); return; }
  }
  // Se for JS, procura imports para outros arquivos framerusercontent
  if (u.endsWith('.mjs') || u.endsWith('.js')) {
    const base = u;
    // imports relativos e absolutos: from "...", import("..."), import "..."
    const re = /(?:from|import)\s*\(?\s*["']([^"']+\.(?:mjs|js))["']/g;
    let m;
    while ((m = re.exec(body))) {
      let ref = m[1];
      let abs;
      if (ref.startsWith('http')) abs = ref;
      else if (ref.startsWith('/')) abs = 'https://framerusercontent.com' + ref;
      else abs = new URL(ref, base).href;
      if (abs.includes('framerusercontent.com')) await enqueue(abs);
    }
  }
}

const initial = await collectFromHtml();
console.log('URLs iniciais nos HTMLs:', initial.length);
for (const u of initial) await enqueue(u);

while (queue.length) {
  const u = queue.shift();
  await processUrl(u);
}
console.log(`\nCONCLUÍDO. baixados=${downloaded} falhas=${failed} total_unicos=${seen.size}`);
