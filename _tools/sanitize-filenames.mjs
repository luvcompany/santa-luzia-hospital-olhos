// Renomeia arquivos com query string no nome (?,&,=) para nomes seguros p/
// hospedagem estática e reescreve as referências com um regex ATÔMICO por URL
// que respeita os limites de srcset (vírgula/espaço) — sem sobreposição.
// Roda LOGO após o wget, antes de rewrite-links e da reorganização.
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..'); // executado de dentro de _tools/
const ASSET_HOST = path.join(ROOT, 'santaluziahospitaldeolhos.com'); // caso ainda não reorganizado
const FRAMER_UNDER_SITE = path.join(ROOT, 'framerusercontent.com');

// nome cru (com query) -> nome seguro (extensão preservada)
function safeName(raw) {
  const qi = raw.indexOf('?');
  if (qi < 0) return raw;
  const p = raw.slice(0, qi);
  const query = raw.slice(qi + 1);
  const di = p.lastIndexOf('.');
  const stem = di >= 0 ? p.slice(0, di) : p;
  const ext = di >= 0 ? p.slice(di) : '';
  const qsan = query.replace(/&/g, '_').replace(/=/g, '-');
  return `${stem}__q__${qsan}${ext}`;
}

// 1) Renomeia arquivos em disco (procura a pasta framerusercontent.com onde estiver)
let renamed = 0;
async function findFramerDir(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === 'framerusercontent.com') return path.join(dir, e.name);
  }
  // procura um nível abaixo (dentro de santaluziahospitaldeolhos.com)
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === '_tools' || e.name === '.git') continue;
    const sub = path.join(dir, e.name, 'framerusercontent.com');
    try { await readdir(sub); return sub; } catch {}
  }
  return null;
}
async function walkRename(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walkRename(p); continue; }
    if (e.name.includes('?')) {
      const nn = safeName(e.name);
      if (nn !== e.name) { await rename(p, path.join(dir, nn)); renamed++; }
    }
  }
}
const framerDir = await findFramerDir(ROOT);
if (framerDir) await walkRename(framerDir);
console.log('pasta framer:', framerDir, '| arquivos renomeados:', renamed);

// 2) Reescreve referências (regex atômico por URL; query para em ", ) espaço aspas \)
const TEXT_EXT = new Set(['.html', '.css', '.mjs', '.js', '.json']);
// prefixo (https:// | ../*/ | nada) + framerusercontent.com/<sub>/ + arquivo.ext + query opcional
const RE = new RegExp(
  '((?:https://)?(?:\\.\\./)*framerusercontent\\.com/(?:images|assets|sites/[^/"\'\\s,)]+)/)' + // grupo1: prefixo+dir
  '([A-Za-z0-9._-]+\\.(?:jpe?g|png|svg|gif|webp|avif|ico))' + // grupo2: arquivo.ext (só imagens têm query)
  '((?:%3[Ff]|\\?)[^"\'\\s,)\\\\]*)?', // grupo3: query opcional (para em , ) espaço aspas \)
  'g'
);

function decode(q) {
  // remove marcador inicial (%3F ou ?), decodifica &amp; -> &
  return q.replace(/^(?:%3[Ff]|\?)/, '').replace(/&amp;/g, '&');
}

let filesChanged = 0, refsChanged = 0;
async function walkRewrite(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walkRewrite(p); continue; }
    if (!TEXT_EXT.has(path.extname(e.name))) continue;
    const txt = await readFile(p, 'utf8');
    let n = 0;
    const out = txt.replace(RE, (m, prefix, file, query) => {
      if (!query) return m; // sem query -> não mexe
      const raw = `${file}?${decode(query)}`;
      n++;
      return prefix + safeName(raw);
    });
    if (n > 0) { await writeFile(p, out); filesChanged++; refsChanged += n; }
  }
}
await walkRewrite(ROOT);
console.log(`arquivos de texto alterados=${filesChanged} referências reescritas=${refsChanged}`);
