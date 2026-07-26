#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = { en: 'us', zhCN: 'cn', zhTW: 'tw' };
const tabletIds = [
  'Abyss_Tablet',
  'Breach_Tablet',
  'Delirium_Tablet',
  'Expedition_Tablet',
  'Irradiated_Tablet',
  'Overseer_Tablet',
  'Ritual_Tablet',
  'Temple_Tablet'
];

function parseArgs(argv) {
  const args = { season: 's05', write: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-regex-affixes.mjs --season s05',
    '  node scripts/fetch-poe2db-regex-affixes.mjs --season s05 --write --force',
    '',
    'Fetches PoE2DB Waystone and Tablet modifier text for the regex generator catalog.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'poe2-tools-local-fetch/1.0' } });
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    }
  }
  throw lastError;
}

function stripTags(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span class="ndash">[^<]*<\/span>/g, '-')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseTableCells(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
}

function sectionHtml(html, id) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return '';
  const next = html.indexOf('<div id="', start + 1);
  return html.slice(start, next > start ? next : html.length);
}

function parseWaystoneRows(html) {
  const section = sectionHtml(html, 'WaystonesMods') || sectionHtml(html, '引路石Mods') || sectionHtml(html, '換界石Mods');
  const rows = [];
  let rowIndex = 0;
  for (const row of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = parseTableCells(row[1]);
    if (cells.length < 3) continue;
    const level = stripTags(cells[0]);
    const affix = stripTags(cells[1]);
    const description = stripTags(cells[2]);
    if (!description) continue;
    rows.push({
      id: `waystone-${rowIndex}`,
      level,
      affix,
      description
    });
    rowIndex += 1;
  }
  return rows;
}

function extractModsViewObject(html) {
  const start = html.indexOf('new ModsView(');
  if (start < 0) return null;
  const objectStart = html.indexOf('{', start);
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = objectStart; i < html.length; i += 1) {
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
      if (depth === 0) return html.slice(objectStart, i + 1);
    }
  }
  return null;
}

function parseModsViewRows(html, sourceId) {
  const objectSource = extractModsViewObject(html);
  if (!objectSource) return [];
  const data = Function(`return (${objectSource});`)();
  return (data.normal || []).map((row, index) => ({
    id: `${sourceId}-${index}`,
    level: String(row.Level || ''),
    affix: String(data.gen?.[row.ModGenerationTypeID] || row.ModGenerationTypeID || ''),
    description: stripTags(row.str || ''),
    name: stripTags(row.Name || ''),
    family: Array.isArray(row.ModFamilyList) ? row.ModFamilyList.join(',') : ''
  })).filter((row) => row.description);
}

