#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeFiles = [
  ['en', 'en'],
  ['zh-CN', 'zhCN'],
  ['zh-TW', 'zhTW']
];

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-route-candidate.mjs --season s05 --build infernalist-minions --stage campaign-early --file /tmp/infernalist-campaign-early-route.json',
    '',
    'Validates a hand-tuned passive route candidate before it is registered in manifest.json.',
    'This does not require a manifest tree.routes entry and does not write files.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { season: 's05', build: '', stage: '', file: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--stage') args.stage = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function resolveSeasonFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function sameOrderedIds(nodes, nodeIds) {
  return Array.isArray(nodes)
    && nodes.length === nodeIds.length
    && nodes.every((node, index) => node.id === nodeIds[index] && node.order === index + 1);
}

function collectCandidateStages(candidateBuild) {
  return (candidateBuild?.stages || []).map((stage) => stage.treeStage || stage.id).filter(Boolean);
}

async function readBuildCandidate(currentRoot, manifest, buildId) {
  const registeredEntry = (manifest.builds || []).find((entry) => entry.id === buildId);
  if (registeredEntry) {
    return {
      status: 'registered-build',
      data: await readJson(resolveSeasonFile(currentRoot, registeredEntry.data))
    };
  }
  const candidateFile = manifest.buildCandidates || 'builds/candidates.json';
  const queue = await readJson(resolveSeasonFile(currentRoot, candidateFile));
  const candidate = (queue.candidates || []).find((entry) => entry.id === buildId);
  if (!candidate) return { status: 'not-found', data: null };
  return {
    status: `candidate-${candidate.status || 'planned'}`,
    data: await readJson(resolveSeasonFile(currentRoot, candidate.data || `builds/${candidate.id}.json`))
  };
}

async function rawNodeIdsForManifest(seasonRoot, manifest) {
  const rawFiles = manifest.tree?.raw || {};
  const result = {};
  for (const [locale, manifestKey] of localeFiles) {
    const rawFile = rawFiles[manifestKey];
    if (!rawFile) {
      result[locale] = { missingFile: true, ids: new Set() };
      continue;
    }
    const raw = await readJson(resolveSeasonFile(seasonRoot, rawFile));
    result[locale] = { missingFile: false, ids: new Set(Object.keys(raw.nodes || {}).map((id) => Number(id))) };
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.build) throw new Error('--build is required');
  if (!args.stage) throw new Error('--stage is required');
  if (!args.file) throw new Error('--file is required');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const candidatePath = resolveSeasonFile(seasonRoot, args.file);
  const candidate = await readJson(candidatePath);
  const buildInfo = await readBuildCandidate(seasonRoot, manifest, args.build);
  const buildStageIds = collectCandidateStages(buildInfo.data);
  const rawIds = await rawNodeIdsForManifest(seasonRoot, manifest);
  const failures = [];
  const warnings = [];
  const nodeIds = candidate.nodeIds || [];

  assert(Array.isArray(nodeIds) && nodeIds.length > 0, 'candidate.nodeIds missing or empty', failures);
  assert(nodeIds.every((id) => Number.isInteger(id) && id > 0), 'candidate.nodeIds must be positive integer ids', failures);
  assert(new Set(nodeIds).size === nodeIds.length, 'candidate.nodeIds contains duplicate ids', failures);
  assert(candidate.meta && typeof candidate.meta === 'object', 'candidate.meta missing', failures);
  assert(candidate.meta?.buildId === args.build, `candidate.meta.buildId must be ${args.build}`, failures);
  assert(candidate.meta?.stageId === args.stage, `candidate.meta.stageId must be ${args.stage}`, failures);
  assert(candidate.meta?.origin === 'hand-tuned-manual', 'candidate.meta.origin must be hand-tuned-manual', failures);
  assert(candidate.meta?.overridePolicy === 'manual-review-required', 'candidate.meta.overridePolicy must be manual-review-required', failures);
  assert(candidate.meta?.handTuned === true, 'candidate.meta.handTuned must be true', failures);
  assert(candidate.meta?.nodeCount === undefined || candidate.meta.nodeCount === nodeIds.length, 'candidate.meta.nodeCount mismatch', failures);
  assert(candidate.meta?.nodes === undefined || candidate.meta.nodes === nodeIds.length, 'candidate.meta.nodes mismatch', failures);
  assert(buildInfo.status !== 'not-found', `build ${args.build} is neither registered nor listed as a candidate`, failures);
  if (buildInfo.status !== 'not-found' && !buildStageIds.includes(args.stage)) {
    failures.push(`stage ${args.stage} not found in ${args.build} build/candidate data`);
  }

  for (const [locale] of localeFiles) {
    const nodes = candidate.locales?.[locale];
    assert(Array.isArray(nodes), `candidate.locales.${locale} missing`, failures);
    if (Array.isArray(nodes)) {
      assert(sameOrderedIds(nodes, nodeIds), `candidate.locales.${locale} ids/order mismatch`, failures);
      const emptyNames = nodes.filter((node) => !String(node.name || '').trim()).map((node) => node.id);
      if (emptyNames.length) failures.push(`candidate.locales.${locale} has empty node names: ${emptyNames.join(',')}`);
      const badStats = nodes.filter((node) => !Array.isArray(node.stats)).map((node) => node.id);
      if (badStats.length) failures.push(`candidate.locales.${locale} has non-array stats: ${badStats.join(',')}`);
    }
    const raw = rawIds[locale];
    if (raw?.missingFile) {
      failures.push(`manifest.tree.raw missing for ${locale}`);
    } else if (raw) {
      const missing = nodeIds.filter((id) => !raw.ids.has(id));
      if (missing.length) failures.push(`candidate node ids missing in ${locale} raw tree: ${missing.join(',')}`);
    }
  }

  if (!candidate.meta?.review?.manualChecks?.length) {
    warnings.push('candidate.meta.review.manualChecks is missing; add manual review notes before publishing');
  }

  const result = {
    season: args.season,
    buildId: args.build,
    stageId: args.stage,
    file: path.relative(repoRoot, candidatePath),
    buildStatus: buildInfo.status,
    nodeCount: Array.isArray(nodeIds) ? nodeIds.length : 0,
    localeCount: Object.keys(candidate.locales || {}).length,
    failed: failures.length,
    warningCount: warnings.length,
    failures,
    warnings
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
