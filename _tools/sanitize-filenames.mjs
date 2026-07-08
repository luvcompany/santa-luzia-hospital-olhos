// Renomeia arquivos com query string no nome (?,&,=) para nomes seguros p/
// hospedagem estática e reescreve as referências por substituição LITERAL
// (a partir de um mapa construído com os nomes reais em disco — sem regex,
//  imune a sobreposição em srcset).
import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..'); // executado de dentro de _tools/
const ASSET_HOST = path.join(ROOT, 'framerusercontent.com');

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

// 1) Coleta nomes crus e renomeia em disco; monta lista de {raw,new}
const map = [];
async function walkRename(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walkRename(p); continue; }
    if (e.name.includes('?')) {
      const nn = safeName(e.name);
      map.push({ raw: e.name, nn });
      if (nn !== e.name) await rename(p, path.join(dir, nn));
    }
  }
}
await walkRename(ASSET_HOST);
console.log('arquivos renomeados:', map.length);

// 2) Para cada nome cru, gera as variantes de como ele aparece nos textos:
//    - HTML: ?->%3F, &->&amp;
//    - crua: ? e & literais (em .mjs/.json/.css)
//    Ordena por tamanho desc p/ substituir os mais longos primeiro.
const pairs = [];
for (const { raw, nn } of map) {
  const html = raw.replace('?', '%3F').replace(/&/g, '&amp;');
  const bare = raw;
  pairs.push([html, nn]);
  if (bare !== html) pairs.push([bare, nn]);
}
pairs.sort((a, b) => b[0].length - a[0].length);

// 3) Substituição literal em todos os arquivos de texto
const TEXT_EXT = new Set(['.html', '.css', '.mjs', '.js', '.json']);
let filesChanged = 0, refsChanged = 0;
async function walkRewrite(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { await walkRewrite(p); continue; }
    if (!TEXT_EXT.has(path.extname(e.name))) continue;
    let txt = await readFile(p, 'utf8');
    let n = 0;
    for (const [from, to] of pairs) {
      if (txt.includes(from)) {
        const parts = txt.split(from);
        n += parts.length - 1;
        txt = parts.join(to);
      }
    }
    if (n > 0) { await writeFile(p, txt); filesChanged++; refsChanged += n; }
  }
}
await walkRewrite(ROOT);
console.log(`arquivos de texto alterados=${filesChanged} referências reescritas=${refsChanged}`);
