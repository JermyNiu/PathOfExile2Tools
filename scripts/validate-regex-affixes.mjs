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
    '  node scripts/validate-regex-affixes.mjs --season s05',
    '  node scripts/validate-regex-affixes.mjs --season s05 --file regex/affixes-poe2db-4.5.json',
    '',
    'Validates the versioned regex affix catalog generated from PoE2DB Waystones and Tablet pages.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ''));
}

function looksEnglishOnly(value) {
  const text = String(value || '');
  return /[A-Za-z]{3,}/.test(text) && !hasCjk(text);
}

function validateLocalized(value, label, failures) {
  for (const locale of ['en', 'zhCN', 'zhTW']) {
    assert(typeof value?.[locale] === 'string' && value[locale].trim().length > 0, `${label}.${locale} missing`, failures);
  }
  assert(hasCjk(value.zhCN), `${label}.zhCN should contain Chinese text`, failures);
  assert(hasCjk(value.zhTW), `${label}.zhTW should contain Traditional Chinese text`, failures);
  assert(!looksEnglishOnly(value.zhTW), `${label}.zhTW is English-only`, failures);
}

function validateGroup(group, index, failures) {
  const label = `groups[${index}]`;
  assert(['waystone', 'tablet'].includes(group.kind), `${label}.kind invalid`, failures);
  assert(typeof group.familyKey === 'string' && group.familyKey.includes(group.kind), `${label}.familyKey invalid`, failures);
  validateLocalized(group.affix, `${label}.affix`, failures);
  validateLocalized(group.name, `${label}.name`, failures);
  validateLocalized(group.regex, `${label}.regex`, failures);
  assert(Array.isArray(group.rowIds) && group.rowIds.length > 0, `${label}.rowIds missing`, failures);
  assert(!('riskTags' in group), `${label}.riskTags should not be emitted`, failures);
}

function validateEntry(entry, index, failures) {
  const label = `entries[${index}]`;
  assert(['waystone', 'tablet'].includes(entry.kind), `${label}.kind invalid`, failures);
  validateLocalized(entry.affix, `${label}.affix`, failures);
  validateLocalized(entry.name, `${label}.name`, failures);
  validateLocalized(entry.regex, `${label}.regex`, failures);
  assert(!('riskTags' in entry), `${label}.riskTags should not be emitted`, failures);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const catalogFile = args.file || manifest.regexSearch?.affixes;
  if (!catalogFile) throw new Error('manifest.regexSearch.affixes missing');
  const catalog = await readJson(path.join(seasonRoot, catalogFile));
  const failures = [];

  assert(catalog.schema === 'poe2-tools-regex-affixes-v1', 'schema mismatch', failures);
  assert(catalog.source?.type === 'poe2db-waystone-tablet-modifiers', 'source.type mismatch', failures);
  assert((catalog.entries || []).length >= 300, `expected at least 300 entries, got ${catalog.entries?.length || 0}`, failures);
  assert((catalog.groups || []).length >= 100, `expected at least 100 groups, got ${catalog.groups?.length || 0}`, failures);
  assert(catalog.coverage?.waystoneEntries >= 100, `expected at least 100 waystone entries, got ${catalog.coverage?.waystoneEntries}`, failures);
  assert(catalog.coverage?.tabletEntries >= 200, `expected at least 200 tablet entries, got ${catalog.coverage?.tabletEntries}`, failures);
  assert(catalog.coverage?.tabletPages === 8, `expected 8 tablet pages, got ${catalog.coverage?.tabletPages}`, failures);

  const groupCounts = (catalog.groups || []).reduce((acc, group) => {
    acc[group.kind] = (acc[group.kind] || 0) + 1;
    return acc;
  }, {});
  assert(groupCounts.waystone >= 30, `expected at least 30 waystone groups, got ${groupCounts.waystone || 0}`, failures);
  assert(groupCounts.tablet >= 70, `expected at least 70 tablet groups, got ${groupCounts.tablet || 0}`, failures);

  for (const [index, entry] of (catalog.entries || []).entries()) validateEntry(entry, index, failures);
  for (const [index, group] of (catalog.groups || []).entries()) validateGroup(group, index, failures);

  const output = {
    file: path.relative(repoRoot, path.join(seasonRoot, catalogFile)),
    status: failures.length ? 'failed' : 'ok',
    failures,
    coverage: catalog.coverage,
    groupCounts
  };
  console.log(JSON.stringify(output, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
