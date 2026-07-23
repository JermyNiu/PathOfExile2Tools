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
    '  node scripts/archive-skill-catalog.mjs --season s05 --file skills/examples/poe2db-skill-catalog-v1.example.json --key 2026-07-22-poe2db',
    '  node scripts/archive-skill-catalog.mjs --season s05 --file /tmp/poe2db-skill-catalog.json --key 2026-07-22-poe2db --write',
    '',
    'Validates a PoE2DB/Chronicle skill catalog candidate, copies it into the versioned skills archive folder, and points manifest.skills.catalog to it.',
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
    .replace(/^-+|-+$/g, '') || 'skill-catalog';
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

async function collectBuildSkillReferences(seasonRoot, manifest) {
  const active = new Set();
  const supports = new Set();
  for (const buildEntry of manifest.builds || []) {
    const build = await readJson(path.join(seasonRoot, buildEntry.data));
    for (const skill of build.skills?.active || []) active.add(skill.id);
    for (const supportId of Object.keys(build.skills?.supports || {})) supports.add(supportId);
  }
  return { active, supports };
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
  const targetFile = path.posix.join(manifest.dataFolders?.skills || 'skills', 'snapshots', `catalog-${key}.json`);
  const targetPath = path.join(seasonRoot, targetFile);
  const validateRun = await runNodeScript('scripts/validate-skills.mjs', ['--season', args.season, '--file', args.file]);
  const candidateActive = new Set((candidate.entries || []).filter((entry) => entry.kind === 'active').map((entry) => entry.id));
  const candidateSupports = new Set((candidate.entries || []).filter((entry) => entry.kind === 'support').map((entry) => entry.id));
  const buildRefs = await collectBuildSkillReferences(seasonRoot, manifest);
  const missingActive = [...buildRefs.active].filter((id) => !candidateActive.has(id));
  const missingSupports = [...buildRefs.supports].filter((id) => !candidateSupports.has(id));

  const failures = [];
  if (validateRun.code !== 0) failures.push('candidate validation failed');
  if (candidate.source?.type !== 'poe2db-snapshot-v1') failures.push('candidate source.type must be poe2db-snapshot-v1');
  if (missingActive.length) failures.push(`candidate missing active skills referenced by builds: ${missingActive.join(', ')}`);
  if (missingSupports.length) failures.push(`candidate missing supports referenced by builds: ${missingSupports.join(', ')}`);
  if (existsSync(targetPath) && !args.force) failures.push(`target file already exists: ${targetFile}`);

  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    key,
    candidateFile: path.relative(repoRoot, candidateFile),
    previousManifestCatalog: manifest.skills?.catalog || null,
    targetFile,
    catalogId: candidate.id || null,
    sourceType: candidate.source?.type || null,
    sourceVersion: candidate.source?.version || null,
    fetchedAt: candidate.source?.fetchedAt || candidate.updatedAt || null,
    entries: Array.isArray(candidate.entries) ? candidate.entries.length : 0,
    verifiedEntries: Array.isArray(candidate.entries)
      ? candidate.entries.filter((entry) => entry.verificationStatus === 'verified').length
      : 0,
    buildReferenceCoverage: {
      activeRequired: buildRefs.active.size,
      supportRequired: buildRefs.supports.size,
      missingActive,
      missingSupports
    },
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
  manifest.skills = {
    ...(manifest.skills || {}),
    catalog: targetFile
  };
  manifest.modules = {
    ...(manifest.modules || {}),
    skillCatalog: candidate.source?.type || 'poe2db-snapshot-v1'
  };
  await writeJson(manifestPath, manifest);

  console.log(JSON.stringify({ ...plan, status: 'written' }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
