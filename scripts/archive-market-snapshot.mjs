#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketKinds = ['gemFlips', 'hideoutFlips'];

function usage() {
  return [
    'Usage:',
    '  node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file market/candidates/gemFlips-2026-07-22-gems.json --key 2026-07-22-gems',
    '  node scripts/archive-market-snapshot.mjs --season s05 --kind hideoutFlips --file /tmp/hideout-market.json --key 2026-07-22-hideout --write',
    '',
    'Validates a real market snapshot, copies it into the versioned market archive folder, and points manifest.market.<kind> to it.',
    'Default mode is dry-run. Use --write to modify files.',
    'Fixture/example files are rejected by default; pass --allow-fixture only for local script tests.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    kind: null,
    file: null,
    key: null,
    write: false,
    force: false,
    allowFixture: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--kind') args.kind = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--key') args.key = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--allow-fixture') args.allowFixture = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
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

function resolveCandidateFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function parseJsonOutput(output, fallback) {
  if (!output) return fallback;
  try {
    return JSON.parse(output);
  } catch {
    return fallback;
  }
}

function looksLikeFixture(candidateFile, candidate) {
  const normalizedPath = candidateFile.split(path.sep).join(path.posix.sep);
  const fixtureTokens = [
    normalizedPath.includes('/examples/'),
    normalizedPath.endsWith('.example.json'),
    String(candidate.id || '').includes('example'),
    String(candidate.source?.provider || '').includes('fixture'),
    String(candidate.source?.note || '').toLowerCase().includes('prices are not live')
  ];
  return fixtureTokens.some(Boolean);
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
  if (!marketKinds.includes(args.kind)) throw new Error('--kind must be gemFlips or hideoutFlips');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifestPath = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const key = slug(args.key);
  const candidateFile = resolveCandidateFile(seasonRoot, args.file);
  const candidate = await readJson(candidateFile);
  const targetFile = path.posix.join(manifest.dataFolders?.market || 'market', 'snapshots', `${args.kind}-${key}.json`);
  const targetPath = path.join(seasonRoot, targetFile);
  const validateRun = await runNodeScript('scripts/validate-market.mjs', ['--season', args.season, '--kind', args.kind, '--file', args.file]);

  const failures = [];
  if (validateRun.code !== 0) failures.push('candidate validation failed');
  if (candidate.source?.type !== 'real-snapshot-v1') failures.push('candidate source.type must be real-snapshot-v1');
  if (!args.allowFixture && looksLikeFixture(candidateFile, candidate)) {
    failures.push('fixture/example market snapshots cannot be archived without --allow-fixture');
  }
  if (existsSync(targetPath) && !args.force) failures.push(`target file already exists: ${targetFile}`);

  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    kind: args.kind,
    key,
    candidateFile: path.relative(repoRoot, candidateFile),
    previousManifestFile: manifest.market?.[args.kind] || null,
    targetFile,
    snapshotId: candidate.id || null,
    sourceType: candidate.source?.type || null,
    provider: candidate.source?.provider || null,
    league: candidate.source?.league || null,
    fetchedAt: candidate.source?.fetchedAt || null,
    entries: Array.isArray(candidate.entries) ? candidate.entries.length : 0,
    failed: failures.length,
    failures,
    validation: parseJsonOutput(validateRun.stdout, {
      status: validateRun.code === 0 ? 'ok' : 'failed',
      stdout: validateRun.stdout,
      stderr: validateRun.stderr
    })
  };

  if (failures.length) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(1);
  }

  if (!args.write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  await writeJson(targetPath, candidate);
  manifest.market = {
    ...(manifest.market || {}),
    [args.kind]: targetFile
  };
  await writeJson(manifestPath, manifest);

  console.log(JSON.stringify({ ...plan, status: 'written' }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
