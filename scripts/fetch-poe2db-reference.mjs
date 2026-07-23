#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = {
  en: 'us',
  zhCN: 'cn',
  zhTW: 'tw'
};

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-reference.mjs --season s05 --write --force',
    '',
    'Fetches versioned PoE2DB/Chronicle reference data that is broader than build-specific guides.',
    'Current scope: localized unique items plus listed item class pages for base items, equipment bases, currency-like items, flasks, charms, jewels, waystones, runes, catalysts, and essences.',
    'Default mode is dry-run. Use --write to update files under data/seasons/<season>/reference/poe2db/<version>.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    write: false,
    force: false
  };
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

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, data, force) {
  if (existsSync(file) && !force) throw new Error(`target file already exists: ${file}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'poe2-tools-local-data-updater/1.0'
    }
  });
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
    .replace(/<span class="ndash">[^<]*<\/span>/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function idFromHref(href) {
  return decodeURIComponent(String(href || '')
    .replace(/^\/?(us|cn|tw)\//, '')
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .pop() || '');
}

function categoryForPosition(html, index) {
  const before = html.slice(0, index);
  const matches = [...before.matchAll(/<div id="([^"]+)" class="tab-pane/g)];
  return matches.at(-1)?.[1] || 'Unique_item';
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

function collectKeywords(block) {
  const keywords = [];
  const keywordRegex = /<a data-keyword="([^"]+)"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of block.matchAll(keywordRegex)) {
    keywords.push({
      key: decodeHtml(match[1]),
      href: idFromHref(match[2]),
      text: stripTags(match[3])
    });
  }
  return keywords.filter((item) => item.key && item.text);
}

function parseUniquePage(html, lang) {
  const rows = [];
  const itemMatches = [];
  const spanRegex = new RegExp(`<a class="UniqueItem"[^>]+href="/${lang}/([^"]+)"[^>]*><span class="uniqueName">([^<]+)</span> <span class="uniqueTypeLine">([^<]+)</span></a>`, 'g');
  for (const match of html.matchAll(spanRegex)) {
    itemMatches.push({
      index: match.index,
      id: idFromHref(match[1]),
      name: stripTags(match[2]),
      typeLine: stripTags(match[3]),
      sourceRef: `https://poe2db.tw/${lang}/${idFromHref(match[1])}`
    });
  }
  const simpleRegex = /<a class="UniqueItems UniqueItem"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  for (const match of html.matchAll(simpleRegex)) {
    itemMatches.push({
      index: match.index,
      id: idFromHref(match[1]),
      name: stripTags(match[2]),
      typeLine: '',
      sourceRef: `https://poe2db.tw/${lang}/${idFromHref(match[1])}`
    });
  }
  itemMatches.sort((a, b) => a.index - b.index);
  for (let index = 0; index < itemMatches.length; index += 1) {
    const item = itemMatches[index];
    const next = itemMatches[index + 1]?.index ?? html.length;
    const block = html.slice(item.index, next);
    rows.push({
      ...item,
      category: categoryForPosition(html, item.index),
      mods: collectMods(block),
      keywords: collectKeywords(block)
    });
  }
  return rows;
}

