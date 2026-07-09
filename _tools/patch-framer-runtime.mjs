// Patch de robustez no runtime do Framer.
// O helper de merge de variantes do Framer trava quando o objeto de variantes
// é undefined:
//   function q(e,...t){let n={};return t?.forEach(t=>t&&Object.assign(n,e[t])),n}
// O `Object.assign(n, e[t])` lê e[t] mesmo com `e` undefined -> TypeError fatal
// ("Cannot read properties of undefined") que ABORTA toda a hidratação da página.
// Correção: adicionar o guard `e&&` (comportamento idêntico quando e existe;
// pula com segurança quando não existe).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), '..', 'framerusercontent.com', 'sites');
const FROM = 'forEach(t=>t&&Object.assign(n,e[t]))';
const TO = 'forEach(t=>t&&e&&Object.assign(n,e[t]))';

let patched = 0;
async function walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (!e.name.endsWith('.mjs')) continue;
    const t = await readFile(p, 'utf8');
    if (t.includes(FROM)) {
      await writeFile(p, t.split(FROM).join(TO));
      patched++;
      console.log('patch:', e.name);
    }
  }
}
await walk(DIR);
console.log('módulos patchados:', patched);
