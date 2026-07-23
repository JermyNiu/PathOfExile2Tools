#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node scripts/archive-ninja-import.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example-tactician',
    '  node scripts/archive-ninja-import.mjs --season s05 --file /tmp/export.json --key player-name --write',
    '',
    'Validates an exported ninja/player import JSON, copies it into the versioned ninja archive folder, and registers it in manifest.ninja.',
    'Default mode is dry-run. Use --write to modify files.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    file: null,
    key: null,
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--key') args.key = argv[++i];
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
    .replace(/^-+|-+$/g, '') || 'ninja-import';
}

function resolveCandidateFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  requireArg(args.file, '--file');
  requireArg(args.key, '--key');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifestPath = path.join(seasonRoot, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const key = slug(args.key);
  const candidateFile = resolveCandidateFile(seasonRoot, args.file);
  const candidate = await readJson(candidateFile);
  const targetFile = path.posix.join(manifest.dataFolders?.ninja || 'ninja', 'imports', `${key}.json`);
  const targetPath = path.join(seasonRoot, targetFile);
  const validateRun = await runNodeScript('scripts/validate-ninja.mjs', ['--season', args.season, '--file', args.file, '--key', key]);
  const failures = [];
  if (validateRun.code !== 0) failures.push('candidate validation failed');
  if (manifest.ninja?.[key] && !args.force) failures.push(`manifest.ninja.${key} already exists`);
  if (existsSync(targetPath) && !args.force) failures.push(`target file already exists: ${targetFile}`);

  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    key,
    candidateFile: path.relative(repoRoot, candidateFile),
    targetFile,
    character: candidate.character || null,
    assignedVersion: candidate.assignedVersion || '',
    failed: failures.length,
    failures,
    validation: validateRun.stdout ? JSON.parse(validateRun.stdout) : null
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
  manifest.ninja = {
    ...(manifest.ninja || {}),
    [key]: targetFile
  };
  await writeJson(manifestPath, manifest);

  console.log(JSON.stringify({ ...plan, status: 'written' }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
