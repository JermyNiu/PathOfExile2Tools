#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const classHrefMap = {
  Amulets: 'Amulets',
  Belts: 'Belts',
  'Body Armours': 'Body_Armours',
  Boots: 'Boots',
  Bows: 'Bows',
  Bucklers: 'Bucklers',
  Claws: 'Claws',
  Crossbows: 'Crossbows',
  Daggers: 'Daggers',
  Flails: 'Flails',
  Foci: 'Foci',
  Gloves: 'Gloves',
  Helmets: 'Helmets',
  'One Hand Axes': 'One_Hand_Axes',
  'One Hand Maces': 'One_Hand_Maces',
  'One Hand Swords': 'One_Hand_Swords',
  Quarterstaves: 'Quarterstaves',
  Quivers: 'Quivers',
  Rings: 'Rings',
  Sceptres: 'Sceptres',
  Shields: 'Shields',
  Spears: 'Spears',
  Staves: 'Staves',
  'Two Hand Axes': 'Two_Hand_Axes',
  'Two Hand Maces': 'Two_Hand_Maces',
  'Two Hand Swords': 'Two_Hand_Swords',
  Wands: 'Wands'
};

const defaultClassKeys = Object.keys(classHrefMap);
const localeCodes = ['cn'];

function parseArgs(argv) {
  const args = {
    season: 's05',
    dataRoot: null,
    out: null,
    write: false,
    force: false,
    classes: null,
    locales: localeCodes
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i];
    else if (arg === '--data-root') args.dataRoot = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--classes') args.classes = argv[++i].split(',').map((item) => item.trim()).filter(Boolean);
    else if (arg === '--locales') args.locales = argv[++i].split(',').map((item) => item.trim()).filter(Boolean);
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-crafting-affixes.mjs --season s05 --classes Claws,Sceptres --write',
    '  node scripts/fetch-poe2db-crafting-affixes.mjs --season s05 --write --force',
    '',
    'Fetches PoE2DB item-class ModifiersCalc data and writes a versioned crafting affix catalog.',
    'Pages without ModifiersCalc are skipped unless --strict is passed.',
    'Default mode is dry-run. Use --write to save the JSON catalog.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'poe2-tools-local-catalog-fetch/1.0'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}

function extractModsViewData(html) {
  const marker = 'new ModsView(';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('PoE2DB page does not contain new ModsView(...)');
  let i = start + marker.length;
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start + marker.length, i + 1));
    }
  }
  throw new Error('Could not locate end of new ModsView(...) payload');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span class="ndash">[—-]<\/span>/g, '-')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generationKind(data, row) {
  const label = data.gen?.[String(row.ModGenerationTypeID)] || '';
  if (label.includes('前缀') || String(row.ModGenerationTypeID) === '1') return 'prefix';
  if (label.includes('后缀') || String(row.ModGenerationTypeID) === '2') return 'suffix';
  return row.type === 'socketable' ? 'socket' : 'unknown';
}

function tagsFromRow(row) {
  const tags = new Set();
  for (const key of ['ModFamilyList', 'TagsList', 'fossil_no', 'adds_no', 'spawn_no', 'mod_no']) {
    const values = Array.isArray(row[key]) ? row[key] : [];
    values.forEach((value) => {
      const text = String(value || '').trim();
      if (text) tags.add(text);
    });
  }
  return [...tags].sort();
}

