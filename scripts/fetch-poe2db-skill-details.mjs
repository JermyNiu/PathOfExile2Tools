#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-poe2db-skill-details.mjs --season s05',
    '  node scripts/fetch-poe2db-skill-details.mjs --season s05 --out /tmp/poe2db-skill-catalog-details.json --write',
    '',
    'Fetches each manifest-registered PoE2DB skill/support page and adds compact detail metadata: source, requirement text, level range, description, and related gem table summaries.',
    'Default mode is dry-run. Use --write with --out to write the candidate catalog.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    out: null,
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--out') args.out = argv[++i];
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
    .replace(/<span class="ndash">[^<]*<\/span>/g, '-');
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<span class="ndash">[^<]*<\/span>/g, '-').replace(/[–—]/g, '-').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueByHref(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.href || item.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sectionAfterHeader(html, headerPrefix) {
  const header = new RegExp(`<h5 class="card-header">${headerPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*/\\d+[^<]*</h5>`, 'i');
  const match = header.exec(html);
  if (!match) return '';
  const start = match.index;
  const end = html.indexOf('</tbody></table>', start);
  if (end < 0) return html.slice(start, start + 3000);
  return html.slice(start, end + '</tbody></table>'.length);
}

function extractGemRows(html, headerPrefix) {
  const section = sectionAfterHeader(html, headerPrefix);
  if (!section) return [];
  return [...section.matchAll(/<tr><td>([^<]+)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)].map((match) => {
    const tier = Number(stripTags(match[1]));
    const gems = uniqueByHref([...match[2].matchAll(/<a[^>]+href="\/us\/([^"]+)"[^>]*>([^<]+)<\/a>/g)]
      .map((gemMatch) => ({
        href: decodeHtml(gemMatch[1]),
        name: stripTags(gemMatch[2])
      })));
    return {
      tier: Number.isInteger(tier) ? tier : null,
      gems
    };
  }).filter((row) => row.gems.length);
}

function extractProperty(html, label) {
  const rows = [...html.matchAll(/<div class="property">([\s\S]*?)<\/div>/g)].map((match) => stripTags(match[1]));
  return rows.find((row) => row.startsWith(`${label}:`))?.replace(`${label}:`, '').trim() || null;
}

function extractRequirements(html) {
  const match = html.match(/<div class="requirements">([\s\S]*?)<\/div>/);
  if (!match) return null;
  return stripTags(match[1]).replace(/^(Requires|Support Requirements)\s*:\s*/i, '').trim();
}

function extractDescription(html) {
  const match = html.match(/<div class="secDescrText">([\s\S]*?)<\/div>/);
  return match ? stripTags(match[1]) : null;
}

function extractFrom(html) {
  const match = html.match(/<h5 class="card-header">From\s*\/\d+<\/h5>\s*<div class="card-body">([\s\S]*?)<\/div>/);
  if (!match) return null;
  const body = match[1];
  const link = body.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
  const text = stripTags(body);
  const tier = text.match(/\bTier\s+(\d+)/i);
  return {
    text,
    item: link ? stripTags(link[2]) : text.replace(/\s+Tier\s+\d+$/i, ''),
    href: link ? decodeHtml(link[1]) : null,
    tier: tier ? Number(tier[1]) : null
  };
}

function parseNumberRange(text) {
  if (!text) return null;
  const range = String(text).replace(/[–—]/g, '-').match(/\((\d+)\s*-\s*(\d+)\)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = text.match(/\b(\d+)\b/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : null;
}

function extractRequiresLevelRange(requirements) {
  const match = String(requirements || '').replace(/[–—]/g, '-').match(/Level\s+\((\d+)\s*-\s*(\d+)\)/i);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  return null;
}

function parseDetailPage(html, entry, sourceRef, fetchedAt) {
  const levelText = extractProperty(html, 'Level');
  const reservation = extractProperty(html, 'Reservation');
  const category = extractProperty(html, 'Category');
  const requirements = extractRequirements(html);
  const detail = {
    pageFetchedAt: fetchedAt,
    sourceRef,
    from: extractFrom(html),
    tierText: extractProperty(html, 'Tier'),
    levelRange: parseNumberRange(levelText),
    requirementsText: requirements,
    requiresLevelRange: extractRequiresLevelRange(requirements),
    reservation,
    category,
    description: extractDescription(html)
  };
  if (entry.kind === 'active') {
    detail.recommendedSupportRows = extractGemRows(html, 'Recommended Support Gems');
  } else {
    detail.compatibleSkillRows = extractGemRows(html, 'Skill Gems');
  }
  return Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== null && value !== undefined));
}

async function buildCandidate(catalog) {
  const fetchedAt = new Date().toISOString();
  const details = [];
  const failures = [];
  const entries = [];
  for (const entry of catalog.entries || []) {
    const sourceRef = entry.acquisition?.sourceRef || entry.supportRequirements?.sourceRef;
    if (!sourceRef) {
      failures.push({ id: entry.id, reason: 'missing sourceRef' });
      entries.push(entry);
      continue;
    }
    try {
      const html = await fetchText(sourceRef);
      const detail = parseDetailPage(html, entry, sourceRef, fetchedAt);
      details.push({
        id: entry.id,
        kind: entry.kind,
        from: detail.from?.text || null,
        requires: detail.requirementsText || null,
        relatedRows: entry.kind === 'active'
          ? detail.recommendedSupportRows?.length || 0
          : detail.compatibleSkillRows?.length || 0
      });
      entries.push({
        ...entry,
        poe2db: {
          ...(entry.poe2db || {}),
          detail
        }
      });
    } catch (error) {
      failures.push({ id: entry.id, sourceRef, reason: error.message });
      entries.push(entry);
    }
  }
  return {
    catalog: {
      ...catalog,
      id: `${catalog.id}-details`,
      updatedAt: fetchedAt,
      source: {
        ...(catalog.source || {}),
        detailFetchedAt: fetchedAt,
        note: `${catalog.source?.note || 'PoE2DB snapshot.'} Detail pages normalized from each entry sourceRef.`
      },
      entries
    },
    details,
    failures
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
  const catalogPath = path.join(seasonRoot, manifest.skills?.catalog || 'skills/catalog.json');
  const catalog = await readJson(catalogPath);
  const { catalog: candidate, details, failures } = await buildCandidate(catalog);
  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    input: path.relative(repoRoot, catalogPath),
    output: args.out || null,
    entries: candidate.entries.length,
    detailed: details.length,
    failed: failures.length,
    failures,
    sample: details.slice(0, 6)
  };
  if (args.write) {
    await writeJson(path.resolve(args.out), candidate, args.force);
    plan.status = 'written';
  }
  console.log(JSON.stringify(plan, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