function normalizeSourcePath(href) {
  const raw = String(href || '').trim().replace(/^\/?(us|cn|tw)\//, '').split('#')[0];
  if (!raw || raw === 'Items') return '';
  return raw.replace(/^\/+/, '');
}

function collectItemSourcePaths(itemsHtml) {
  const paths = new Set([
    'Currency',
    'Flasks',
    'Charms',
    'Jewels',
    'Waystones',
    'Runes',
    'Liquid_Emotions',
    'Essence',
    'Splinter',
    'Catalysts'
  ]);
  const excluded = new Set([
    'Unique_item',
    'Cultivated',
    'Gem',
    'Skill_Gems',
    'Support_Gems',
    'Meta_Skill_Gem',
    'Spirit_Gems',
    'Lineage_Supports',
    'Hideout',
    'Hideout_Doodads',
    'Strongbox'
  ]);
  const linkRegex = /<a([^>]+)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g;
  for (const match of itemsHtml.matchAll(linkRegex)) {
    const attrs = `${match[1]} ${match[3]}`;
    if (!attrs.includes('ItemClasses')) continue;
    const itemPath = normalizeSourcePath(match[2]);
    if (!itemPath || excluded.has(itemPath)) continue;
    paths.add(itemPath);
  }
  return [...paths].sort();
}

function pageBodyAfterForm(html) {
  const marker = '</form><div class="row';
  const index = html.indexOf(marker);
  return index >= 0 ? html.slice(index) : html;
}

function parseGenericItemPage(html, lang, sourcePath) {
  const rows = [];
  const body = pageBodyAfterForm(html);
  const itemRegex = /<a class="([^"]*(?:item_|whiteitem|magicitem|normalitem|StackableCurrency|LifeFlask|ManaFlask|UtilityFlask|Jewel|Map|SoulCore|Belt|Ring|Amulet|Helmet|Boot|Glove|BodyArmour|Sceptre|Wand|Mace|Spear|Staff|Bow|Crossbow|Shield|Buckler|Focus|Quiver|Talisman)[^"]*)"[^>]+href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const matches = [];
  for (const match of body.matchAll(itemRegex)) {
    const name = stripTags(match[3]);
    const id = idFromHref(match[2]);
    if (!id || !name || name.length > 120) continue;
    matches.push({
      index: match.index,
      id,
      name,
      itemClass: match[1].replace(/\s+/g, ' ').trim(),
      sourcePath,
      sourceRef: `https://poe2db.tw/${lang}/${id}`
    });
  }
  const seen = new Set();
  for (let index = 0; index < matches.length; index += 1) {
    const item = matches[index];
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const next = matches[index + 1]?.index ?? body.length;
    const block = body.slice(item.index, next);
    rows.push({
      ...item,
      properties: collectMods(block).filter((line) => /:/.test(line) || /需求|Requires|需求:|需求：/.test(line)),
      mods: collectMods(block),
      keywords: collectKeywords(block)
    });
  }
  return rows;
}

function parseTableCells(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
}

function parseModifierPage(html, lang) {
  const rows = [];
  const headers = [...html.matchAll(/<h5 class="card-header">([\s\S]*?)<\/h5>/g)];
  for (let cardIndex = 0; cardIndex < headers.length; cardIndex += 1) {
    const header = headers[cardIndex];
    const categoryText = stripTags(header[1]);
    const category = categoryText.replace(/\s*\/\d+\s*$/, '').trim();
    const nextHeaderIndex = headers[cardIndex + 1]?.index ?? html.length;
    const body = html.slice(header.index, nextHeaderIndex);
    let rowIndex = 0;
    for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = parseTableCells(row[1]);
      if (cells.length < 4) continue;
      const descriptionIndex = cells.length >= 6 ? 4 : 3;
      const description = stripTags(cells[descriptionIndex]);
      if (!description) continue;
      rows.push({
        id: `modifier-${cardIndex}-${rowIndex}`,
        category,
        name: stripTags(cells[0]),
        level: stripTags(cells[1]),
        domain: cells.length >= 6 ? stripTags(cells[2]) : '',
        affix: stripTags(cells[cells.length >= 6 ? 3 : 2]),
        description,
        weight: stripTags(cells[descriptionIndex + 1] || ''),
        keywords: collectKeywords(cells[descriptionIndex] || ''),
        sourceRef: `https://poe2db.tw/${lang}/Modifiers`
      });
      rowIndex += 1;
    }
    for (const [cardRowIndex, block] of body.split('<div class="col">').slice(1).entries()) {
      const mods = collectMods(block);
      if (!mods.length) continue;
      const nameMatch = block.match(/<div><a[^>]+>([\s\S]*?)<\/a><\/div>/);
      rows.push({
        id: `modifier-${cardIndex}-card-${cardRowIndex}`,
        category,
        name: nameMatch ? stripTags(nameMatch[1]) : '',
        level: '',
        domain: '',
        affix: '',
        description: mods.join('\n'),
        weight: '',
        keywords: collectKeywords(block),
        sourceRef: `https://poe2db.tw/${lang}/Modifiers`
      });
    }
  }
  return rows;
}

function uniqueRowsById(rows) {
  const rowsById = new Map();
  for (const row of rows || []) {
    const existing = rowsById.get(row.id);
    if (!existing) {
      rowsById.set(row.id, { ...row, sourceCategories: [row.category] });
      continue;
    }
    if (!existing.sourceCategories.includes(row.category)) existing.sourceCategories.push(row.category);
    if (!existing.typeLine && row.typeLine) existing.typeLine = row.typeLine;
    if ((row.mods?.length || 0) > (existing.mods?.length || 0)) existing.mods = row.mods;
    if ((row.keywords?.length || 0) > (existing.keywords?.length || 0)) existing.keywords = row.keywords;
  }
  return rowsById;
}