function sourceCode(row) {
  if (row.Code) return row.Code;
  const hover = String(row.hover || '');
  const match = hover.match(/Data%5CMods%2F([^"&]+)/i) || hover.match(/Data\\Mods\\([^"&]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function assignTiers(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.modGroup) continue;
    const key = `${entry.itemClass}|${entry.kind}|${entry.modGroup}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  for (const group of groups.values()) {
    const levels = [...new Set(group.map((entry) => entry.requiredLevel || 0))].sort((a, b) => b - a);
    for (const entry of group) {
      const index = levels.indexOf(entry.requiredLevel || 0);
      entry.tier = index >= 0 ? `T${index + 1}` : 'T?';
      entry.tierRank = index >= 0 ? index + 1 : null;
      entry.tierSource = 'poe2db-mod-family-level-order';
    }
  }
}

function normalizeEntries(data, classKey, href, locale, sourceUrl) {
  const rows = [];
  for (const sourceBucket of ['normal']) {
    for (const row of data[sourceBucket] || []) {
      const kind = generationKind(data, row);
      if (kind !== 'prefix' && kind !== 'suffix') continue;
      const description = stripHtml(row.str);
      if (!description) continue;
      rows.push({
        id: `${href}:${sourceBucket}:${sourceCode(row) || stripHtml(row.Name)}:${row.Level}:${row.ModGenerationTypeID}`.replace(/\s+/g, '_'),
        itemClass: classKey,
        itemClassHref: href,
        kind,
        tier: 'T?',
        tierRank: null,
        tierSource: 'pending',
        requiredLevel: numberOrNull(row.Level),
        name: stripHtml(row.Name),
        description,
        modGroup: Array.isArray(row.ModFamilyList) && row.ModFamilyList.length ? row.ModFamilyList.join('|') : null,
        modFamilies: Array.isArray(row.ModFamilyList) ? row.ModFamilyList : [],
        tags: tagsFromRow(row),
        weight: numberOrNull(row.DropChance),
        weightSource: row.DropChance === undefined ? 'missing' : 'poe2db-dropchance',
        sourceBucket,
        sourceCode: sourceCode(row),
        sourceRef: sourceUrl,
        locale
      });
    }
  }
  assignTiers(rows);
  return rows;
}

async function fetchClass(locale, classKey) {
  const href = classHrefMap[classKey];
  if (!href) throw new Error(`Unsupported item class: ${classKey}`);
  const sourceUrl = `https://poe2db.tw/${locale}/${href}#ModifiersCalc`;
  const html = await fetchText(sourceUrl);
  const data = extractModsViewData(html);
  const entries = normalizeEntries(data, classKey, href, locale, sourceUrl);
  return {
    itemClass: classKey,
    href,
    sourceUrl,
    entries,
    rawCounts: Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const seasonRoot = args.dataRoot
    ? path.join(repoRoot, args.dataRoot)
    : path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const version = manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live';
  const classes = args.classes || defaultClassKeys;
  const outFile = args.out
    ? path.resolve(repoRoot, args.out)
    : path.join(seasonRoot, 'crafting', `affixes-poe2db-${version}.json`);

  const results = [];
  const entries = [];
  for (const locale of args.locales) {
    for (const classKey of classes) {
      try {
        const result = await fetchClass(locale, classKey);
        results.push({
          locale,
          itemClass: classKey,
          href: result.href,
          sourceUrl: result.sourceUrl,
          status: 'ok',
          affixes: result.entries.length,
          rawCounts: result.rawCounts
        });
        entries.push(...result.entries);
      } catch (error) {
        if (args.strict) throw error;
        results.push({
          locale,
          itemClass: classKey,
          href: classHrefMap[classKey] || null,
          sourceUrl: classHrefMap[classKey] ? `https://poe2db.tw/${locale}/${classHrefMap[classKey]}#ModifiersCalc` : null,
          status: 'skipped',
          affixes: 0,
          error: error.message
        });
      }
    }
  }

  const catalog = {
    schema: 'poe2-tools-crafting-affixes-v1',
    season: manifest.label || args.season.toUpperCase(),
    versionId: manifest.versionId,
    generatedAt: new Date().toISOString(),
    source: {
      type: 'poe2db-modifiers-calc',
      baseUrl: 'https://poe2db.tw',
      version,
      locales: args.locales,
      classes: classes.map((classKey) => ({ itemClass: classKey, href: classHrefMap[classKey] }))
    },
    coverage: {
      classCount: classes.length,
      fetchedClassCount: results.filter((result) => result.status === 'ok').length,
      skippedClassCount: results.filter((result) => result.status === 'skipped').length,
      localeCount: args.locales.length,
      affixCount: entries.length,
      prefixCount: entries.filter((entry) => entry.kind === 'prefix').length,
      suffixCount: entries.filter((entry) => entry.kind === 'suffix').length,
      tieredCount: entries.filter((entry) => entry.tier !== 'T?').length,
      weightedCount: entries.filter((entry) => entry.weight !== null).length
    },
    fetchResults: results,
    entries
  };

  const output = {
    mode: args.write ? 'write' : 'dry-run',
    outFile,
    classCount: classes.length,
    affixCount: entries.length,
    results
  };

  if (!args.write) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  if (existsSync(outFile) && !args.force) {
    throw new Error(`${path.relative(repoRoot, outFile)} already exists; pass --force to replace it`);
  }
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ ...output, status: 'written' }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
