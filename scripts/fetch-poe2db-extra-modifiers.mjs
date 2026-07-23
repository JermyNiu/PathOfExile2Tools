#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = { en: 'us', zhCN: 'cn', zhTW: 'tw' };
const pages = ['Desecrated_Modifiers', 'Runes', 'Charms', 'Flasks'];

function parseArgs(argv) {
  const args = { season: 's05', write: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
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
    '  node scripts/fetch-poe2db-extra-modifiers.mjs --season s05 --write --force',
    '',
    'Fetches localized PoE2DB modifier-like pages used by parsed equipment: Desecrated modifiers, runes, charms, and flasks.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, data, force) {
  if (existsSync(file) && !force) throw new Error(`target file already exists: ${file}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'poe2-tools-local-data-updater/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value) {
  return decodeHtml(String(value)
    .replace(/<span class="secondary">[\s\S]*?<\/span>/g, ' ')
    .replace(/<span class="badge[^"]*"[^>]*>[\s\S]*?<\/span>/g, ' ')
    .replace(/<span class="ndash">[^<]*<\/span>/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function parseCells(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
}

function collectMods(block) {
  const mods = [];
  const modRegex = /<div class="(?:requirements|implicitMod|explicitMod|poe2 mutatedMod)">([\s\S]*?)<\/div>/g;
  for (const match of block.matchAll(modRegex)) {
    const text = stripTags(match[1]);
    if (text) mods.push(text);
  }
  return [...new Set(mods)];
}

function parsePage(html, lang, page) {
  const rows = [];
  let rowIndex = 0;
  const headers = [...html.matchAll(/<h5 class="card-header">([\s\S]*?)<\/h5>/g)];
  const sections = headers.length
    ? headers.map((header, index) => ({
      category: stripTags(header[1]).replace(/\s*\/\d+\s*$/, '').trim(),
      body: html.slice(header.index, headers[index + 1]?.index ?? html.length)
    }))
    : [{ category: page, body: html }];

  for (const section of sections) {
    for (const row of section.body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = parseCells(row[1]);
      if (cells.length < 4) continue;
      const descriptionIndex = cells.length >= 6 ? 4 : 3;
      const description = stripTags(cells[descriptionIndex]);
      if (!description || /^Description$/i.test(description)) continue;
      rows.push({
        id: `${page}-${rowIndex}`,
        page,
        category: section.category || page,
        name: stripTags(cells[0]),
        level: stripTags(cells[1]),
        affix: stripTags(cells[cells.length >= 6 ? 3 : 2]),
        description,
        sourceRef: `https://poe2db.tw/${lang}/${page}`
      });
      rowIndex += 1;
    }
    for (const [cardIndex, block] of section.body.split('<div class="col">').slice(1).entries()) {
      const mods = collectMods(block);
      if (!mods.length) continue;
      const nameMatch = block.match(/<div><a[^>]+>([\s\S]*?)<\/a><\/div>/);
      rows.push({
        id: `${page}-card-${rowIndex}-${cardIndex}`,
        page,
        category: section.category || page,
        name: nameMatch ? stripTags(nameMatch[1]) : '',
        level: '',
        affix: '',
        description: mods.join('\n'),
        sourceRef: `https://poe2db.tw/${lang}/${page}`
      });
      rowIndex += 1;
    }
  }
  return rows;
}

function merge(localizedRows, manifest, season, version, fetchedAt, skipped) {
  const englishRows = localizedRows.en || [];
  const byLocale = Object.fromEntries(Object.entries(localizedRows).map(([locale, rows]) => [
    locale,
    new Map(rows.map((row) => [row.id, row]))
  ]));
  return {
    id: `${season}-poe2db-${version}-extra-modifiers`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    source: {
      type: 'poe2db-extra-modifier-pages',
      version,
      fetchedAt,
      pages: Object.fromEntries(Object.entries(locales).map(([locale, lang]) => [
        locale,
        pages.map((page) => `https://poe2db.tw/${lang}/${page}`)
      ])),
      skipped
    },
    entries: englishRows.map((en) => {
      const zhCN = byLocale.zhCN.get(en.id);
      const zhTW = byLocale.zhTW.get(en.id);
      return {
        id: en.id,
        kind: 'extra-modifier',
        page: en.page,
        category: {
          en: en.category,
          zhCN: zhCN?.category || en.category,
          zhTW: zhTW?.category || en.category
        },
        name: {
          en: en.name,
          zhCN: zhCN?.name || en.name,
          zhTW: zhTW?.name || en.name
        },
        affix: {
          en: en.affix,
          zhCN: zhCN?.affix || en.affix,
          zhTW: zhTW?.affix || en.affix
        },
        description: {
          en: en.description,
          zhCN: zhCN?.description || en.description,
          zhTW: zhTW?.description || en.description
        },
        sourceRef: {
          en: en.sourceRef,
          zhCN: zhCN?.sourceRef || '',
          zhTW: zhTW?.sourceRef || ''
        }
      };
    })
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
  const version = manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live';
  const fetchedAt = new Date().toISOString();
  const localizedRows = {};
  const skipped = [];
  for (const [locale, lang] of Object.entries(locales)) {
    localizedRows[locale] = [];
    for (const page of pages) {
      try {
        const html = await fetchText(`https://poe2db.tw/${lang}/${page}`);
        localizedRows[locale].push(...parsePage(html, lang, page));
      } catch (error) {
        skipped.push({ locale, page, reason: error.message });
      }
    }
  }
  const catalog = merge(localizedRows, manifest, args.season, version, fetchedAt, skipped);
  const target = path.join(seasonRoot, 'reference', 'poe2db', version, 'stats', 'extra-modifiers.json');
  const report = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    version,
    entries: catalog.entries.length,
    pages: pages.length,
    skipped: skipped.length,
    missingZhCN: catalog.entries.filter((entry) => !entry.description.zhCN).length,
    missingZhTW: catalog.entries.filter((entry) => !entry.description.zhTW).length,
    target: path.relative(repoRoot, target)
  };
  if (args.write) {
    await writeJson(target, catalog, args.force);
    report.status = 'written';
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