function mergeById(localizedRows, manifest, season, fetchedAt) {
  const englishRowsById = uniqueRowsById(localizedRows.en);
  const englishRows = [...englishRowsById.values()];
  const byLocale = Object.fromEntries(Object.entries(localizedRows).map(([locale, rows]) => [
    locale,
    uniqueRowsById(rows)
  ]));
  return {
    id: `${season}-poe2db-${manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live'}-unique-items`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    source: {
      type: 'poe2db-unique-item-page',
      version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live',
      fetchedAt,
      pages: Object.fromEntries(Object.entries(locales).map(([locale, lang]) => [
        locale,
        `https://poe2db.tw/${lang}/Unique_item`
      ]))
    },
    entries: englishRows.map((english) => {
      const zhCN = byLocale.zhCN.get(english.id);
      const zhTW = byLocale.zhTW.get(english.id);
      return {
        id: english.id,
        kind: 'unique',
        category: english.category,
        sourceCategories: english.sourceCategories,
        name: {
          en: english.name,
          zhCN: zhCN?.name || english.name,
          zhTW: zhTW?.name || english.name
        },
        typeLine: {
          en: english.typeLine,
          zhCN: zhCN?.typeLine || english.typeLine,
          zhTW: zhTW?.typeLine || english.typeLine
        },
        mods: {
          en: english.mods,
          zhCN: zhCN?.mods || [],
          zhTW: zhTW?.mods || []
        },
        keywords: {
          en: english.keywords,
          zhCN: zhCN?.keywords || [],
          zhTW: zhTW?.keywords || []
        },
        sourceRef: {
          en: english.sourceRef,
          zhCN: zhCN?.sourceRef || '',
          zhTW: zhTW?.sourceRef || ''
        }
      };
    })
  };
}

function mergeGenericItems(localizedRowsByPath, manifest, season, fetchedAt) {
  const rowsByLocale = {};
  for (const locale of Object.keys(locales)) {
    rowsByLocale[locale] = new Map();
    for (const [sourcePath, rows] of Object.entries(localizedRowsByPath[locale] || {})) {
      for (const row of rows) {
        if (!rowsByLocale[locale].has(row.id)) {
          rowsByLocale[locale].set(row.id, { ...row, sourcePaths: [sourcePath] });
        } else {
          const existing = rowsByLocale[locale].get(row.id);
          if (!existing.sourcePaths.includes(sourcePath)) existing.sourcePaths.push(sourcePath);
        }
      }
    }
  }
  const englishRows = [...(rowsByLocale.en?.values() || [])].sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: `${season}-poe2db-${manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live'}-items`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    source: {
      type: 'poe2db-item-class-pages',
      version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live',
      fetchedAt
    },
    entries: englishRows.map((english) => {
      const zhCN = rowsByLocale.zhCN.get(english.id);
      const zhTW = rowsByLocale.zhTW.get(english.id);
      return {
        id: english.id,
        kind: 'item',
        itemClass: english.itemClass,
        sourcePaths: english.sourcePaths,
        name: {
          en: english.name,
          zhCN: zhCN?.name || english.name,
          zhTW: zhTW?.name || english.name
        },
        properties: {
          en: english.properties || [],
          zhCN: zhCN?.properties || [],
          zhTW: zhTW?.properties || []
        },
        mods: {
          en: english.mods || [],
          zhCN: zhCN?.mods || [],
          zhTW: zhTW?.mods || []
        },
        keywords: {
          en: english.keywords || [],
          zhCN: zhCN?.keywords || [],
          zhTW: zhTW?.keywords || []
        },
        sourceRef: {
          en: english.sourceRef,
          zhCN: zhCN?.sourceRef || '',
          zhTW: zhTW?.sourceRef || ''
        }
      };
    })
  };
}

async function fetchUniqueItems(manifest, season) {
  const fetchedAt = new Date().toISOString();
  const localizedRows = {};
  for (const [locale, lang] of Object.entries(locales)) {
    const html = await fetchText(`https://poe2db.tw/${lang}/Unique_item`);
    localizedRows[locale] = parseUniquePage(html, lang);
  }
  return mergeById(localizedRows, manifest, season, fetchedAt);
}

async function fetchGenericItems(manifest, season) {
  const fetchedAt = new Date().toISOString();
  const usItemsHtml = await fetchText('https://poe2db.tw/us/Items');
  const sourcePaths = collectItemSourcePaths(usItemsHtml);
  const localizedRowsByPath = {};
  const skipped = [];
  for (const [locale, lang] of Object.entries(locales)) {
    localizedRowsByPath[locale] = {};
    for (const sourcePath of sourcePaths) {
      try {
        const html = await fetchText(`https://poe2db.tw/${lang}/${sourcePath}`);
        localizedRowsByPath[locale][sourcePath] = parseGenericItemPage(html, lang, sourcePath);
      } catch (error) {
        skipped.push({ locale, sourcePath, reason: error.message });
      }
    }
  }
  const catalog = mergeGenericItems(localizedRowsByPath, manifest, season, fetchedAt);
  catalog.source.pages = sourcePaths.map((sourcePath) => `https://poe2db.tw/us/${sourcePath}`);
  catalog.source.skipped = skipped;
  return catalog;
}

