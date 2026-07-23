#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    season: 's05',
    file: null,
    build: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-build-candidate-routes.mjs [--season s05]',
    '  node scripts/validate-build-candidate-routes.mjs --season s05 --build infernalist-minions',
    '',
    'Validates every existing routeCandidates entry from the versioned build candidate backlog.',
    'This only checks candidate route files that are listed in builds/candidates.json; missing future route files are handled by scaffold-route.mjs and data-update.html.'
  ].join('\n');
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

function collectRouteCandidates(queue, buildFilter) {
  const rows = [];
  for (const candidate of queue.candidates || []) {
    if (buildFilter && candidate.id !== buildFilter) continue;
    for (const route of candidate.routeCandidates || []) {
      rows.push({
        buildId: candidate.id,
        buildStatus: candidate.status || '',
        stageId: route.stageId,
        file: route.file,
        status: route.status || ''
      });
    }
  }
  return rows;
}

async function validateRouteRows(season, rows) {
  const results = [];
  for (const row of rows) {
    const result = await runNodeScript('scripts/validate-route-candidate.mjs', [
      '--season',
      season,
      '--build',
      row.buildId,
      '--stage',
      row.stageId,
      '--file',
      row.file
    ]);
    let summary = null;
    try {
      summary = result.stdout ? JSON.parse(result.stdout) : null;
    } catch (error) {
      summary = { parseFailure: error.message };
    }
    results.push({
      ...row,
      validatorStatus: result.code === 0 ? 'ok' : 'failed',
      nodeCount: summary?.nodeCount || 0,
      localeCount: summary?.localeCount || 0,
      warningCount: summary?.warningCount || 0,
      failures: summary?.failures || (result.stderr ? [result.stderr] : []),
      warnings: summary?.warnings || []
    });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const queueFile = args.file || manifest.buildCandidates || 'builds/candidates.json';
  const queue = await readJson(resolveSeasonFile(seasonRoot, queueFile));
  const rows = collectRouteCandidates(queue, args.build);
  const results = await validateRouteRows(args.season, rows);
  const failed = results.filter((row) => row.validatorStatus !== 'ok');
  const missingBuildFilter = args.build && !(queue.candidates || []).some((candidate) => candidate.id === args.build);
  const output = {
    season: args.season,
    file: path.relative(repoRoot, resolveSeasonFile(seasonRoot, queueFile)),
    buildFilter: args.build || '',
    status: failed.length || missingBuildFilter ? 'failed' : 'ok',
    candidateCount: (queue.candidates || []).length,
    routeCandidateCount: rows.length,
    validatedCount: results.length,
    failedCount: failed.length + (missingBuildFilter ? 1 : 0),
    routeCandidates: results,
    failures: [
      ...(missingBuildFilter ? [`build candidate not found: ${args.build}`] : []),
      ...failed.flatMap((row) => row.failures.map((failure) => `${row.buildId}:${row.stageId}: ${failure}`))
    ]
  };
  console.log(JSON.stringify(output, null, 2));
  if (output.status !== 'ok') process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
