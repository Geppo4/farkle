/* Copia i file web del gioco nella cartella www/ usata da Capacitor.
   Esegui con: npm run build:web  (oppure node copy-web.mjs) */

import { copyFileSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'www';
const FILES = ['index.html', 'style.css', 'script.js', 'manifest.json', 'sw.js'];
const DIRS = ['icons'];

// copia ricorsiva file-per-file (robusta su qualsiasi filesystem)
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// pulizia e ricreazione della cartella di output
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const f of FILES) {
  if (existsSync(f)) copyFileSync(f, join(OUT, f));
  else console.warn(`Attenzione: file mancante ${f}`);
}
for (const dir of DIRS) {
  if (existsSync(dir)) copyDir(dir, join(OUT, dir));
}

console.log(`OK: risorse web copiate in ./${OUT}`);
