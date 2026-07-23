#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];

function parseArgs(argv) {
  const args = { season: 's05', file: null, kind: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--kind') args.kind = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-market.mjs [--season s05]',
    '  node scripts/validate-market.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json',
    '',
    'Checks market snapshot JSON files registered in data/seasons/<season>/manifest.json and the market/candidates/index.json review queue.',
    'Use --file and --kind to validate one candidate snapshot before registering it in the manifest.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIsoDateString(value) {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

function validateLocalizedText(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing localized object`, failures);
  for (const locale of locales) {
    assert(typeof value?.[locale] === 'string' && value[locale].trim().length > 0, `${label} missing ${locale}`, failures);
  }
}

function validateRealSnapshotSource(data, file, failures) {
  if (data.source?.type !== 'real-snapshot-v1') return;

  assert(data.snapshotSchemaVersion === 1, `${file} real snapshot must use snapshotSchemaVersion=1`, failures);
  assert(typeof data.source?.provider === 'string' && data.source.provider.trim().length > 0, `${file} real snapshot missing source.provider`, failures);
  assert(typeof data.source?.league === 'string' && data.source.league.trim().length > 0, `${file} real snapshot missing source.league`, failures);
  assert(isIsoDateString(data.source?.fetchedAt), `${file} real snapshot missing valid source.fetchedAt`, failures);
  assert(isIsoDateString(data.updatedAt), `${file} real snapshot missing valid updatedAt`, failures);
  assert(data.source?.filters && typeof data.source.filters === 'object', `${file} real snapshot missing source.filters`, failures);
  assert(Array.isArray(data.source?.filters?.abnormalPriceRules) && data.source.filters.abnormalPriceRules.length > 0, `${file} real snapshot missing source.filters.abnormalPriceRules`, failures);
  assert(Number.isInteger(data.source?.filters?.minListingDepth) && data.source.filters.minListingDepth > 0, `${file} real snapshot missing source.filters.minListingDepth`, failures);
}

function validateEntryMarketEvidence(entry, label, failures, minListingDepth = 0) {
  const evidence = entry.marketEvidence;
  assert(evidence && typeof evidence === 'object', `${label} missing marketEvidence for real snapshot`, failures);
  assert(isIsoDateString(evidence?.observedAt), `${label} missing valid marketEvidence.observedAt`, failures);
  assert(Number.isInteger(evidence?.buyListingCount) && evidence.buyListingCount >= 0, `${label} invalid marketEvidence.buyListingCount`, failures);
  assert(Number.isInteger(evidence?.sellListingCount) && evidence.sellListingCount >= 0, `${label} invalid marketEvidence.sellListingCount`, failures);
  assert(Number.isInteger(evidence?.buyListingCount) && evidence.buyListingCount >= minListingDepth, `${label} marketEvidence.buyListingCount below minListingDepth`, failures);
  assert(Number.isInteger(evidence?.sellListingCount) && evidence.sellListingCount >= minListingDepth, `${label} marketEvidence.sellListingCount below minListingDepth`, failures);
  assert(isFiniteNumber(evidence?.priceConfidence) && evidence.priceConfidence >= 0 && evidence.priceConfidence <= 100, `${label} invalid marketEvidence.priceConfidence`, failures);
  assert(typeof evidence?.depthNote === 'string' && evidence.depthNote.trim().length > 0, `${label} missing marketEvidence.depthNote`, failures);
}

function marketEvidenceStats(entries) {
  const evidenceEntries = (entries || []).filter((entry) => entry.marketEvidence);
  if (!evidenceEntries.length) {
    return { avgConfidence: 0, minBuyDepth: 0, minSellDepth: 0 };
  }
  const confidences = evidenceEntries.map((entry) => Number(entry.marketEvidence.priceConfidence)).filter(Number.isFinite);
  const buyDepths = evidenceEntries.map((entry) => Number(entry.marketEvidence.buyListingCount)).filter(Number.isFinite);
  const sellDepths = evidenceEntries.map((entry) => Number(entry.marketEvidence.sellListingCount)).filter(Number.isFinite);
  return {
    avgConfidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)) : 0,
    minBuyDepth: buyDepths.length ? Math.min(...buyDepths) : 0,
    minSellDepth: sellDepths.length ? Math.min(...sellDepths) : 0
  };
}

function marketFreshness(data) {
  if (data.source?.type !== 'real-snapshot-v1') {
    return { freshnessStatus: 'sample-not-live', freshnessAgeHours: null };
  }
  const timestamp = data.source?.fetchedAt || data.updatedAt;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return { freshnessStatus: 'unknown', freshnessAgeHours: null };
  const freshnessAgeHours = Math.max(0, (Date.now() - time) / 3600000);
  return {
    freshnessStatus: freshnessAgeHours <= 6 ? 'fresh' : 'stale',
    freshnessAgeHours: Number(freshnessAgeHours.toFixed(2))
  };
}

function validateBaseSnapshot(data, kind, file, failures) {
  assert(typeof data.id === 'string' && data.id.trim().length > 0, `${file} missing id`, failures);
  assert(typeof data.season === 'string' && data.season.trim().length > 0, `${file} missing season`, failures);
  assert(typeof data.versionId === 'string' && data.versionId.trim().length > 0, `${file} missing versionId`, failures);
  assert(typeof data.updatedAt === 'string' && data.updatedAt.trim().length > 0, `${file} missing updatedAt`, failures);
  assert(data.source && typeof data.source === 'object', `${file} missing source`, failures);
  assert(typeof data.source?.type === 'string' && data.source.type.trim().length > 0, `${file} missing source.type`, failures);
  assert(['sample-manual-seed', 'real-snapshot-v1'].includes(data.source?.type), `${file} unsupported source.type ${data.source?.type}`, failures);
  assert(typeof data.source?.note === 'string' && data.source.note.trim().length > 0, `${file} missing source.note`, failures);
  assert(data.currency === 'exalted', `${file} currency should be exalted`, failures);
  assert(isFiniteNumber(data.feeRate) && data.feeRate >= 0 && data.feeRate < 1, `${file} invalid feeRate`, failures);
  assert(data.scoreWeights && typeof data.scoreWeights === 'object', `${file} missing scoreWeights`, failures);
  assert(Array.isArray(data.entries), `${file} missing entries`, failures);
  assert(data.entries?.length > 0, `${file} entries empty`, failures);
  assert(kind === 'gemFlips' || kind === 'hideoutFlips', `${file} unknown market kind ${kind}`, failures);
  validateRealSnapshotSource(data, file, failures);
}

function validateGemFlip(data, file) {
  const failures = [];
  validateBaseSnapshot(data, 'gemFlips', file, failures);
  const minListingDepth = data.source?.filters?.minListingDepth || 0;
  for (const key of ['netProfit', 'roi', 'liquidity', 'risk']) {
    assert(isFiniteNumber(data.scoreWeights?.[key]), `${file} missing score weight ${key}`, failures);
  }

  const seen = new Set();
  for (const [index, entry] of (data.entries || []).entries()) {
    const label = `${file} entries[${index}]`;
    assert(typeof entry.id === 'string' && entry.id.trim().length > 0, `${label} missing id`, failures);
    assert(!seen.has(entry.id), `${label} duplicate id ${entry.id}`, failures);
    seen.add(entry.id);
    assert(['active', 'support'].includes(entry.category), `${label} invalid category`, failures);
    validateLocalizedText(entry.name, `${label}.name`, failures);
    validateLocalizedText(entry.notes, `${label}.notes`, failures);
    assert(Number.isInteger(entry.targetLevel) && entry.targetLevel > 0, `${label} invalid targetLevel`, failures);
    assert(isFiniteNumber(entry.quality) && entry.quality >= 0, `${label} invalid quality`, failures);
    assert(isFiniteNumber(entry.buyPrice) && entry.buyPrice >= 0, `${label} invalid buyPrice`, failures);
    assert(isFiniteNumber(entry.sellPrice) && entry.sellPrice >= 0, `${label} invalid sellPrice`, failures);
    assert(isFiniteNumber(entry.liquidity) && entry.liquidity >= 0 && entry.liquidity <= 100, `${label} invalid liquidity`, failures);
    assert(isFiniteNumber(entry.risk) && entry.risk >= 0 && entry.risk <= 100, `${label} invalid risk`, failures);
    if (data.source?.type === 'real-snapshot-v1') validateEntryMarketEvidence(entry, label, failures, minListingDepth);
    const fee = entry.sellPrice * data.feeRate;
    const netProfit = entry.sellPrice - entry.buyPrice - fee;
    const roi = entry.buyPrice > 0 ? netProfit / entry.buyPrice : 0;
    assert(Number.isFinite(fee) && Number.isFinite(netProfit) && Number.isFinite(roi), `${label} invalid computed profit`, failures);
  }
  return failures;
}

function validateHideoutFlip(data, file) {
  const failures = [];
  validateBaseSnapshot(data, 'hideoutFlips', file, failures);
  const minListingDepth = data.source?.filters?.minListingDepth || 0;
  assert(Number.isInteger(data.goldUnit) && data.goldUnit > 0, `${file} invalid goldUnit`, failures);
  for (const key of ['netProfit', 'profitPerGoldUnit', 'liquidity', 'risk']) {
    assert(isFiniteNumber(data.scoreWeights?.[key]), `${file} missing score weight ${key}`, failures);
  }

  const seen = new Set();
  for (const [index, entry] of (data.entries || []).entries()) {
    const label = `${file} entries[${index}]`;
    assert(typeof entry.id === 'string' && entry.id.trim().length > 0, `${label} missing id`, failures);
    assert(!seen.has(entry.id), `${label} duplicate id ${entry.id}`, failures);
    seen.add(entry.id);
    assert(['currency', 'crafting', 'base', 'map'].includes(entry.category), `${label} invalid category`, failures);
    validateLocalizedText(entry.name, `${label}.name`, failures);
    validateLocalizedText(entry.notes, `${label}.notes`, failures);
    assert(Number.isInteger(entry.goldCost) && entry.goldCost > 0, `${label} invalid goldCost`, failures);
    assert(isFiniteNumber(entry.cashCost) && entry.cashCost >= 0, `${label} invalid cashCost`, failures);
    assert(isFiniteNumber(entry.sellPrice) && entry.sellPrice >= 0, `${label} invalid sellPrice`, failures);
    assert(isFiniteNumber(entry.liquidity) && entry.liquidity >= 0 && entry.liquidity <= 100, `${label} invalid liquidity`, failures);
    assert(isFiniteNumber(entry.risk) && entry.risk >= 0 && entry.risk <= 100, `${label} invalid risk`, failures);
    if (data.source?.type === 'real-snapshot-v1') validateEntryMarketEvidence(entry, label, failures, minListingDepth);
    const fee = entry.sellPrice * data.feeRate;
    const netProfit = entry.sellPrice - entry.cashCost - fee;
    const profitPerGoldUnit = netProfit / entry.goldCost * data.goldUnit;
    assert(Number.isFinite(fee) && Number.isFinite(netProfit) && Number.isFinite(profitPerGoldUnit), `${label} invalid computed profit`, failures);
  }
  return failures;
}

function resolveMarketFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

async function validateMarketFile(seasonRoot, kind, file) {
  if (!file) {
    return { kind, file, status: 'skipped', failures: [] };
  }

  const fullPath = resolveMarketFile(seasonRoot, file);
  let data;
  try {
    data = await readJson(fullPath);
  } catch (error) {
    return { kind, file, status: 'failed', failures: [`Cannot read market JSON: ${error.message}`] };
  }

  const failures = kind === 'gemFlips'
    ? validateGemFlip(data, file)
    : validateHideoutFlip(data, file);
  const evidenceEntries = (data.entries || []).filter((entry) => entry.marketEvidence).length;
  const evidenceStats = marketEvidenceStats(data.entries || []);
  const filters = data.source?.filters || null;
  const freshness = marketFreshness(data);

  return {
    kind,
    file,
    status: failures.length ? 'failed' : 'ok',
    sourceType: data.source?.type,
    snapshotSchemaVersion: data.snapshotSchemaVersion,
    updatedAt: data.updatedAt,
    currency: data.currency,
    entries: data.entries?.length || 0,
    evidenceEntries,
    evidenceMissing: (data.entries?.length || 0) - evidenceEntries,
    avgEvidenceConfidence: evidenceStats.avgConfidence,
    minEvidenceBuyDepth: evidenceStats.minBuyDepth,
    minEvidenceSellDepth: evidenceStats.minSellDepth,
    hasRealSnapshotFilters: Boolean(filters),
    minListingDepth: filters?.minListingDepth || 0,
    freshnessStatus: freshness.freshnessStatus,
    freshnessAgeHours: freshness.freshnessAgeHours,
    failures
  };
}

function validateCandidateIndexShape(index, label, failures) {
  assert(index && typeof index === 'object', `${label} missing object`, failures);
  assert(index?.schemaVersion === 1, `${label}.schemaVersion must be 1`, failures);
  assert(isIsoDateString(index?.updatedAt), `${label}.updatedAt missing valid timestamp`, failures);
  assert(Array.isArray(index?.candidates), `${label}.candidates should be an array`, failures);
}

function validateCandidateIndexRow(row, label, failures) {
  assert(row && typeof row === 'object', `${label} missing object`, failures);
  assert(typeof row.key === 'string' && row.key.trim().length > 0, `${label}.key missing`, failures);
  assert(['gemFlips', 'hideoutFlips'].includes(row.kind), `${label}.kind invalid`, failures);
  assert(typeof row.file === 'string' && row.file.startsWith('market/candidates/') && row.file.endsWith('.json'), `${label}.file invalid`, failures);
  assert(typeof row.snapshotId === 'string' && row.snapshotId.trim().length > 0, `${label}.snapshotId missing`, failures);
  assert(row.sourceType === 'real-snapshot-v1', `${label}.sourceType must be real-snapshot-v1`, failures);
  assert(typeof row.provider === 'string' && row.provider.trim().length > 0, `${label}.provider missing`, failures);
  assert(typeof row.league === 'string' && row.league.trim().length > 0, `${label}.league missing`, failures);
  assert(isIsoDateString(row.fetchedAt), `${label}.fetchedAt missing valid timestamp`, failures);
  assert(Number.isInteger(row.entries) && row.entries > 0, `${label}.entries invalid`, failures);
  assert(Number.isInteger(row.evidenceEntries) && row.evidenceEntries >= 0 && row.evidenceEntries <= row.entries, `${label}.evidenceEntries invalid`, failures);
  assert(isFiniteNumber(row.avgConfidence) && row.avgConfidence >= 0 && row.avgConfidence <= 100, `${label}.avgConfidence invalid`, failures);
  assert(Number.isInteger(row.minBuyDepth) && row.minBuyDepth >= 0, `${label}.minBuyDepth invalid`, failures);
  assert(Number.isInteger(row.minSellDepth) && row.minSellDepth >= 0, `${label}.minSellDepth invalid`, failures);
  assert(['ok', 'failed', 'unknown'].includes(row.validationStatus), `${label}.validationStatus invalid`, failures);
}

async function validateCandidateIndex(seasonRoot) {
  const file = 'market/candidates/index.json';
  const failures = [];
  let index;
  try {
    index = await readJson(path.join(seasonRoot, file));
  } catch (error) {
    return {
      file,
      status: 'failed',
      schemaVersion: null,
      updatedAt: null,
      candidates: 0,
      ready: 0,
      gemFlips: 0,
      hideoutFlips: 0,
      failures: [`Cannot read candidate index JSON: ${error.message}`]
    };
  }
  validateCandidateIndexShape(index, file, failures);
  const rows = Array.isArray(index?.candidates) ? index.candidates : [];
  const seen = new Set();
  const rowResults = [];
  for (const [indexNumber, row] of rows.entries()) {
    const rowFailures = [];
    const label = `${file}.candidates[${indexNumber}]`;
    validateCandidateIndexRow(row, label, rowFailures);
    const rowKey = `${row.kind}:${row.key}`;
    if (seen.has(rowKey)) rowFailures.push(`${label} duplicate candidate ${rowKey}`);
    seen.add(rowKey);
    if (row.file && ['gemFlips', 'hideoutFlips'].includes(row.kind)) {
      const snapshot = await validateMarketFile(seasonRoot, row.kind, row.file);
      if (snapshot.status !== 'ok') rowFailures.push(`${label} candidate file validation failed`);
      if (snapshot.status === 'ok') {
        if (snapshot.entries !== row.entries) rowFailures.push(`${label}.entries does not match candidate file`);
        if (snapshot.evidenceEntries !== row.evidenceEntries) rowFailures.push(`${label}.evidenceEntries does not match candidate file`);
        if (snapshot.avgEvidenceConfidence !== row.avgConfidence) rowFailures.push(`${label}.avgConfidence does not match candidate file`);
        if (snapshot.minEvidenceBuyDepth !== row.minBuyDepth) rowFailures.push(`${label}.minBuyDepth does not match candidate file`);
        if (snapshot.minEvidenceSellDepth !== row.minSellDepth) rowFailures.push(`${label}.minSellDepth does not match candidate file`);
      }
      rowResults.push({ key: row.key, kind: row.kind, file: row.file, status: rowFailures.length ? 'failed' : 'ok', failures: rowFailures });
    }
    failures.push(...rowFailures);
  }
  return {
    file,
    status: failures.length ? 'failed' : 'ok',
    schemaVersion: index?.schemaVersion || null,
    updatedAt: index?.updatedAt || null,
    candidates: rows.length,
    ready: rows.filter((row) => row.validationStatus === 'ok').length,
    gemFlips: rows.filter((row) => row.kind === 'gemFlips').length,
    hideoutFlips: rows.filter((row) => row.kind === 'hideoutFlips').length,
    rowResults,
    failures
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);

  if (args.file || args.kind) {
    if (!args.file || !args.kind) throw new Error('--file and --kind must be used together');
    if (!['gemFlips', 'hideoutFlips'].includes(args.kind)) throw new Error('--kind must be gemFlips or hideoutFlips');
    const result = await validateMarketFile(seasonRoot, args.kind, args.file);
    console.log(JSON.stringify({
      season: args.season,
      mode: 'single-file',
      failed: result.status === 'failed' ? 1 : 0,
      result
    }, null, 2));
    if (result.status === 'failed') process.exit(1);
    return;
  }

  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const market = manifest.market || {};
  const results = [];
  for (const kind of ['gemFlips', 'hideoutFlips']) {
    results.push(await validateMarketFile(seasonRoot, kind, market[kind]));
  }
  const candidateIndex = await validateCandidateIndex(seasonRoot);

  const failed = results.filter((result) => result.status === 'failed');
  if (candidateIndex.status === 'failed') failed.push(candidateIndex);
  console.log(JSON.stringify({
    season: args.season,
    marketCount: results.length,
    failed: failed.length,
    results,
    candidateIndex
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