async function fetchModifiers(manifest, season) {
  const fetchedAt = new Date().toISOString();
  const localizedRows = {};
  for (const [locale, lang] of Object.entries(locales)) {
    const html = await fetchText(`https://poe2db.tw/${lang}/Modifiers`);
    localizedRows[locale] = parseModifierPage(html, lang);
  }
  const englishRows = localizedRows.en || [];
  const byLocale = Object.fromEntries(Object.entries(localizedRows).map(([locale, rows]) => [
    locale,
    new Map(rows.map((row) => [row.id, row]))
  ]));
  return {
    id: `${season}-poe2db-${manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live'}-modifiers`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    source: {
      type: 'poe2db-modifiers-page',
      version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live',
      fetchedAt,
      pages: Object.fromEntries(Object.entries(locales).map(([locale, lang]) => [
        locale,
        `https://poe2db.tw/${lang}/Modifiers`
      ]))
    },
    entries: englishRows.map((english) => {
      const zhCN = byLocale.zhCN.get(english.id);
      const zhTW = byLocale.zhTW.get(english.id);
      return {
        id: english.id,
        kind: 'modifier',
        category: {
          en: english.category,
          zhCN: zhCN?.category || english.category,
          zhTW: zhTW?.category || english.category
        },
        name: {
          en: english.name,
          zhCN: zhCN?.name || english.name,
          zhTW: zhTW?.name || english.name
        },
        level: english.level,
        affix: {
          en: english.affix,
          zhCN: zhCN?.affix || english.affix,
          zhTW: zhTW?.affix || english.affix
        },
        description: {
          en: english.description,
          zhCN: zhCN?.description || english.description,
          zhTW: zhTW?.description || english.description
        },
        weight: english.weight,
        keywords: {
          en: english.keywords,
          zhCN: zhCN?.keywords || [],
          zhTW: zhTW?.keywords || []
        },
        sourceRef: {
          en: english.sourceRef,
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
  const manifestPath = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const version = manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live';
  const uniqueItems = await fetchUniqueItems(manifest, args.season);
  const genericItems = await fetchGenericItems(manifest, args.season);
  const modifiers = await fetchModifiers(manifest, args.season);
  const target = path.join(seasonRoot, 'reference', 'poe2db', version, 'items', 'uniques.json');
  const itemTarget = path.join(seasonRoot, 'reference', 'poe2db', version, 'items', 'base-items.json');
  const modifiersTarget = path.join(seasonRoot, 'reference', 'poe2db', version, 'stats', 'modifiers.json');
  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    version,
    uniqueItems: {
      entries: uniqueItems.entries.length,
      missingZhCN: uniqueItems.entries.filter((entry) => !entry.name.zhCN).length,
      missingZhTW: uniqueItems.entries.filter((entry) => !entry.name.zhTW).length,
      withTypeLine: uniqueItems.entries.filter((entry) => entry.typeLine.en).length,
      withMods: uniqueItems.entries.filter((entry) => entry.mods.en.length).length
    },
    items: {
      entries: genericItems.entries.length,
      sourcePages: genericItems.source.pages.length,
      skippedPages: genericItems.source.skipped.length,
      missingZhCN: genericItems.entries.filter((entry) => !entry.name.zhCN).length,
      missingZhTW: genericItems.entries.filter((entry) => !entry.name.zhTW).length,
      withMods: genericItems.entries.filter((entry) => entry.mods.en.length).length
    },
    modifiers: {
      entries: modifiers.entries.length,
      missingZhCN: modifiers.entries.filter((entry) => !entry.description.zhCN).length,
      missingZhTW: modifiers.entries.filter((entry) => !entry.description.zhTW).length
    },
    targets: {
      uniques: path.relative(repoRoot, target),
      items: path.relative(repoRoot, itemTarget),
      modifiers: path.relative(repoRoot, modifiersTarget)
    }
  };
  if (args.write) {
    await writeJson(target, uniqueItems, args.force);
    await writeJson(itemTarget, genericItems, args.force);
    await writeJson(modifiersTarget, modifiers, args.force);
    plan.status = 'written';
  }
  console.log(JSON.stringify(plan, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
