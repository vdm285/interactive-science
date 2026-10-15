import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ES, HOOKS } from './names.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(await readFile(join(root, 'data-cache.json'), 'utf8'));
let spanish = {};
try { spanish = JSON.parse(await readFile(join(root, 'src/data/summaries-es.json'), 'utf8')); } catch { spanish = {}; }

const elements = raw.elements
  .filter((element) => element.number >= 1 && element.number <= 118)
  .map((element) => {
    const names = ES[element.number];
    if (!names) throw new Error(`Missing Spanish name for ${element.number}`);
    const shells = element.shells || [];
    const sum = shells.reduce((total, n) => total + n, 0);
    if (sum !== element.number) throw new Error(`Shells of ${element.symbol} sum to ${sum}`);
    return {
      z: element.number,
      symbol: element.symbol,
      name: { es: names[0], en: element.name },
      aliases: names.slice(1),
      mass: element.atomic_mass,
      category: element.category,
      block: element.block,
      period: element.period,
      group: element.group,
      x: element.xpos,
      y: element.ypos,
      phase: element.phase,
      melt: element.melt,
      boil: element.boil,
      density: element.density,
      densityUnit: element.density_unit,
      shells,
      config: element.electron_configuration,
      configShort: element.electron_configuration_semantic,
      predicted: String(element.electron_configuration_semantic || '').includes('*') || element.number > 103,
      electronegativity: element.electronegativity_pauling,
      discoveredBy: element.discovered_by || null,
      namedBy: element.named_by || null,
      appearance: element.appearance,
      summaryEn: element.summary,
      summaryEs: spanish[String(element.number)] || null,
      source: element.source,
      hook: HOOKS[element.number] || null,
    };
  });

if (elements.length !== 118) throw new Error(`Expected 118 elements, got ${elements.length}`);
await mkdir(join(root, 'src/data'), { recursive: true });
await writeFile(join(root, 'src/data/elements.json'), JSON.stringify(elements));
console.log(`wrote ${elements.length} elements`);
