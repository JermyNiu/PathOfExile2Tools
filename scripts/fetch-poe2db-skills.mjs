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

const defaultAliases = {
  'frost-mage': ['Skeletal Frost Mage', 'Frost Mage'],
  cleric: ['Skeletal Cleric', 'Cleric'],
  arsonist: ['Skeletal Arsonist', 'Arsonist'],
  'storm-mage': ['Skeletal Storm Mage', 'Storm Mage'],
  reaver: ['Skeletal Reaver', 'Reaver'],
  sniper: ['Skeletal Sniper', 'Sniper'],
  brute: ['Skeletal Brute', 'Brute'],
  'meat-shield': ['Meat Shield I', 'Meat Shield'],
  'culling-strike': ['Culling Strike I', 'Culling Strike']
};

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-skills.mjs --season s05',
    '  node scripts/fetch-poe2db-skills.mjs --season s05 --complete --out /tmp/poe2db-complete-skill-catalog.json --write',
    '  node scripts/fetch-poe2db-skills.mjs --season s05 --out /tmp/poe2db-skill-catalog.json --write',
    '',
    'Fetches PoE2DB/Chronicle Skill_Gems and Support_Gems pages.',
    'Default mode matches the skill/support ids used by registered builds and writes a verified catalog candidate only when every referenced id is covered.',
    '--complete writes every scraped skill/support gem row with localized names for the selected version.',
    'Default mode is dry-run. Use --write with --out to write the candidate catalog.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    out: null,
    write: false,
    force: false,
    complete: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--complete') args.complete = true;
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
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, '').trim());
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseGemPage(html, lang, kind) {
  const rows = [];
  const parts = html.split('<tr data-filters="').slice(1);
  for (const part of parts) {
    const filterEnd = part.indexOf('"');
    if (filterEnd < 0) continue;
    const filterText = decodeHtml(part.slice(0, filterEnd));
    const next = part.split('<tr data-filters="')[0];
    const linkPattern = new RegExp(`<a[^>]+href="/${lang}/([^"]+)"[^>]*>([^<]+)</a>`, 'g');
    const links = [...next.matchAll(linkPattern)]
      .map((match) => ({ href: decodeHtml(match[1]), text: stripTags(match[2]) }))
      .filter((link) => link.text && !link.text.includes('/'));
    const nameLink = links.find((link) => new RegExp(`>${link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a> \\(\\d+\\)`).test(next)) || links.at(-1);
    if (!nameLink) continue;
    const tierMatch = next.match(new RegExp(`>${nameLink.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a> \\((\\d+)\\)`));
    const tagMatches = [...next.matchAll(/<a data-keyword="[^"]+"[^>]*>([^<]+)<\/a>/g)].map((match) => stripTags(match[1]));
    rows.push({
      kind,
      href: nameLink.href,
      name: nameLink.text,
      normalizedName: normalizeName(nameLink.text),
      poe2dbGemTier: tierMatch ? Number(tierMatch[1]) : null,
      tags: [...new Set(tagMatches.length ? tagMatches : filterText.split(/\s+/).filter(Boolean))],
      sourceRef: `https://poe2db.tw/${lang}/${nameLink.href}`
    });
  }
  return rows;
}

function indexRows(rows) {
  return {
    byName: new Map(rows.map((row) => [row.normalizedName, row])),
    byHref: new Map(rows.map((row) => [row.href, row]))
  };
}

function sourceNames(entry) {
  return [
    ...(defaultAliases[entry.id] || []),
    entry.name?.en
  ].filter(Boolean);
}

function matchEnglishEntry(entry, englishIndexes) {
  const wantedKind = entry.kind === 'support' ? 'support' : 'active';
  const index = englishIndexes[wantedKind];
  for (const name of sourceNames(entry)) {
    const row = index.byName.get(normalizeName(name));
    if (row) return row;
  }
  return null;
}

function localizedByHref(href, indexes, fallback) {
  return indexes.byHref.get(href)?.name || fallback;
}

function normalizeTags(tags) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function idFromHref(href) {
  return String(href || '')
    .split(/[/?#]/)
    .filter(Boolean)
    .pop()
    ?.replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || '';
}

function allRows(index) {
  return [...index.byHref.values()];
}

function completeEntryKey(entry) {
  return `${entry.kind}:${normalizeName(entry.name?.en || entry.id || entry.poe2db?.href || '')}`;
}

function uniqueEntryId(id, kind, usedIds) {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }
  const kindId = `${id}_${kind}`;
  if (!usedIds.has(kindId)) {
    usedIds.add(kindId);
    return kindId;
  }
  let index = 2;
  while (usedIds.has(`${kindId}_${index}`)) index += 1;
  const next = `${kindId}_${index}`;
  usedIds.add(next);
  return next;
}

function buildCompleteCatalog(indexes, manifest, season, seedCatalog) {
  const entries = [...(seedCatalog.entries || [])];
  const usedIds = new Set(entries.map((entry) => entry.id));
  const usedKeys = new Set(entries.map(completeEntryKey));
  const fetchedAt = new Date().toISOString();
  for (const kind of ['active', 'support']) {
    for (const english of allRows(indexes.en[kind])) {
      const baseId = idFromHref(english.href) || normalizeName(english.name);
      const entryKey = `${kind}:${normalizeName(english.name)}`;
      if (usedKeys.has(entryKey)) continue;
      const id = uniqueEntryId(baseId, kind, usedIds);
      const zhCN = localizedByHref(english.href, indexes.zhCN[kind], english.name);
      const zhTW = localizedByHref(english.href, indexes.zhTW[kind], english.name);
      entries.push({
        id,
        kind,
        name: {
          zhCN,
          zhTW,
          en: english.name
        },
        verificationStatus: 'verified',
        tags: normalizeTags(english.tags),
        poe2db: {
          href: english.href,
          gemTier: english.poe2dbGemTier
        },
        ...(kind === 'active'
          ? {
              acquisition: {
                act: null,
                level: null,
                sourceRef: english.sourceRef
              }
            }
          : {
              supportRequirements: {
                sourceRef: english.sourceRef
              }
          })
      });
      usedKeys.add(entryKey);
    }
  }
  return {
    id: `${season}-poe2db-complete-skill-catalog-v1`,
    season: manifest.label || season.toUpperCase(),
    versionId: manifest.versionId,
    updatedAt: fetchedAt,
    source: {
      type: 'poe2db-snapshot-v1',
      version: manifest.reference?.version || manifest.tree?.poe2dbVersion || 'live-skill-gems-pages',
      fetchedAt,
      note: 'Complete localized Skill_Gems and Support_Gems list-page snapshot from PoE2DB/Chronicle.'
    },
    entries
  };
}

async function loadPoe2dbIndexes() {
  const pages = {};
  for (const [locale, lang] of Object.entries(locales)) {
    const [skillHtml, supportHtml] = await Promise.all([
      fetchText(`https://poe2db.tw/${lang}/Skill_Gems`),
      fetchText(`https://poe2db.tw/${lang}/Support_Gems`)
    ]);
    pages[locale] = {
      active: indexRows(parseGemPage(skillHtml, lang, 'active')),
      support: indexRows(parseGemPage(supportHtml, lang, 'support'))
    };
  }
  return pages;
}

function buildCandidate(seedCatalog, indexes, versionId) {
  const entries = [];
  const matched = [];
  const missing = [];
  const englishIndexes = indexes.en;

  for (const entry of seedCatalog.entries || []) {
    const english = matchEnglishEntry(entry, englishIndexes);
    if (!english) {
      missing.push({
        id: entry.id,
        kind: entry.kind,
        currentName: entry.name?.en || entry.id,
        triedNames: sourceNames(entry)
      });
      entries.push(entry);
      continue;
    }

    const kindKey = entry.kind === 'support' ? 'support' : 'active';
    const zhCN = localizedByHref(english.href, indexes.zhCN[kindKey], entry.name?.zhCN || english.name);
    const zhTW = localizedByHref(english.href, indexes.zhTW[kindKey], entry.name?.zhTW || english.name);
    matched.push({
      id: entry.id,
      kind: entry.kind,
      poe2dbName: english.name,
      href: english.href,
      poe2dbGemTier: english.poe2dbGemTier
    });
    entries.push({
      ...entry,
      name: {
        zhCN,
        zhTW,
        en: english.name
      },
      verificationStatus: 'verified',
      tags: normalizeTags(english.tags),
      poe2db: {
        href: english.href,
        gemTier: english.poe2dbGemTier
      },
      ...(entry.kind === 'active'
        ? {
            acquisition: {
              ...(entry.acquisition || {}),
              sourceRef: english.sourceRef
            }
          }
        : {
            supportRequirements: {
              ...(entry.supportRequirements || {}),
              sourceRef: english.sourceRef
            }
          })
    });
  }

  return {
    catalog: {
      id: `${seedCatalog.season.toLowerCase()}-poe2db-skill-catalog-v1`,
      season: seedCatalog.season,
      versionId,
      updatedAt: new Date().toISOString(),
      source: {
        type: missing.length ? 'manual-seed-needs-poe2db' : 'poe2db-snapshot-v1',
        version: 'live-skill-gems-pages',
        fetchedAt: new Date().toISOString(),
        note: missing.length
          ? 'Partial PoE2DB scrape. Missing entries must be mapped before this can be archived as a verified snapshot.'
          : 'Normalized from PoE2DB Skill_Gems and Support_Gems list pages.'
      },
      entries
    },
    matched,
    missing
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.write && !args.out) throw new Error('--out is required with --write');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const seedCatalogPath = args.complete
    ? 'skills/snapshots/catalog-live-poe2db-details.json'
    : (manifest.skills?.catalog || 'skills/catalog.json');
  const seedCatalog = await readJson(path.join(seasonRoot, seedCatalogPath));
  const indexes = await loadPoe2dbIndexes();
  const verifiedSeed = args.complete ? buildCandidate(seedCatalog, indexes, manifest.versionId).catalog : seedCatalog;
  const completeCatalog = args.complete ? buildCompleteCatalog(indexes, manifest, args.season, verifiedSeed) : null;
  const { catalog, matched, missing } = args.complete
    ? { catalog: completeCatalog, matched: [], missing: [] }
    : buildCandidate(seedCatalog, indexes, manifest.versionId);
  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    complete: args.complete,
    sourcePages: [
      'https://poe2db.tw/us/Skill_Gems',
      'https://poe2db.tw/us/Support_Gems',
      'https://poe2db.tw/cn/Skill_Gems',
      'https://poe2db.tw/cn/Support_Gems',
      'https://poe2db.tw/tw/Skill_Gems',
      'https://poe2db.tw/tw/Support_Gems'
    ],
    entries: catalog.entries.length,
    activeEntries: catalog.entries.filter((entry) => entry.kind === 'active').length,
    supportEntries: catalog.entries.filter((entry) => entry.kind === 'support').length,
    matched: matched.length,
    missing: missing.length,
    missingEntries: missing,
    output: args.out || null,
    candidateSourceType: catalog.source.type,
    canArchive: missing.length === 0
  };

  if (args.write) {
    await writeJson(path.resolve(args.out), catalog, args.force);
    plan.status = 'written';
  }

  console.log(JSON.stringify(plan, null, 2));
  if (missing.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
