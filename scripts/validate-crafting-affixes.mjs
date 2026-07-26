#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { season: 's05', file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-crafting-affixes.mjs --season s05',
    '  node scripts/validate-crafting-affixes.mjs --season s05 --file crafting/affixes-poe2db-4.5.json',
    '',
    'Validates the versioned crafting affix catalog generated from PoE2DB ModifiersCalc.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateEntry(entry, index, failures) {
  const label = `entries[${index}]`;
  assert(typeof entry.id === 'string' && entry.id.length > 0, `${label}.id missing`, failures);
  assert(typeof entry.itemClass === 'string' && entry.itemClass.length > 0, `${label}.itemClass missing`, failures);
  assert(entry.kind === 'prefix' || entry.kind === 'suffix', `${label}.kind must be prefix/suffix`, failures);
  assert(/^T\d+$/.test(entry.tier || ''), `${label}.tier must be Tn`, failures);
  assert(Number.isInteger(entry.tierRank) && entry.tierRank > 0, `${label}.tierRank invalid`, failures);
  assert(Number.isInteger(entry.requiredLevel) && entry.requiredLevel >= 0, `${label}.requiredLevel invalid`, failures);
  assert(typeof entry.name === 'string' && entry.name.length > 0, `${label}.name missing`, failures);
  assert(typeof entry.description === 'string' && entry.description.length > 0, `${label}.description missing`, failures);
  assert(typeof entry.modGroup === 'string' && entry.modGroup.length > 0, `${label}.modGroup missing`, failures);
  assert(Number.isFinite(entry.weight), `${label}.weight invalid`, failures);
  assert(entry.weightSource === 'poe2db-dropchance', `${label}.weightSource invalid`, failures);
  assert(typeof entry.sourceRef === 'string' && entry.sourceRef.startsWith('https://poe2db.tw/'), `${label}.sourceRef invalid`, failures);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const catalogFile = args.file || manifest.crafting?.affixes;
  if (!catalogFile) throw new Error('manifest.crafting.affixes missing');
  const catalog = await readJson(path.join(seasonRoot, catalogFile));
  const failures = [];

  assert(catalog.schema === 'poe2-tools-crafting-affixes-v1', 'schema mismatch', failures);
  assert(catalog.source?.type === 'poe2db-modifiers-calc', 'source.type must be poe2db-modifiers-calc', failures);
  assert(Array.isArray(catalog.entries), 'entries must be array', failures);
  assert((catalog.entries || []).length >= 3000, `expected at least 3000 affixes, got ${catalog.entries?.length || 0}`, failures);
  assert(catalog.coverage?.fetchedClassCount >= 20, `expected at least 20 fetched classes, got ${catalog.coverage?.fetchedClassCount}`, failures);
  assert(catalog.coverage?.tieredCount === catalog.coverage?.affixCount, 'all catalog affixes should be tiered', failures);
  assert(catalog.coverage?.weightedCount === catalog.coverage?.affixCount, 'all catalog affixes should have weight', failures);

  const classes = new Set(catalog.entries.map((entry) => entry.itemClass));
  for (const requiredClass of ['Claws', 'Sceptres', 'Rings', 'Amulets', 'Bows']) {
    assert(classes.has(requiredClass), `missing required class ${requiredClass}`, failures);
  }
  const fireClaw = catalog.entries.filter((entry) => entry.itemClass === 'Claws' && entry.description.includes('火焰') && entry.description.includes('伤害'));
  assert(fireClaw.length >= 6, `expected at least 6 Claws fire damage affixes, got ${fireClaw.length}`, failures);
  const minionSceptre = catalog.entries.filter((entry) => entry.itemClass === 'Sceptres' && entry.description.includes('召唤生物'));
  assert(minionSceptre.length >= 4, `expected Sceptres minion affixes, got ${minionSceptre.length}`, failures);

  for (const [index, entry] of catalog.entries.entries()) validateEntry(entry, index, failures);

  const result = {
    file: path.relative(repoRoot, path.join(seasonRoot, catalogFile)),
    status: failures.length ? 'failed' : 'ok',
    failures,
    coverage: catalog.coverage
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
