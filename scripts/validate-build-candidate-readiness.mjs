#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholderTerms = [
  '待填写',
  '待填寫',
  'TBD',
  'Template placeholder',
  'Replace placeholders',
  'template',
  '模板占位',
  '說明',
  '说明'
];

function parseArgs(argv) {
  const args = { season: 's05', build: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-build-candidate-readiness.mjs [--season s05]',
    '  node scripts/validate-build-candidate-readiness.mjs --season s05 --build infernalist-minions',
    '',
    'Audits future-BD candidates before publication. It does not register builds or routes.',
    'The script exits nonzero only for broken files or failed validators; publishReady can be false while the audit itself is ok.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function exists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveInside(root, file) {
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep)) {
    throw new Error(`File must stay inside ${root}: ${file}`);
  }
  return absolute;
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
    child.on('close', (code) => {
      let json = null;
      try {
        json = stdout.trim() ? JSON.parse(stdout) : null;
      } catch (error) {
        json = { parseFailure: error.message };
      }
      resolve({ script, code, stdout: stdout.trim(), stderr: stderr.trim(), json });
    });
  });
}

function collectStrings(value, pathLabel = '', rows = []) {
  if (typeof value === 'string') {
    rows.push({ path: pathLabel, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${pathLabel}[${index}]`, rows));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, pathLabel ? `${pathLabel}.${key}` : key, rows);
    }
  }
  return rows;
}

function placeholderHits(value) {
  return collectStrings(value)
    .filter((row) => placeholderTerms.some((term) => row.value.includes(term)))
    .map((row) => row.path);
}

function stageIds(build) {
  return (build.stages || []).map((stage) => stage.treeStage || stage.id).filter(Boolean);
}

async function guideFileInfo(seasonRoot, candidate) {
  const guideAbsolute = resolveInside(repoRoot, path.relative(repoRoot, path.resolve(seasonRoot, candidate.guide || '')));
  const guideExists = await exists(guideAbsolute);
  const guideText = guideExists ? await readFile(guideAbsolute, 'utf8') : '';
  return {
    file: path.relative(repoRoot, guideAbsolute),
    exists: guideExists,
    hasDraftReadyDataset: guideText.includes('infernalistDraftReady') || guideText.includes('DraftReady'),
    hasPassiveRouteButtonHook: guideText.includes('data-stage-passive-candidate') || guideText.includes('passive-tree.html?route=')
  };
}

async function auditCandidate(season, seasonRoot, manifest, queueFile, candidate) {
  const registeredBuildIds = new Set((manifest.builds || []).map((entry) => entry.id));
  const formalRoutes = new Set((manifest.tree?.routes || []).map((route) => `${route.buildId}:${route.stageId}`));
  const failures = [];
  const publishBlockedBy = [];
  const reviewWarnings = [];

  const buildFile = resolveInside(seasonRoot, candidate.data || '');
  const buildExists = await exists(buildFile);
  const build = buildExists ? await readJson(buildFile) : {};
  const placeholders = buildExists ? placeholderHits(build) : [];
  const guide = await guideFileInfo(seasonRoot, candidate);
  const stages = stageIds(build);
  const routeCandidates = candidate.routeCandidates || [];
  const routeByStage = new Map(routeCandidates.map((route) => [route.stageId, route]));
  const missingRouteStages = stages.filter((stageId) => !routeByStage.has(stageId));
  const extraRouteStages = routeCandidates.map((route) => route.stageId).filter((stageId) => !stages.includes(stageId));

  if (!buildExists) failures.push(`candidate build data missing: ${candidate.data}`);
  if (!guide.exists) failures.push(`candidate guide page missing: ${candidate.guide}`);
  if (placeholders.length) publishBlockedBy.push(`placeholder paths remain: ${placeholders.length}`);
  if (!guide.hasPassiveRouteButtonHook) publishBlockedBy.push('guide does not expose staged passive candidate buttons');
  if (missingRouteStages.length) publishBlockedBy.push(`missing route candidate stages: ${missingRouteStages.join(',')}`);
  if (extraRouteStages.length) reviewWarnings.push(`route candidate stages not in build.stages: ${extraRouteStages.join(',')}`);

  const routeFiles = [];
  for (const route of routeCandidates) {
    const routeFile = resolveInside(seasonRoot, route.file || '');
    const fileExists = await exists(routeFile);
    routeFiles.push({
      stageId: route.stageId,
      file: route.file,
      exists: fileExists,
      status: route.status || ''
    });
    if (!fileExists) publishBlockedBy.push(`route candidate file missing: ${route.file}`);
    if (route.status !== 'hand-tuned-candidate') {
      reviewWarnings.push(`${route.stageId} status is ${route.status || 'missing'}, expected hand-tuned-candidate before registration review`);
    }
    if (!formalRoutes.has(`${candidate.id}:${route.stageId}`)) {
      publishBlockedBy.push(`formal manifest route not registered: ${candidate.id}:${route.stageId}`);
    }
  }

  if (!registeredBuildIds.has(candidate.id)) publishBlockedBy.push(`build not registered in manifest.builds: ${candidate.id}`);

  const buildValidator = buildExists
    ? await runNodeScript('scripts/validate-builds.mjs', ['--season', season, '--id', candidate.id, '--file', candidate.data])
    : { code: 1, json: null, stderr: 'build file missing' };
  const routeValidator = await runNodeScript('scripts/validate-build-candidate-routes.mjs', ['--season', season, '--build', candidate.id]);

  if (buildValidator.code !== 0) failures.push(`validate-builds failed for ${candidate.id}`);
  if (routeValidator.code !== 0) failures.push(`validate-build-candidate-routes failed for ${candidate.id}`);

  const materialReady = Boolean(buildExists)
    && guide.exists
    && placeholders.length === 0
    && stages.length > 0
    && missingRouteStages.length === 0
    && routeFiles.every((route) => route.exists)
    && buildValidator.code === 0
    && routeValidator.code === 0;

  const manifestPublished = registeredBuildIds.has(candidate.id)
    && routeCandidates.every((route) => formalRoutes.has(`${candidate.id}:${route.stageId}`));

  return {
    id: candidate.id,
    candidateStatus: candidate.status || '',
    queueFile,
    buildFile: candidate.data || '',
    guideFile: guide.file,
    registeredBuild: registeredBuildIds.has(candidate.id),
    manifestRouteCount: routeCandidates.filter((route) => formalRoutes.has(`${candidate.id}:${route.stageId}`)).length,
    stageCount: stages.length,
    routeCandidateCount: routeCandidates.length,
    routeCandidateFileCount: routeFiles.filter((route) => route.exists).length,
    placeholderCount: placeholders.length,
    guideExists: guide.exists,
    guideHasPassiveRouteButtons: guide.hasPassiveRouteButtonHook,
    buildValidatorStatus: buildValidator.code === 0 ? 'ok' : 'failed',
    routeValidatorStatus: routeValidator.code === 0 ? 'ok' : 'failed',
    materialReady,
    reviewReady: materialReady && routeFiles.every((route) => route.status === 'hand-tuned-candidate'),
    manifestPublished,
    publishReady: materialReady && manifestPublished,
    missingRouteStages,
    extraRouteStages,
    routeFiles,
    publishBlockedBy: [...new Set(publishBlockedBy)],
    reviewWarnings: [...new Set(reviewWarnings)],
    failures
  };
}

async function audit(args) {
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const queueFile = manifest.buildCandidates || 'builds/candidates.json';
  const queue = await readJson(resolveInside(seasonRoot, queueFile));
  const queueValidator = await runNodeScript('scripts/validate-build-candidates.mjs', ['--season', args.season]);
  const candidates = (queue.candidates || [])
    .filter((candidate) => !args.build || candidate.id === args.build);
  const missingBuildFilter = args.build && candidates.length === 0;
  const rows = [];
  for (const candidate of candidates) {
    rows.push(await auditCandidate(args.season, seasonRoot, manifest, queueFile, candidate));
  }
  const failures = [
    ...(queueValidator.code !== 0 ? ['validate-build-candidates failed'] : []),
    ...(missingBuildFilter ? [`build candidate not found: ${args.build}`] : []),
    ...rows.flatMap((row) => row.failures.map((failure) => `${row.id}: ${failure}`))
  ];
  return {
    season: args.season,
    file: path.relative(repoRoot, resolveInside(seasonRoot, queueFile)),
    buildFilter: args.build || '',
    status: failures.length ? 'failed' : 'ok',
    candidateCount: candidates.length,
    materialReadyCount: rows.filter((row) => row.materialReady).length,
    reviewReadyCount: rows.filter((row) => row.reviewReady).length,
    publishReadyCount: rows.filter((row) => row.publishReady).length,
    manifestPublishedCount: rows.filter((row) => row.manifestPublished).length,
    candidates: rows,
    failures
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await audit(args);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ok') process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
