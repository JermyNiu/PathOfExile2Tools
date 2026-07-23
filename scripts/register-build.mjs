#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];

function parseArgs(argv) {
  const args = {
    season: 's05',
    id: null,
    data: null,
    guide: null,
    status: 'in-progress',
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--data') args.data = argv[++i];
    else if (arg === '--guide') args.guide = argv[++i];
    else if (arg === '--status') args.status = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/register-build.mjs --season s05 --id infernalist-minions --data builds/infernalist-minions.json --guide ../../../builds/infernalist-minions.html',
    '  node scripts/register-build.mjs --season s05 --id infernalist-minions --data builds/infernalist-minions.json --guide ../../../builds/infernalist-minions.html --write',
    '',
    'Dry-run by default. The candidate build must pass build schema validation and guide-writing completeness before it can be registered.',
    'Use --force only to replace an existing manifest entry deliberately.'
  ].join('\n');
}

function assertKebabId(id) {
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('--id must be lowercase kebab-case');
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function resolveSeasonFile(seasonRoot, file) {
  const absolute = path.resolve(seasonRoot, file);
  if (!absolute.startsWith(seasonRoot + path.sep)) {
    throw new Error(`File must stay inside ${seasonRoot}: ${file}`);
  }
  return absolute;
}

function localizedReady(value) {
  return Boolean(value)
    && typeof value === 'object'
    && locales.every((locale) => typeof value[locale] === 'string' && value[locale].trim().length > 0);
}

function localizedListCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Math.max(...locales.map((locale) => Array.isArray(value[locale]) ? value[locale].length : 0), 0);
}

function guideCompleteness(build) {
  const article = build.guideArticle;
  const articleSections = article?.sections || [];
  const skillCards = build.skills?.overview?.cards || [];
  const gearCards = build.gearOverview?.cards || [];
  const stages = build.stages || [];
  const executionStages = build.executionPlan?.stages || [];
  const articleReady = localizedReady(article?.title)
    && localizedReady(article?.intro)
    && articleSections.length > 0
    && articleSections.every((section) => (
      typeof section.id === 'string'
      && localizedReady(section.title)
      && localizedReady(section.body)
      && localizedListCount(section.checks) > 0
    ));
  const strategyReady = Boolean(build.guideStrategy?.coreLoop?.steps?.length)
    && Boolean(build.guideStrategy?.powerSignals?.length)
    && Boolean(build.guideStrategy?.failureDiagnosis?.length)
    && Boolean(build.guideStrategy?.decisionRules?.length);
  const stagePlaybooks = stages.filter((stage) => stage.playbook?.steps?.length).length;
  const missing = [
    articleReady ? '' : 'guideArticle',
    strategyReady ? '' : 'guideStrategy',
    executionStages.length ? '' : 'executionPlan.stages',
    stages.length ? '' : 'stages',
    stagePlaybooks === stages.length && stages.length ? '' : 'stages.playbook',
    skillCards.length ? '' : 'skills.overview',
    gearCards.length ? '' : 'gearOverview'
  ].filter(Boolean);
  return {
    complete: missing.length === 0,
    missing,
    articleSections: articleSections.length,
    articleChecks: articleSections.reduce((sum, section) => sum + localizedListCount(section.checks), 0),
    skillOverviewCards: skillCards.length,
    gearOverviewCards: gearCards.length,
    stagePlaybooks,
    executionStages: executionStages.length
  };
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
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function validateCandidate(args, seasonRoot, build) {
  const buildResult = await runNodeScript('scripts/validate-builds.mjs', [
    '--season',
    args.season,
    '--id',
    args.id,
    '--file',
    args.data
  ]);
  const guide = guideCompleteness(build);
  return {
    buildSchemaOk: buildResult.code === 0,
    buildSchemaOutput: buildResult.stdout,
    buildSchemaError: buildResult.stderr,
    guide
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  assertKebabId(args.id);
  if (!args.data) throw new Error('--data is required');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifestFile = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestFile);
  const dataFile = resolveSeasonFile(seasonRoot, args.data);
  const build = await readJson(dataFile);
  if (build.id !== args.id) throw new Error(`Build file id mismatch: expected ${args.id}, got ${build.id}`);

  const existingIndex = (manifest.builds || []).findIndex((entry) => entry.id === args.id);
  if (existingIndex >= 0 && !args.force) {
    throw new Error(`Build is already registered: ${args.id}. Use --force to replace it.`);
  }

  const validation = await validateCandidate(args, seasonRoot, build);
  if (!validation.buildSchemaOk || !validation.guide.complete) {
    console.log(JSON.stringify({
      status: 'failed',
      season: args.season,
      id: args.id,
      buildSchemaOk: validation.buildSchemaOk,
      guideComplete: validation.guide.complete,
      missing: validation.guide.missing,
      buildSchemaOutput: validation.buildSchemaOutput,
      buildSchemaError: validation.buildSchemaError
    }, null, 2));
    process.exit(1);
  }

  const entry = {
    id: args.id,
    status: args.status,
    data: args.data,
    guide: args.guide || `../../../builds/${args.id}.html`
  };
  const nextBuilds = [...(manifest.builds || [])];
  if (existingIndex >= 0) nextBuilds[existingIndex] = entry;
  else nextBuilds.push(entry);
  const nextManifest = { ...manifest, builds: nextBuilds };

  if (args.write) {
    await writeFile(manifestFile, `${JSON.stringify(nextManifest, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    status: args.write ? 'written' : 'dry-run',
    season: args.season,
    id: args.id,
    manifestFile: path.relative(repoRoot, manifestFile),
    entry,
    guide: validation.guide,
    note: args.write ? 'manifest.json updated' : 'dry-run only; pass --write to update manifest.json'
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
