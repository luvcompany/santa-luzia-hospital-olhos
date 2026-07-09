// Corrige os atributos srcset corrompidos pelo bug do wget (--convert-links
// destrói srcset com query string). Estratégia: buscar o HTML ORIGINAL de cada
// página (srcset limpo), regenerar cada srcset apontando p/ arquivos locais
// (safeName) e substituir, em ordem, os srcset do HTML local. Também corrige o
// src das imagens framer e baixa qualquer variante ainda ausente.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SITE = 'https://santaluziahospitaldeolhos.com';

function safeName(raw) {
  const qi = raw.indexOf('?'); if (qi < 0) return raw;
  const p = raw.slice(0, qi), query = raw.slice(qi + 1);
  const di = p.lastIndexOf('.');
  const stem = di >= 0 ? p.slice(0, di) : p, ext = di >= 0 ? p.slice(di) : '';
  return `${stem}__q__${query.replace(/&/g, '_').replace(/=/g, '-')}${ext}`;
}

// URL do sitemap -> caminho de arquivo local
function urlToLocal(u) {
  let p = decodeURIComponent(new URL(u).pathname);
  if (p === '/' || p === '') return 'index.html';
  p = p.replace(/^\//, '').replace(/\/$/, '');
  return p + '.html';
}

const toDownload = new Map(); // localRelPath -> absoluteCdnUrl

// transforma uma URL de imagem do CDN numa ref local (safeName) e agenda download
function cdnToLocal(cdnUrl, relPrefix) {
  const url = new URL(cdnUrl.replace(/&amp;/g, '&'));
  const parts = url.pathname.split('/'); // ['', 'images', 'HASH.png']
  const file = parts.pop();
  const dir = parts.join('/').replace(/^\//, ''); // images | assets | sites/..
  const rawName = file + (url.search || '');
  const safe = safeName(rawName);
  const localRel = `framerusercontent.com/${dir}/${safe}`;
  // download da URL crua (com query) preservando o nome final safe
  toDownload.set(localRel, url.href);
  return `${relPrefix}/${dir}/${safe}`;
}

// reescreve um valor de srcset original -> local
function rewriteSrcset(val, relPrefix) {
  // entradas separadas por virgula; cada entrada: URL [descritor]
  return val.split(',').map(part => {
    const seg = part.trim();
    const sp = seg.search(/\s/);
    const u = sp >= 0 ? seg.slice(0, sp) : seg;
    const desc = sp >= 0 ? seg.slice(sp).trim() : '';
    if (!/framerusercontent\.com/.test(u)) return seg;
    const local = cdnToLocal(u, relPrefix);
    return desc ? `${local} ${desc}` : local;
  }).join(', ');
}

function attrValues(html, attr) {
  const re = new RegExp(`${attr}="([^"]*)"`, 'g');
  const out = []; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

const urls = (await readFile('/tmp/sl-urls.txt', 'utf8')).trim().split('\n');
let pagesFixed = 0, srcsetFixed = 0, mismatch = 0;

for (const u of urls) {
  const localRel = urlToLocal(u);
  const localPath = path.join(ROOT, localRel);
  let localHtml;
  try { localHtml = await readFile(localPath, 'utf8'); }
  catch { console.log('SEM ARQUIVO LOCAL:', localRel); continue; }

  const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  const orig = await res.text();

  const depth = localRel.includes('/') ? localRel.split('/').length - 1 : 0;
  const relPrefix = depth > 0 ? '../'.repeat(depth) + 'framerusercontent.com' : 'framerusercontent.com';

  const origSrc = attrValues(orig, 'srcset');
  const localSrc = attrValues(localHtml, 'srcset');
  if (origSrc.length !== localSrc.length) {
    console.log(`MISMATCH ${localRel}: orig=${origSrc.length} local=${localSrc.length}`);
    mismatch++;
  }
  // substitui em ordem: cada srcset local -> versão corrigida do original correspondente
  let idx = 0;
  localHtml = localHtml.replace(/srcset="([^"]*)"/g, () => {
    const origVal = origSrc[idx] !== undefined ? origSrc[idx] : localSrc[idx];
    idx++;
    srcsetFixed++;
    return `srcset="${rewriteSrcset(origVal, relPrefix)}"`;
  });

  // garante download das imagens de src single-URL do original tambem
  const origImgSrc = [...orig.matchAll(/\ssrc="(https:\/\/framerusercontent\.com\/images\/[^"]+)"/g)].map(m => m[1]);
  for (const cdn of origImgSrc) cdnToLocal(cdn, relPrefix);

  await writeFile(localPath, localHtml);
  pagesFixed++;
}
console.log(`páginas processadas=${pagesFixed} srcset reescritos=${srcsetFixed} mismatch=${mismatch}`);

// baixa variantes ausentes
let dl = 0, fail = 0;
for (const [rel, url] of toDownload) {
  const local = path.join(ROOT, rel);
  try { await access(local); continue; } catch {}
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) { fail++; console.log('DL FAIL', r.status, rel); continue; }
    await mkdir(path.dirname(local), { recursive: true });
    await writeFile(local, Buffer.from(await r.arrayBuffer()));
    dl++;
  } catch (e) { fail++; console.log('DL ERR', rel, e.message); }
}
console.log(`baixados=${dl} falhas=${fail} total_refs=${toDownload.size}`);
