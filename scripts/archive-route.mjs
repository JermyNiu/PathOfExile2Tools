#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeKeys = ['en', 'zh-CN', 'zh-TW'];

function usage() {
  return [
    'Usage:',
    '  node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/hand-tuned-route.json',
    '  node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/hand-tuned-route.json --write',
    '',
    'Archives a hand-tuned passive route candidate into the versioned tree route slot.',
    'Default mode is dry-run. Use --write to replace the route file and update manifest/build stage metadata.',
    'The candidate must use meta.origin=hand-tuned-manual, meta.overridePolicy=manual-review-required, and meta.handTuned=true.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    build: null,
    stage: null,
    file: null,
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--stage') args.stage = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
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

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
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

function requireArg(value, label) {
  if (!value || !String(value).trim()) throw new Error(`${label} is required`);
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

function validateHandTunedCandidate(candidate, args) {
  const failures = [];
  const nodeIds = candidate?.nodeIds || [];
  assert(Array.isArray(nodeIds) && nodeIds.length > 0, 'candidate.nodeIds missing or empty', failures);
  assert(new Set(nodeIds).size === nodeIds.length, 'candidate.nodeIds contains duplicate ids', failures);
  assert(candidate?.meta && typeof candidate.meta === 'object', 'candidate.meta missing', failures);
  assert(candidate.meta?.buildId === args.build, `candidate.meta.buildId must be ${args.build}`, failures);
  assert(candidate.meta?.stageId === args.stage, `candidate.meta.stageId must be ${args.stage}`, failures);
  assert(candidate.meta?.origin === 'hand-tuned-manual', 'candidate.meta.origin must be hand-tuned-manual', failures);
  assert(candidate.meta?.overridePolicy === 'manual-review-required', 'candidate.meta.overridePolicy must be manual-review-required', failures);
  assert(candidate.meta?.handTuned === true, 'candidate.meta.handTuned must be true', failures);
  assert(candidate.meta?.nodeCount === undefined || candidate.meta.nodeCount === nodeIds.length, 'candidate.meta.nodeCount mismatch', failures);
  assert(candidate.meta?.nodes === undefined || candidate.meta.nodes === nodeIds.length, 'candidate.meta.nodes mismatch', failures);
  for (const locale of localeKeys) {
    const nodes = candidate?.locales?.[locale];
    assert(Array.isArray(nodes), `candidate.locales.${locale} missing`, failures);
    if (Array.isArray(nodes)) {
      assert(sameOrderedIds(nodes, nodeIds), `candidate.locales.${locale} ids/order mismatch`, failures);
    }
  }
  return failures;
}

function buildRouteReview(candidate, previousReview) {
  const review = candidate.meta?.review || {};
  return {
    status: review.status || '已手调',
    reason: review.reason || '已通过 archive-route.mjs 写入手调路线，当前阶段不再使用终局顺序投影。',
    useUntil: review.useUntil || '作为当前版本阶段路线使用；新赛季或天赋版本变更后重新复核。',
    manualChecks: Array.isArray(review.manualChecks) && review.manualChecks.length
      ? review.manualChecks
      : previousReview?.manualChecks || [
        '确认节点顺序符合实际开荒阶段。',
        '确认属性、精魂、生存和输出节点没有过早绕路。',
        '确认攻略按钮打开后高亮节点数和阶段说明一致。'
      ]
  };
}

function updateBuildStage(build, args, nextRoute, candidate) {
  const stage = (build.stages || []).find((item) => item.id === args.stage || item.treeStage === args.stage);
  if (!stage) return false;
  stage.treeStage = args.stage;
  stage.treeNodes = nextRoute.nodes;
  stage.routeSource = nextRoute.origin;
  stage.routeOrigin = nextRoute.origin;
  stage.overridePolicy = nextRoute.overridePolicy;
  stage.handTuned = nextRoute.handTuned;
  stage.routeReview = buildRouteReview(candidate, stage.routeReview);
  return true;
}

function parseJsonOutput(output, fallback) {
  if (!output) return fallback;
  try {
    return JSON.parse(output);
  } catch {
    return fallback;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  requireArg(args.build, '--build');
  requireArg(args.stage, '--stage');
  requireArg(args.file, '--file');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifestFile = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestFile);
  const routeIndex = (manifest.tree?.routes || []).findIndex((route) => route.buildId === args.build && route.stageId === args.stage);
  if (routeIndex < 0) throw new Error(`No manifest route found for ${args.build}:${args.stage}`);

  const previousRoute = manifest.tree.routes[routeIndex];
  const candidateFile = resolveSeasonFile(seasonRoot, args.file);
  const candidate = await readJson(candidateFile);
  const failures = validateHandTunedCandidate(candidate, args);
  if (previousRoute.handTuned && !args.force) failures.push('target route is already hand-tuned; pass --force to replace it');

  const buildEntry = (manifest.builds || []).find((entry) => entry.id === args.build);
  if (!buildEntry) failures.push(`No manifest build found for ${args.build}`);
  const buildFile = buildEntry ? resolveSeasonFile(seasonRoot, buildEntry.data) : null;
  const build = buildFile ? await readJson(buildFile) : null;
  const buildStageFound = build ? (build.stages || []).some((item) => item.id === args.stage || item.treeStage === args.stage) : false;
  if (!buildStageFound) failures.push(`No build stage found for ${args.build}:${args.stage}`);

  const targetPath = resolveSeasonFile(seasonRoot, previousRoute.data);
  const nextRoute = {
    ...previousRoute,
    nodes: candidate.nodeIds?.length || 0,
    status: 'ready',
    source: candidate.meta.origin,
    origin: candidate.meta.origin,
    overridePolicy: candidate.meta.overridePolicy,
    handTuned: candidate.meta.handTuned
  };

  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    buildId: args.build,
    stageId: args.stage,
    candidateFile: path.relative(repoRoot, candidateFile),
    targetFile: path.relative(repoRoot, targetPath),
    buildFile: buildFile ? path.relative(repoRoot, buildFile) : null,
    previousRoute,
    nextRoute,
    candidateNodes: candidate.nodeIds?.length || 0,
    failed: failures.length,
    failures
  };

  if (failures.length) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(1);
  }

  if (!args.write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (!existsSync(targetPath)) throw new Error(`target route file does not exist: ${path.relative(repoRoot, targetPath)}`);
  candidate.meta = {
    ...candidate.meta,
    nodes: candidate.nodeIds.length,
    nodeCount: candidate.nodeIds.length,
    archivedAt: new Date().toISOString()
  };
  manifest.tree.routes[routeIndex] = nextRoute;
  updateBuildStage(build, args, nextRoute, candidate);

  await writeJson(targetPath, candidate);
  await writeJson(manifestFile, manifest);
  await writeJson(buildFile, build);

  const routeValidation = await runNodeScript('scripts/validate-routes.mjs', ['--season', args.season]);
  const buildValidation = await runNodeScript('scripts/validate-builds.mjs', ['--season', args.season]);
  const validation = {
    routes: parseJsonOutput(routeValidation.stdout, { status: routeValidation.code === 0 ? 'ok' : 'failed', stderr: routeValidation.stderr }),
    builds: parseJsonOutput(buildValidation.stdout, { status: buildValidation.code === 0 ? 'ok' : 'failed', stderr: buildValidation.stderr })
  };
  const failed = routeValidation.code !== 0 || buildValidation.code !== 0;
  console.log(JSON.stringify({ ...plan, status: 'written', validation }, null, 2));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
