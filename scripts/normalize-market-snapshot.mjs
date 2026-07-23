#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketKinds = ['gemFlips', 'hideoutFlips'];

function usage() {
  return [
    'Usage:',
    '  node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file /tmp/raw-gems.json --key 2026-07-22-gems --provider manual-capture --league S05',
    '  node scripts/normalize-market-snapshot.mjs --season s05 --kind hideoutFlips --file /tmp/raw-hideout.json --key 2026-07-22-hideout --provider trade-api --league S05 --write',
    '',
    'Normalizes raw market entries into a real-snapshot-v1 candidate and validates it.',
    'Input may be an array of entries, { entries }, or a partial snapshot. Default mode is dry-run.',
    'Use --write to save under data/seasons/<season>/market/candidates/.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    kind: null,
    file: null,
    key: null,
    provider: null,
    league: null,
    fetchedAt: null,
    observedAt: null,
    note: null,
    minListingDepth: null,
    abnormalPriceRules: [],
    write: false,
    out: null,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--kind') args.kind = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--key') args.key = argv[++i];
    else if (arg === '--provider') args.provider = argv[++i];
    else if (arg === '--league') args.league = argv[++i];
    else if (arg === '--fetched-at') args.fetchedAt = argv[++i];
    else if (arg === '--observed-at') args.observedAt = argv[++i];
    else if (arg === '--note') args.note = argv[++i];
    else if (arg === '--min-listing-depth') args.minListingDepth = Number(argv[++i]);
    else if (arg === '--abnormal-price-rule') args.abnormalPriceRules.push(argv[++i]);
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
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { flag: force ? 'w' : 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`target file already exists: ${path.relative(repoRoot, file)}; pass --force to overwrite`);
    throw error;
  }
}

function runNodeScript(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function requireArg(value, name) {
  if (!value || !String(value).trim()) throw new Error(`${name} is required`);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'market-snapshot';
}

function resolveInputFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function resolveOutputFile(seasonRoot, kind, key, out) {
  if (out) {
    if (path.isAbsolute(out)) return out;
    if (out.startsWith(`data${path.sep}`) || out.startsWith('data/')) return path.join(repoRoot, out);
    return path.join(seasonRoot, out);
  }
  return path.join(seasonRoot, 'market', 'candidates', `${kind}-${key}.json`);
}

function parseJsonOutput(output, fallback) {
  if (!output) return fallback;
  try {
    return JSON.parse(output);
  } catch {
    return fallback;
  }
}

function defaultWeights(kind, sourceWeights) {
  if (sourceWeights && typeof sourceWeights === 'object') return sourceWeights;
  if (kind === 'hideoutFlips') {
    return { netProfit: 0.45, profitPerGoldUnit: 0.3, liquidity: 0.2, risk: -0.25 };
  }
  return { netProfit: 0.5, roi: 0.25, liquidity: 0.2, risk: -0.2 };
}

function normalizeInput(raw) {
  if (Array.isArray(raw)) return { entries: raw };
  if (raw && typeof raw === 'object') return raw;
  throw new Error('input must be an array, an object with entries, or a partial snapshot');
}

function normalizeEvidence(entry, observedAt) {
  const evidence = entry.marketEvidence || {};
  return {
    observedAt: evidence.observedAt || observedAt,
    buyListingCount: evidence.buyListingCount,
    sellListingCount: evidence.sellListingCount,
    priceConfidence: evidence.priceConfidence,
    depthNote: evidence.depthNote
  };
}

function normalizeEntry(entry, observedAt) {
  return {
    ...entry,
    marketEvidence: normalizeEvidence(entry, observedAt)
  };
}

function marketEvidenceStats(entries) {
  const evidenceEntries = (entries || []).filter((entry) => entry.marketEvidence);
  if (!evidenceEntries.length) {
    return { evidenceEntries: 0, avgConfidence: 0, minBuyDepth: 0, minSellDepth: 0 };
  }
  const confidences = evidenceEntries.map((entry) => Number(entry.marketEvidence.priceConfidence)).filter(Number.isFinite);
  const buyDepths = evidenceEntries.map((entry) => Number(entry.marketEvidence.buyListingCount)).filter(Number.isFinite);
  const sellDepths = evidenceEntries.map((entry) => Number(entry.marketEvidence.sellListingCount)).filter(Number.isFinite);
  return {
    evidenceEntries: evidenceEntries.length,
    avgConfidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)) : 0,
    minBuyDepth: buyDepths.length ? Math.min(...buyDepths) : 0,
    minSellDepth: sellDepths.length ? Math.min(...sellDepths) : 0
  };
}

