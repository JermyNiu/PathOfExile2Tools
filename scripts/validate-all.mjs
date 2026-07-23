#!/usr/bin/env node

import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { season: 's05' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-all.mjs [--season s05]',
    '',
    'Runs JSON parsing, manifest file checks, version validation, build candidate validation, build candidate route validation, candidate readiness audit, build validation, build guide-writing validation, build scaffold dry-run, route validation, route scaffold dry-run, route candidate validation, route archive dry-run, skill catalog validation, market validation, market candidate dry-run, and ninja import validation.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function fileExists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
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
    child.on('close', (code) => {
      resolve({ script, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function validateJsonFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      await readJson(path.join(repoRoot, file));
      results.push({ file, status: 'ok' });
    } catch (error) {
      results.push({ file, status: 'failed', failure: error.message });
    }
  }
  return results;
}

async function validateManifestFiles(seasonRoot, manifest) {
  const checks = [];
  for (const build of manifest.builds || []) {
    checks.push({ label: `build:${build.id}`, file: build.data });
  }
  checks.push({ label: 'build:candidates', file: manifest.buildCandidates || 'builds/candidates.json' });
  for (const route of manifest.tree?.routes || []) {
    checks.push({ label: `tree:${route.buildId}:${route.stageId}`, file: route.data });
  }
  for (const [key, file] of Object.entries(manifest.market || {})) {
    if (file) checks.push({ label: `market:${key}`, file });
  }
  checks.push({ label: 'market:candidates:index', file: 'market/candidates/index.json' });
  for (const [key, file] of Object.entries(manifest.skills || {})) {
    if (file && key !== 'schema') checks.push({ label: `skills:${key}`, file });
  }
  for (const [key, file] of Object.entries(manifest.ninja || {})) {
    if (file) checks.push({ label: `ninja:${key}`, file });
  }
  for (const [key, file] of Object.entries(manifest.tree?.raw || {})) {
    if (key !== 'version' && file) checks.push({ label: `tree-raw:${key}`, file });
  }

  const results = [];
  for (const check of checks) {
    const absolute = path.join(seasonRoot, check.file);
    results.push({
      ...check,
      status: await fileExists(absolute) ? 'ok' : 'failed'
    });
  }
  return results;
}

async function createRegisterSmokeBuild(seasonRoot, manifest, smokeId) {
  const sourceEntry = (manifest.builds || [])[0];
  if (!sourceEntry) throw new Error('Cannot create register smoke build without a source build');
  const sourceBuild = await readJson(path.join(seasonRoot, sourceEntry.data));
  const build = structuredClone(sourceBuild);
  build.id = smokeId;
  build.title = {
    zhCN: '注册校验用开荒草稿',
    zhTW: '註冊校驗用拓荒草稿',
    en: 'Register Smoke Build'
  };
  build.source = {
    ...(build.source || {}),
    notes: 'Temporary validate-all register-build smoke candidate.'
  };
  build.tags = [...new Set(['validate-all-smoke', ...(build.tags || [])])];
  build.routes = {};
  build.stages = (build.stages || []).map((stage) => {
    const nextStage = { ...stage };
    delete nextStage.treeStage;
    delete nextStage.treeData;
    delete nextStage.treeNodes;
    delete nextStage.routeSource;
    delete nextStage.routeOrigin;
    delete nextStage.overridePolicy;
    delete nextStage.handTuned;
    delete nextStage.routeReview;
    return nextStage;
  });

  const relative = path.join('builds', `${smokeId}.json`);
  const absolute = path.join(seasonRoot, relative);
  await writeFile(absolute, `${JSON.stringify(build, null, 2)}\n`);
  return { relative, absolute };
}

async function createRouteArchiveSmokeCandidate(seasonRoot, manifest) {
  const sourceRoute = (manifest.tree?.routes || []).find((route) => !route.handTuned) || (manifest.tree?.routes || [])[0];
  if (!sourceRoute) throw new Error('Cannot create route archive smoke candidate without a source route');
  const sourceFile = path.join(seasonRoot, sourceRoute.data);
  const route = await readJson(sourceFile);
  const candidate = structuredClone(route);
  candidate.meta = {
    ...(candidate.meta || {}),
    origin: 'hand-tuned-manual',
    source: 'validate-all route archive smoke candidate',
    overridePolicy: 'manual-review-required',
    handTuned: true,
    projection: undefined,
    review: {
      status: '已手调',
      reason: 'validate-all dry-run smoke candidate.',
      useUntil: 'dry-run only',
      manualChecks: [
        'validate-all smoke candidate should never be written.'
      ]
    }
  };
  delete candidate.meta.projection;
  await mkdir(path.join(repoRoot, '.tmp'), { recursive: true });
  const absolute = path.join(repoRoot, '.tmp', 'validate-all-route-archive-smoke.json');
  await writeFile(absolute, `${JSON.stringify(candidate, null, 2)}\n`);
  return { absolute, route: sourceRoute };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifestFile = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestFile);

  const jsonFiles = [
    'data/versions.json',
    'data/templates/build-guide-template.json',
    path.relative(repoRoot, manifestFile),
    path.join('data', 'seasons', args.season, manifest.buildCandidates || 'builds/candidates.json'),
    path.join('data', 'seasons', args.season, 'tree/infernalist-minions-campaign-early.candidate.json'),
    ...(manifest.builds || []).map((build) => path.join('data', 'seasons', args.season, build.data)),
    ...(manifest.tree?.routes || []).map((route) => path.join('data', 'seasons', args.season, route.data)),
    ...Object.entries(manifest.skills || {}).filter(([key, file]) => key !== 'schema' && Boolean(file)).map(([, file]) => path.join('data', 'seasons', args.season, file)),
    ...Object.values(manifest.market || {}).filter(Boolean).map((file) => path.join('data', 'seasons', args.season, file)),
    path.join('data', 'seasons', args.season, 'market/candidates/index.json'),
    ...Object.values(manifest.ninja || {}).filter(Boolean).map((file) => path.join('data', 'seasons', args.season, file))
  ];

  const jsonResults = await validateJsonFiles(jsonFiles);
  const manifestResults = await validateManifestFiles(seasonRoot, manifest);
  const versionResult = await runNodeScript('scripts/validate-versions.mjs', []);
  const buildCandidateResult = await runNodeScript('scripts/validate-build-candidates.mjs', ['--season', args.season]);
  const buildCandidateRouteResult = await runNodeScript('scripts/validate-build-candidate-routes.mjs', ['--season', args.season]);
  const buildCandidateReadinessResult = await runNodeScript('scripts/validate-build-candidate-readiness.mjs', ['--season', args.season]);
  const buildResult = await runNodeScript('scripts/validate-builds.mjs', ['--season', args.season]);
  const buildGuideResult = await runNodeScript('scripts/validate-build-guides.mjs', ['--season', args.season]);
  const buildScaffoldSmokeId = 'validate-all-scaffold-smoke';
  const buildScaffoldSmokeFile = path.join(seasonRoot, 'builds', `${buildScaffoldSmokeId}.json`);
  const buildScaffoldResult = await runNodeScript('scripts/scaffold-build.mjs', [
    '--season',
    args.season,
    '--id',
    buildScaffoldSmokeId,
    '--title-zh',
    '校验用开荒草稿',
    '--title-tw',
    '校驗用拓荒草稿',
    '--title-en',
    'Validation Scaffold Smoke'
  ]);
  const buildRegisterSmokeId = 'validate-all-register-smoke';
  const buildRegisterSmoke = await createRegisterSmokeBuild(seasonRoot, manifest, buildRegisterSmokeId);
  const buildRegisterResult = await runNodeScript('scripts/register-build.mjs', [
    '--season',
    args.season,
    '--id',
    buildRegisterSmokeId,
    '--data',
    buildRegisterSmoke.relative,
    '--guide',
    `../../../builds/${buildRegisterSmokeId}.html`
  ]);
  await unlink(buildRegisterSmoke.absolute).catch(() => {});
  const routeResult = await runNodeScript('scripts/validate-routes.mjs', ['--season', args.season]);
  await mkdir(path.join(repoRoot, '.tmp'), { recursive: true });
  const routeScaffoldSmokeFile = path.join(repoRoot, '.tmp', 'validate-all-route-scaffold-dry-run.json');
  const routeScaffoldResult = await runNodeScript('scripts/scaffold-route.mjs', [
    '--season',
    args.season,
    '--build',
    'infernalist-minions',
    '--stage',
    'campaign-early',
    '--nodes',
    '6077,27296',
    '--out',
    routeScaffoldSmokeFile
  ]);
  const routeCandidateSmokeFile = path.join(repoRoot, '.tmp', 'validate-all-route-candidate-smoke.json');
  const routeCandidateScaffoldResult = await runNodeScript('scripts/scaffold-route.mjs', [
    '--season',
    args.season,
    '--build',
    'infernalist-minions',
    '--stage',
    'campaign-early',
    '--nodes',
    '6077,27296',
    '--out',
    routeCandidateSmokeFile,
    '--write'
  ]);
  const routeCandidateResult = routeCandidateScaffoldResult.code === 0
    ? await runNodeScript('scripts/validate-route-candidate.mjs', [
      '--season',
      args.season,
      '--build',
      'infernalist-minions',
      '--stage',
      'campaign-early',
      '--file',
      routeCandidateSmokeFile
    ])
    : { script: 'scripts/validate-route-candidate.mjs', code: 1, stdout: '', stderr: 'route candidate scaffold failed' };
  await unlink(routeCandidateSmokeFile).catch(() => {});
  const routeArchiveSmoke = await createRouteArchiveSmokeCandidate(seasonRoot, manifest);
  const routeArchiveResult = await runNodeScript('scripts/archive-route.mjs', [
    '--season',
    args.season,
    '--build',
    routeArchiveSmoke.route.buildId,
    '--stage',
    routeArchiveSmoke.route.stageId,
    '--file',
    routeArchiveSmoke.absolute
  ]);
  await unlink(routeArchiveSmoke.absolute).catch(() => {});
  const skillResult = await runNodeScript('scripts/validate-skills.mjs', ['--season', args.season]);
  const marketResult = await runNodeScript('scripts/validate-market.mjs', ['--season', args.season]);
  const marketNormalizeSmokeKey = 'validate-all-market-smoke';
  const marketNormalizeSmokeFile = path.join(seasonRoot, 'market', 'candidates', `gemFlips-${marketNormalizeSmokeKey}.json`);
  const candidateIndexFile = path.join(seasonRoot, 'market', 'candidates', 'index.json');
  const candidateIndexBefore = await readFile(candidateIndexFile, 'utf8').catch(() => '');
  const marketNormalizeResult = await runNodeScript('scripts/normalize-market-snapshot.mjs', [
    '--season',
    args.season,
    '--kind',
    'gemFlips',
    '--file',
    'market/examples/real-gem-flips-v1.example.json',
    '--key',
    marketNormalizeSmokeKey,
    '--provider',
    'validate-all-smoke',
    '--league',
    'S05'
  ]);
  const candidateIndexAfter = await readFile(candidateIndexFile, 'utf8').catch(() => '');
  const marketArchiveFixtureGuardResult = await runNodeScript('scripts/archive-market-snapshot.mjs', [
    '--season',
    args.season,
    '--kind',
    'gemFlips',
    '--file',
    'market/examples/real-gem-flips-v1.example.json',
    '--key',
    'fixture-guard-smoke'
  ]);
  const ninjaResult = await runNodeScript('scripts/validate-ninja.mjs', ['--season', args.season, '--examples']);

  const failedJson = jsonResults.filter((result) => result.status !== 'ok');
  const failedManifest = manifestResults.filter((result) => result.status !== 'ok');
  const failedScripts = [versionResult, buildCandidateResult, buildCandidateRouteResult, buildCandidateReadinessResult, buildResult, buildGuideResult, buildScaffoldResult, buildRegisterResult, routeResult, routeScaffoldResult, routeCandidateScaffoldResult, routeCandidateResult, routeArchiveResult, skillResult, marketResult, marketNormalizeResult, ninjaResult].filter((result) => result.code !== 0);
  const scaffoldSmokeOk =
    buildScaffoldResult.code === 0 &&
    buildScaffoldResult.stdout.includes('"status": "dry-run"') &&
    buildScaffoldResult.stdout.includes('"manifestEntry"') &&
    !(await fileExists(buildScaffoldSmokeFile));
  const registerSmokeOk =
    buildRegisterResult.code === 0 &&
    buildRegisterResult.stdout.includes('"status": "dry-run"') &&
    buildRegisterResult.stdout.includes('"guide"') &&
    !(await fileExists(buildRegisterSmoke.absolute));
  const routeArchiveSmokeOk =
    routeArchiveResult.code === 0 &&
    routeArchiveResult.stdout.includes('"mode": "dry-run"') &&
    routeArchiveResult.stdout.includes('"origin": "hand-tuned-manual"') &&
    routeArchiveResult.stdout.includes('"targetFile"') &&
    !(await fileExists(routeArchiveSmoke.absolute));
  const routeScaffoldSmokeOk =
    routeScaffoldResult.code === 0 &&
    routeScaffoldResult.stdout.includes('"mode": "dry-run"') &&
    routeScaffoldResult.stdout.includes('"origin": "hand-tuned-manual"') &&
    routeScaffoldResult.stdout.includes('"locales"') &&
    routeScaffoldResult.stdout.includes('"zh-CN"') &&
    !(await fileExists(routeScaffoldSmokeFile));
  const routeCandidateSmokeOk =
    routeCandidateScaffoldResult.code === 0 &&
    routeCandidateResult.code === 0 &&
    routeCandidateResult.stdout.includes('"failed": 0') &&
    routeCandidateResult.stdout.includes('"buildStatus": "candidate-draft"') &&
    !(await fileExists(routeCandidateSmokeFile));
  const marketNormalizeSmokeOk =
    marketNormalizeResult.code === 0 &&
    marketNormalizeResult.stdout.includes('"mode": "dry-run"') &&
    marketNormalizeResult.stdout.includes('"sourceType": "real-snapshot-v1"') &&
    marketNormalizeResult.stdout.includes('"candidateIndexUpdated": false') &&
    !(await fileExists(marketNormalizeSmokeFile)) &&
    candidateIndexBefore === candidateIndexAfter;
  const archiveFixtureGuardOk =
    marketArchiveFixtureGuardResult.code !== 0 &&
    marketArchiveFixtureGuardResult.stdout.includes('fixture/example market snapshots cannot be archived');
  const failed = failedJson.length + failedManifest.length + failedScripts.length + (scaffoldSmokeOk ? 0 : 1) + (registerSmokeOk ? 0 : 1) + (routeScaffoldSmokeOk ? 0 : 1) + (routeCandidateSmokeOk ? 0 : 1) + (routeArchiveSmokeOk ? 0 : 1) + (marketNormalizeSmokeOk ? 0 : 1) + (archiveFixtureGuardOk ? 0 : 1);

  console.log(JSON.stringify({
    season: args.season,
    failed,
    json: {
      checked: jsonResults.length,
      failed: failedJson
    },
    manifestFiles: {
      checked: manifestResults.length,
      failed: failedManifest
    },
    scripts: [
      {
        script: versionResult.script,
        status: versionResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: buildCandidateResult.script,
        status: buildCandidateResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: buildCandidateRouteResult.script,
        status: buildCandidateRouteResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: buildCandidateReadinessResult.script,
        status: buildCandidateReadinessResult.code === 0 ? 'ok' : 'failed',
        expected: 'audit candidate material, review, and publication readiness without writing manifest'
      },
      {
        script: buildResult.script,
        status: buildResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: buildGuideResult.script,
        status: buildGuideResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: buildScaffoldResult.script,
        status: scaffoldSmokeOk ? 'ok' : 'failed',
        expected: 'dry-run scaffold without writing build file'
      },
      {
        script: buildRegisterResult.script,
        status: registerSmokeOk ? 'ok' : 'failed',
        expected: 'dry-run register validated build without writing manifest'
      },
      {
        script: routeResult.script,
        status: routeResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: routeScaffoldResult.script,
        status: routeScaffoldSmokeOk ? 'ok' : 'failed',
        expected: 'dry-run scaffold hand-tuned route candidate without writing route file'
      },
      {
        script: routeCandidateResult.script,
        status: routeCandidateSmokeOk ? 'ok' : 'failed',
        expected: 'validate generated unregistered route candidate and clean temporary file'
      },
      {
        script: routeArchiveResult.script,
        status: routeArchiveSmokeOk ? 'ok' : 'failed',
        expected: 'dry-run archive hand-tuned route without writing route files'
      },
      {
        script: skillResult.script,
        status: skillResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: marketResult.script,
        status: marketResult.code === 0 ? 'ok' : 'failed'
      },
      {
        script: marketNormalizeResult.script,
        status: marketNormalizeSmokeOk ? 'ok' : 'failed',
        expected: 'dry-run normalize market candidate without writing candidate file or index'
      },
      {
        script: marketArchiveFixtureGuardResult.script,
        status: archiveFixtureGuardOk ? 'ok' : 'failed',
        expected: 'reject fixture/example archive dry-run'
      },
      {
        script: ninjaResult.script,
        status: ninjaResult.code === 0 ? 'ok' : 'failed'
      }
    ]
  }, null, 2));

  if (failed) {
    for (const result of failedScripts) {
      if (result.stdout) console.error(result.stdout);
      if (result.stderr) console.error(result.stderr);
    }
    if (!archiveFixtureGuardOk) {
      if (marketArchiveFixtureGuardResult.stdout) console.error(marketArchiveFixtureGuardResult.stdout);
      if (marketArchiveFixtureGuardResult.stderr) console.error(marketArchiveFixtureGuardResult.stderr);
    }
    if (!marketNormalizeSmokeOk) {
      if (marketNormalizeResult.stdout) console.error(marketNormalizeResult.stdout);
      if (marketNormalizeResult.stderr) console.error(marketNormalizeResult.stderr);
      console.error(`normalize-market dry-run should not create ${path.relative(repoRoot, marketNormalizeSmokeFile)} or modify ${path.relative(repoRoot, candidateIndexFile)}`);
    }
    if (!scaffoldSmokeOk) {
      if (buildScaffoldResult.stdout) console.error(buildScaffoldResult.stdout);
      if (buildScaffoldResult.stderr) console.error(buildScaffoldResult.stderr);
      console.error(`scaffold dry-run should not create ${path.relative(repoRoot, buildScaffoldSmokeFile)}`);
    }
    if (!registerSmokeOk) {
      if (buildRegisterResult.stdout) console.error(buildRegisterResult.stdout);
      if (buildRegisterResult.stderr) console.error(buildRegisterResult.stderr);
      console.error(`register dry-run should not leave ${path.relative(repoRoot, buildRegisterSmoke.absolute)}`);
    }
    if (!routeArchiveSmokeOk) {
      if (routeArchiveResult.stdout) console.error(routeArchiveResult.stdout);
      if (routeArchiveResult.stderr) console.error(routeArchiveResult.stderr);
      console.error(`route archive dry-run should not leave ${path.relative(repoRoot, routeArchiveSmoke.absolute)} or write route data`);
    }
    if (!routeScaffoldSmokeOk) {
      if (routeScaffoldResult.stdout) console.error(routeScaffoldResult.stdout);
      if (routeScaffoldResult.stderr) console.error(routeScaffoldResult.stderr);
      console.error(`route scaffold dry-run should not create ${path.relative(repoRoot, routeScaffoldSmokeFile)}`);
    }
    if (!routeCandidateSmokeOk) {
      if (routeCandidateScaffoldResult.stdout) console.error(routeCandidateScaffoldResult.stdout);
      if (routeCandidateScaffoldResult.stderr) console.error(routeCandidateScaffoldResult.stderr);
      if (routeCandidateResult.stdout) console.error(routeCandidateResult.stdout);
      if (routeCandidateResult.stderr) console.error(routeCandidateResult.stderr);
      console.error(`route candidate validation should pass and clean ${path.relative(repoRoot, routeCandidateSmokeFile)}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
