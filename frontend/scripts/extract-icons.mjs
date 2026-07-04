import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const boldDir = join(__dir, '../node_modules/@phosphor-icons/core/assets/bold');
const outDir  = join(__dir, '../src/app/shared/constants');
const outFile = join(outDir, 'icons.constants.ts');

const ICON_MAP = {
  house:          'house-bold.svg',
  trophy:         'trophy-bold.svg',
  medal:          'medal-bold.svg',
  user:           'user-bold.svg',
  crown:          'crown-bold.svg',
  flame:          'flame-bold.svg',
  coin:           'coin-bold.svg',
  package:        'package-bold.svg',
  lightning:      'lightning-bold.svg',
  star:           'star-bold.svg',
  'person-run':   'person-simple-run-bold.svg',
  'person-walk':  'person-simple-walk-bold.svg',
  bicycle:        'bicycle-bold.svg',
  waves:          'waves-bold.svg',
  barbell:        'barbell-bold.svg',
  sneaker:        'sneaker-move-bold.svg',
};

const entries = Object.entries(ICON_MAP).map(([alias, file]) => {
  let svg = readFileSync(join(boldDir, file), 'utf-8').trim();
  // Normalise to 1em so CSS font-size controls the rendered size.
  // Phosphor v2 bold SVGs use only viewBox (no explicit width/height), so we
  // strip any existing width/height attributes then inject them right after <svg.
  svg = svg.replace(/\s+width="[^"]*"/g, '').replace(/\s+height="[^"]*"/g, '');
  svg = svg.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"');
  return `  '${alias}': \`${svg}\``;
});

mkdirSync(outDir, { recursive: true });
const output =
  `// Auto-generated — do not edit by hand. Re-run scripts/extract-icons.mjs to regenerate.\n` +
  `export const ICONS: Record<string, string> = {\n${entries.join(',\n')},\n};\n`;

writeFileSync(outFile, output, 'utf-8');
console.log('Generated', outFile, `(${entries.length} icons)`);