function normalizeFamilyText(text) {
  return String(text || '')
    .split('\n')[0]
    .replace(/\([^)]+\)/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function regexFromDescription(text) {
  const firstLine = String(text || '').split('\n')[0] || '';
  return firstLine
    .replace(/\([^)]+\)/g, '')
    .replace(/\d+/g, '')
    .replace(/[%+#()]/g, ' ')
    .replace(/[，,。.：:；;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((part) => part.length >= 2)
    .slice(0, 4)
    .join('.*');
}

function mergeLocalizedRows(kind, localizedRows, sourceRef) {
  const englishRows = localizedRows.en || [];
  return englishRows.map((english, index) => {
    const zhCN = localizedRows.zhCN?.[index] || english;
    const zhTW = localizedRows.zhTW?.[index] || english;
    const familyKey = `${kind}:${english.affix}:${normalizeFamilyText(english.description) || english.name || index}`;
    return {
      id: `${kind}-${index}`,
      kind,
      sourceRowId: english.id,
      familyKey,
      level: english.level,
      affix: {
        en: english.affix,
        zhCN: zhCN.affix || english.affix,
        zhTW: zhTW.affix || english.affix
      },
      name: {
        en: english.name || normalizeFamilyText(english.description),
        zhCN: zhCN.name || normalizeFamilyText(zhCN.description),
        zhTW: zhTW.name || normalizeFamilyText(zhTW.description)
      },
      description: {
        en: english.description,
        zhCN: zhCN.description || english.description,
        zhTW: zhTW.description || english.description
      },
      regex: {
        en: regexFromDescription(english.description),
        zhCN: regexFromDescription(zhCN.description || english.description),
        zhTW: regexFromDescription(zhTW.description || english.description)
      },
      sourceRef
    };
  }).filter((entry) => entry.regex.en && entry.regex.zhCN && entry.regex.zhTW);
}

function groupEntries(entries) {
  const byFamily = new Map();
  for (const entry of entries) {
    const key = entry.familyKey;
    if (!byFamily.has(key)) {
      byFamily.set(key, {
        id: `group-${byFamily.size + 1}`,
        kind: entry.kind,
        familyKey: key,
        affix: entry.affix,
        name: entry.name,
        regex: entry.regex,
        rowIds: [],
        sourceRef: entry.sourceRef
      });
    }
    const group = byFamily.get(key);
    group.rowIds.push(entry.id);
  }
  return [...byFamily.values()];
}

async function fetchWaystoneCatalog() {
  const localizedRows = {};
  for (const [locale, lang] of Object.entries(locales)) {
    localizedRows[locale] = parseWaystoneRows(await fetchText(`https://poe2db.tw/${lang}/Waystones`));
  }
  return mergeLocalizedRows('waystone', localizedRows, {
    en: 'https://poe2db.tw/us/Waystones',
    zhCN: 'https://poe2db.tw/cn/Waystones',
    zhTW: 'https://poe2db.tw/tw/Waystones'
  });
}

async function fetchTabletCatalog() {
  const allEntries = [];
  for (const tabletId of tabletIds) {
    const localizedRows = {};
    for (const [locale, lang] of Object.entries(locales)) {
      localizedRows[locale] = parseModsViewRows(await fetchText(`https://poe2db.tw/${lang}/${tabletId}`), tabletId);
    }
    allEntries.push(...mergeLocalizedRows('tablet', localizedRows, {
      en: `https://poe2db.tw/us/${tabletId}`,
      zhCN: `https://poe2db.tw/cn/${tabletId}`,
      zhTW: `https://poe2db.tw/tw/${tabletId}`
    }).map((entry) => ({
      ...entry,
      id: `tablet-${tabletId}-${entry.id.replace(/^tablet-/, '')}`,
      tabletId
    })));
  }
  return allEntries;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const fetchedAt = new Date().toISOString();
  const entries = [...await fetchWaystoneCatalog(), ...await fetchTabletCatalog()];
  const catalog = {
    schema: 'poe2-tools-regex-affixes-v1',
    season: manifest.label || args.season.toUpperCase(),
    versionId: manifest.versionId,
    generatedAt: fetchedAt,
    source: {
      type: 'poe2db-waystone-tablet-modifiers',
      version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live',
      pages: {
        waystone: 'https://poe2db.tw/us/Waystones',
        tablets: tabletIds.map((id) => `https://poe2db.tw/us/${id}`)
      }
    },
    coverage: {
      waystoneEntries: entries.filter((entry) => entry.kind === 'waystone').length,
      tabletEntries: entries.filter((entry) => entry.kind === 'tablet').length,
      groups: groupEntries(entries).length,
      tabletPages: tabletIds.length,
      locales: Object.keys(locales)
    },
    entries,
    groups: groupEntries(entries)
  };
  const target = args.out
    ? path.resolve(repoRoot, args.out)
    : path.join(seasonRoot, 'regex', `affixes-poe2db-${manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live'}.json`);
  const output = `${JSON.stringify(catalog, null, 2)}\n`;
  if (args.write) {
    await mkdir(path.dirname(target), { recursive: true });
    if (!args.force) {
      try {
        await readFile(target, 'utf8');
        throw new Error(`${path.relative(repoRoot, target)} exists; pass --force to overwrite`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    await writeFile(target, output);
  }
  console.log(JSON.stringify({
    status: args.write ? 'written' : 'dry-run',
    target: path.relative(repoRoot, target),
    coverage: catalog.coverage
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
