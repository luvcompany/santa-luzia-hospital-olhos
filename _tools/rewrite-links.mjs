// Reescreve referências absolutas a framerusercontent.com nos HTMLs
// para caminhos locais relativos (conforme a profundidade de cada página).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SITE = path.join(ROOT, 'santaluziahospitaldeolhos.com');
const FRAMER = path.join(ROOT, 'framerusercontent.com');

let changed = 0, total = 0;

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.name.endsWith('.html')) await processFile(p);
  }
}

async function processFile(file) {
  total++;
  let txt = await readFile(file, 'utf8');
  const before = txt;
  const relPrefix = path.relative(path.dirname(file), FRAMER); // ex.: ../framerusercontent.com

  // https://framerusercontent.com/PATH  ->  relPrefix/PATH
  txt = txt.replace(/https:\/\/framerusercontent\.com\/([^"'\s)\\]*)/g, (m, rest) => {
    return `${relPrefix}/${rest}`;
  });

  if (txt !== before) { await writeFile(file, txt); changed++; }
}

await walk(SITE);
console.log(`HTMLs processados=${total} alterados=${changed}`);