async function upsertCandidateIndex(seasonRoot, kind, key, outputFile, candidate, validation) {
  const indexFile = path.join(seasonRoot, 'market', 'candidates', 'index.json');
  let index = { schemaVersion: 1, candidates: [] };
  try {
    index = await readJson(indexFile);
  } catch (_) {
    index = { schemaVersion: 1, candidates: [] };
  }
  const stats = marketEvidenceStats(candidate.entries || []);
  const relativeFile = path.relative(seasonRoot, outputFile).split(path.sep).join(path.posix.sep);
  const row = {
    key,
    kind,
    file: relativeFile,
    snapshotId: candidate.id,
    sourceType: candidate.source?.type || '',
    provider: candidate.source?.provider || '',
    league: candidate.source?.league || '',
    fetchedAt: candidate.source?.fetchedAt || '',
    entries: candidate.entries?.length || 0,
    evidenceEntries: stats.evidenceEntries,
    avgConfidence: stats.avgConfidence,
    minBuyDepth: stats.minBuyDepth,
    minSellDepth: stats.minSellDepth,
    validationStatus: validation?.result?.status || validation?.status || 'unknown'
  };
  const candidates = Array.isArray(index.candidates) ? index.candidates : [];
  const existingIndex = candidates.findIndex((item) => item.kind === kind && item.key === key);
  if (existingIndex >= 0) candidates[existingIndex] = row;
  else candidates.push(row);
  candidates.sort((a, b) => String(a.kind).localeCompare(String(b.kind)) || String(a.key).localeCompare(String(b.key)));
  await writeJson(indexFile, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    candidates
  }, true);
  return row;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  requireArg(args.kind, '--kind');
  requireArg(args.file, '--file');
  requireArg(args.key, '--key');
  requireArg(args.provider, '--provider');
  requireArg(args.league, '--league');
  if (!marketKinds.includes(args.kind)) throw new Error('--kind must be gemFlips or hideoutFlips');
  if (args.minListingDepth !== null && (!Number.isInteger(args.minListingDepth) || args.minListingDepth <= 0)) {
    throw new Error('--min-listing-depth must be a positive integer');
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const key = slug(args.key);
  const inputFile = resolveInputFile(seasonRoot, args.file);
  const raw = normalizeInput(await readJson(inputFile));
  const now = new Date().toISOString();
  const fetchedAt = args.fetchedAt || raw.source?.fetchedAt || raw.updatedAt || now;
  const observedAt = args.observedAt || fetchedAt;
  const abnormalPriceRules = args.abnormalPriceRules.length
    ? args.abnormalPriceRules
    : raw.source?.filters?.abnormalPriceRules || [
      'Drop obvious outliers before choosing buy and sell prices.',
      'Require comparable buy and sell side listing depth.'
    ];

  const candidate = {
    snapshotSchemaVersion: 1,
    id: raw.id || `${args.season}-${args.kind}-${key}`,
    season: raw.season || manifest.label || manifest.id?.toUpperCase() || args.season.toUpperCase(),
    versionId: raw.versionId || manifest.versionId,
    updatedAt: raw.updatedAt || now,
    source: {
      type: 'real-snapshot-v1',
      provider: args.provider,
      league: args.league,
      fetchedAt,
      note: args.note || raw.source?.note || `Normalized ${args.kind} market snapshot candidate.`,
      filters: {
        minListingDepth: args.minListingDepth || raw.source?.filters?.minListingDepth || 5,
        abnormalPriceRules
      }
    },
    currency: raw.currency || 'exalted',
    ...(args.kind === 'hideoutFlips' ? { goldUnit: raw.goldUnit || 10000 } : {}),
    feeRate: raw.feeRate ?? 0.08,
    scoreWeights: defaultWeights(args.kind, raw.scoreWeights),
    entries: (raw.entries || []).map((entry) => normalizeEntry(entry, observedAt))
  };

  const outputFile = resolveOutputFile(seasonRoot, args.kind, key, args.out);
  if (args.write) {
    await writeJson(outputFile, candidate, args.force);
  }

  const validateFile = args.write
    ? path.relative(seasonRoot, outputFile).split(path.sep).join(path.posix.sep)
    : args.file;
  const validation = args.write
    ? await runNodeScript('scripts/validate-market.mjs', ['--season', args.season, '--kind', args.kind, '--file', validateFile])
    : await validateCandidateViaTemp(args.season, args.kind, candidate);

  const parsedValidation = parseJsonOutput(validation.stdout, {
    status: validation.code === 0 ? 'ok' : 'failed',
    stdout: validation.stdout,
    stderr: validation.stderr
  });
  let candidateIndex = null;
  if (args.write && validation.code === 0) {
    candidateIndex = await upsertCandidateIndex(seasonRoot, args.kind, key, outputFile, candidate, parsedValidation);
  }

  const result = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    kind: args.kind,
    key,
    inputFile: path.relative(repoRoot, inputFile),
    outputFile: path.relative(repoRoot, outputFile),
    sourceType: candidate.source.type,
    provider: candidate.source.provider,
    league: candidate.source.league,
    fetchedAt: candidate.source.fetchedAt,
    entries: candidate.entries.length,
    candidateIndexUpdated: Boolean(candidateIndex),
    candidateIndex,
    validation: parsedValidation
  };

  console.log(JSON.stringify(result, null, 2));
  if (validation.code !== 0) process.exit(1);
}

async function validateCandidateViaTemp(season, kind, candidate) {
  const tempFile = path.join(repoRoot, '.tmp', `market-candidate-${process.pid}-${Date.now()}.json`);
  await writeJson(tempFile, candidate, true);
  try {
    return await runNodeScript('scripts/validate-market.mjs', ['--season', season, '--kind', kind, '--file', tempFile]);
  } finally {
    await import('node:fs/promises').then((fs) => fs.rm(tempFile, { force: true }));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
