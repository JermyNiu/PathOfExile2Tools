#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['en', 'zhCN', 'zhTW'];

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-reference.mjs [--season s05]',
    '',
    'Checks the versioned PoE2DB reference files used for localized item and unique lookup.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { season: 's05' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function resolveSeasonFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateLocalizedName(entry, label, failures) {
  assert(entry.name && typeof entry.name === 'object' && !Array.isArray(entry.name), `${label}.name missing`, failures);
  for (const locale of locales) {
    assert(typeof entry.name?.[locale] === 'string' && entry.name[locale].trim().length > 0, `${label}.name.${locale} missing`, failures);
  }
}

function validateCatalog(catalog, label, expectedKind) {
  const failures = [];
  assert(typeof catalog.id === 'string' && catalog.id.trim().length > 0, `${label}.id missing`, failures);
  assert(typeof catalog.versionId === 'string' && catalog.versionId.trim().length > 0, `${label}.versionId missing`, failures);
  assert(catalog.source && typeof catalog.source === 'object', `${label}.source missing`, failures);
  assert(Array.isArray(catalog.entries) && catalog.entries.length > 0, `${label}.entries empty`, failures);

  const seen = new Set();
  let withMods = 0;
  for (const [index, entry] of (catalog.entries || []).entries()) {
    const entryLabel = `${label}.entries[${index}]`;
    assert(typeof entry.id === 'string' && entry.id.trim().length > 0, `${entryLabel}.id missing`, failures);
    assert(!seen.has(entry.id), `${entryLabel}.id duplicate ${entry.id}`, failures);
    seen.add(entry.id);
    assert(entry.kind === expectedKind, `${entryLabel}.kind expected ${expectedKind}, got ${entry.kind}`, failures);
    validateLocalizedName(entry, entryLabel, failures);
    if (entry.mods?.en?.length) withMods += 1;
  }

  return {
    failures,
    entries: catalog.entries?.length || 0,
    withMods,
    skipped: catalog.source?.skipped?.length || 0,
    pages: catalog.source?.pages?.length || 0
  };
}

function validateModifierCatalog(catalog, label, expectedKind = 'modifier') {
  const failures = [];
  assert(typeof catalog.id === 'string' && catalog.id.trim().length > 0, `${label}.id missing`, failures);
  assert(typeof catalog.versionId === 'string' && catalog.versionId.trim().length > 0, `${label}.versionId missing`, failures);
  assert(catalog.source && typeof catalog.source === 'object', `${label}.source missing`, failures);
  assert(Array.isArray(catalog.entries) && catalog.entries.length > 0, `${label}.entries empty`, failures);

  const seen = new Set();
  for (const [index, entry] of (catalog.entries || []).entries()) {
    const entryLabel = `${label}.entries[${index}]`;
    assert(typeof entry.id === 'string' && entry.id.trim().length > 0, `${entryLabel}.id missing`, failures);
    assert(!seen.has(entry.id), `${entryLabel}.id duplicate ${entry.id}`, failures);
    seen.add(entry.id);
    assert(entry.kind === expectedKind, `${entryLabel}.kind expected ${expectedKind}, got ${entry.kind}`, failures);
    for (const field of ['category', 'affix', 'description']) {
      assert(entry[field] && typeof entry[field] === 'object' && !Array.isArray(entry[field]), `${entryLabel}.${field} missing`, failures);
      for (const locale of locales) {
        assert(typeof entry[field]?.[locale] === 'string', `${entryLabel}.${field}.${locale} missing`, failures);
      }
    }
    assert(entry.description.en.trim().length > 0, `${entryLabel}.description.en empty`, failures);
    assert(entry.description.zhCN.trim().length > 0, `${entryLabel}.description.zhCN empty`, failures);
    assert(entry.description.zhTW.trim().length > 0, `${entryLabel}.description.zhTW empty`, failures);
  }

  return {
    failures,
    entries: catalog.entries?.length || 0,
    missingZhCN: (catalog.entries || []).filter((entry) => !entry.description?.zhCN?.trim()).length,
    missingZhTW: (catalog.entries || []).filter((entry) => !entry.description?.zhTW?.trim()).length
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const uniquesFile = manifest.reference?.items?.uniques;
  const baseItemsFile = manifest.reference?.items?.baseItems;
  const itemDetailsFile = manifest.reference?.items?.details;
  const modifiersFile = manifest.reference?.stats?.modifiers;
  const extraModifiersFile = manifest.reference?.stats?.extraModifiers;
  const failures = [];
  assert(typeof uniquesFile === 'string' && uniquesFile.trim().length > 0, 'manifest.reference.items.uniques missing', failures);
  assert(typeof baseItemsFile === 'string' && baseItemsFile.trim().length > 0, 'manifest.reference.items.baseItems missing', failures);
  assert(typeof itemDetailsFile === 'string' && itemDetailsFile.trim().length > 0, 'manifest.reference.items.details missing', failures);
  assert(typeof modifiersFile === 'string' && modifiersFile.trim().length > 0, 'manifest.reference.stats.modifiers missing', failures);
  assert(typeof extraModifiersFile === 'string' && extraModifiersFile.trim().length > 0, 'manifest.reference.stats.extraModifiers missing', failures);

  const uniques = uniquesFile ? await readJson(resolveSeasonFile(seasonRoot, uniquesFile)) : { entries: [] };
  const baseItems = baseItemsFile ? await readJson(resolveSeasonFile(seasonRoot, baseItemsFile)) : { entries: [] };
  const itemDetails = itemDetailsFile ? await readJson(resolveSeasonFile(seasonRoot, itemDetailsFile)) : { entries: [] };
  const modifiers = modifiersFile ? await readJson(resolveSeasonFile(seasonRoot, modifiersFile)) : { entries: [] };
  const extraModifiers = extraModifiersFile ? await readJson(resolveSeasonFile(seasonRoot, extraModifiersFile)) : { entries: [] };
  const uniqueResult = validateCatalog(uniques, 'uniques', 'unique');
  const baseItemResult = validateCatalog(baseItems, 'baseItems', 'item');
  const itemDetailsResult = {
    failures: [],
    entries: itemDetails.entries?.length || 0,
    withProperties: (itemDetails.entries || []).filter((entry) => entry.properties?.en?.length).length,
    withMods: (itemDetails.entries || []).filter((entry) => entry.mods?.en?.length).length,
    skipped: itemDetails.source?.skipped?.length || 0
  };
  assert(Array.isArray(itemDetails.entries) && itemDetails.entries.length > 0, 'itemDetails.entries empty', itemDetailsResult.failures);
  const modifierResult = validateModifierCatalog(modifiers, 'modifiers');
  const extraModifierResult = validateModifierCatalog(extraModifiers, 'extraModifiers', 'extra-modifier');
  failures.push(...uniqueResult.failures, ...baseItemResult.failures, ...itemDetailsResult.failures, ...modifierResult.failures, ...extraModifierResult.failures);

  const report = {
    season: args.season,
    version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live',
    files: {
      uniques: uniquesFile,
      baseItems: baseItemsFile,
      itemDetails: itemDetailsFile,
      modifiers: modifiersFile,
      extraModifiers: extraModifiersFile
    },
    uniques: uniqueResult,
    baseItems: baseItemResult,
    itemDetails: itemDetailsResult,
    modifiers: modifierResult,
    extraModifiers: extraModifierResult,
    status: failures.length ? 'failed' : 'ok',
    failures
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
