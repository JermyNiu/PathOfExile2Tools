#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = { en: 'us', zhCN: 'cn', zhTW: 'tw' };

const defaultIds = [
  'Runeforged_Sleek_Jacket',
  'Guiding_Palm_of_the_Heart',
  'Mageblood',
  'Sapphire_Ring',
  'The_Ordained',
  'Daggerfoot_Shoes',
  'Gold_Amulet',
  'Runeforged_Fists_of_Stone',
  'Soaring_Spear',
  'The_Black_Insignia',
  'The_Taming',
  'Ultimate_Mana_Flask',
  'Ultimate_Life_Flask',
  'Rite_of_Passage',
  'Silver_Charm',
  'Nascent_Hope',
  'Heart_of_the_Well'
];

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-item-details.mjs --season s05 --write --force',
    '  node scripts/fetch-poe2db-item-details.mjs --season s05 --ids Mageblood,Ultimate_Life_Flask --write --force',
    '',
    'Fetches localized PoE2DB item detail pages for item/base ids that appear in parsed imports.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { season: 's05', ids: defaultIds, write: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--ids') args.ids = argv[++i].split(',').map((id) => id.trim()).filter(Boolean);
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
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

function collectBlocks(html, classNames) {
  const rows = [];
  const regex = new RegExp(`<div class="(?:${classNames.join('|')})">([\\s\\S]*?)<\\/div>`, 'g');
  for (const match of html.matchAll(regex)) {
    const text = stripTags(match[1]);
    if (text) rows.push(text);
  }
  return [...new Set(rows)];
}

function parsePageImage(html) {
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1];
  if (ogImage) return decodeHtml(ogImage);
  const itemImage = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i)?.[1];
  return itemImage ? decodeHtml(itemImage) : '';
}

function parseDetailPage(html, lang, id) {
  const title = stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/\s+-\s+.*$/, '');
  return {
    id,
    title,
    icon: parsePageImage(html),
    properties: collectBlocks(html, ['property']),
    mods: collectBlocks(html, ['requirements', 'implicitMod', 'explicitMod', 'poe2 mutatedMod']),
    sourceRef: `https://poe2db.tw/${lang}/${id}`
  };
}

function mergeDetails(localizedRows, manifest, season, version, fetchedAt, skipped) {
  const ids = Object.keys(localizedRows.en || {});
  return {
    id: `${season}-poe2db-${version}-item-details`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    source: {
      type: 'poe2db-item-detail-pages',
      version,
      fetchedAt,
      skipped
    },
    entries: ids.map((id) => {
      const en = localizedRows.en[id] || {};
      const zhCN = localizedRows.zhCN[id] || {};
      const zhTW = localizedRows.zhTW[id] || {};
      return {
        id,
        kind: 'item-detail',
        title: {
          en: en.title || id,
          zhCN: zhCN.title || en.title || id,
          zhTW: zhTW.title || en.title || id
        },
        icon: {
          en: en.icon || '',
          zhCN: zhCN.icon || en.icon || '',
          zhTW: zhTW.icon || en.icon || ''
        },
        properties: {
          en: en.properties || [],
          zhCN: zhCN.properties || [],
          zhTW: zhTW.properties || []
        },
        mods: {
          en: en.mods || [],
          zhCN: zhCN.mods || [],
          zhTW: zhTW.mods || []
        },
        sourceRef: {
          en: en.sourceRef || '',
          zhCN: zhCN.sourceRef || '',
          zhTW: zhTW.sourceRef || ''
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
  const localizedRows = Object.fromEntries(Object.keys(locales).map((locale) => [locale, {}]));
  const skipped = [];
  const fetchedAt = new Date().toISOString();

  for (const [locale, lang] of Object.entries(locales)) {
    for (const id of args.ids) {
      try {
        const html = await fetchText(`https://poe2db.tw/${lang}/${id}`);
        localizedRows[locale][id] = parseDetailPage(html, lang, id);
      } catch (error) {
        skipped.push({ locale, id, reason: error.message });
      }
    }
  }

  const catalog = mergeDetails(localizedRows, manifest, args.season, version, fetchedAt, skipped);
  const target = path.join(seasonRoot, 'reference', 'poe2db', version, 'items', 'item-details.json');
  const report = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    version,
    requestedIds: args.ids.length,
    entries: catalog.entries.length,
    withProperties: catalog.entries.filter((entry) => entry.properties.en.length).length,
    withMods: catalog.entries.filter((entry) => entry.mods.en.length).length,
    skipped: skipped.length,
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
