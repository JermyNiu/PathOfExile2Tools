#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionsPath = path.join(repoRoot, 'data', 'versions.json');

function usage() {
  return [
    'Usage:',
    '  node scripts/switch-current.mjs --id s05-tree-4.5',
    '  node scripts/switch-current.mjs --id s05-tree-4.5 --write',
    '',
    'Checks whether a registered version is ready to become current.',
    'Default mode is dry-run. Use --write to update data/versions.json.',
    'Draft versions are rejected unless --allow-draft is passed for emergency local testing.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    id: null,
    write: false,
    allowDraft: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id') args.id = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--allow-draft') args.allowDraft = true;
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

async function exists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDataFile(dataRoot, file) {
  return path.join(repoRoot, dataRoot, file);
}

function resolveManifestAsset(dataRoot, file) {
  return path.resolve(repoRoot, dataRoot, file);
}

async function collectReadiness(version, manifest) {
  const checks = [];
  const dataRoot = version.dataRoot;

  checks.push({ label: 'manifest', file: path.join(dataRoot, 'manifest.json') });
  for (const [key, file] of Object.entries(manifest.tree?.raw || {})) {
    if (key !== 'version' && file) checks.push({ label: `tree.raw.${key}`, file: path.join(dataRoot, file) });
  }
  for (const [key, file] of Object.entries(manifest.tree?.assets || {})) {
    if (file) checks.push({ label: `tree.assets.${key}`, file: path.relative(repoRoot, resolveManifestAsset(dataRoot, file)) });
  }
  for (const route of manifest.tree?.routes || []) {
    checks.push({ label: `route.${route.buildId}.${route.stageId}`, file: path.join(dataRoot, route.data) });
  }
  for (const build of manifest.builds || []) {
    checks.push({ label: `build.${build.id}`, file: path.join(dataRoot, build.data) });
  }
  for (const [key, file] of Object.entries(manifest.market || {})) {
    if (file) checks.push({ label: `market.${key}`, file: path.join(dataRoot, file) });
  }
  for (const [key, file] of Object.entries(manifest.ninja || {})) {
    if (file) checks.push({ label: `ninja.${key}`, file: path.join(dataRoot, file) });
  }

  const results = [];
  for (const check of checks) {
    results.push({
      ...check,
      status: await exists(path.join(repoRoot, check.file)) ? 'ok' : 'missing'
    });
  }
  return results;
}

function validateMetadata(version, manifest) {
  const failures = [];
  if (manifest.versionId !== version.id) failures.push('manifest.versionId mismatch');
  if (manifest.label !== version.season) failures.push('manifest.label mismatch');
  if (manifest.tree?.poe2dbVersion !== version.poe2dbPassiveTreeVersion) failures.push('manifest.tree.poe2dbVersion mismatch');
  if (manifest.tree?.pobbSvgVersion !== version.pobbTreeSvgVersion) failures.push('manifest.tree.pobbSvgVersion mismatch');
  if ((manifest.builds || []).length !== version.buildCount) failures.push('manifest build count mismatch');
  return failures;
}

function makeCurrent(version, manifest) {
  return {
    id: version.id,
    season: version.season,
    poe2dbPassiveTreeVersion: version.poe2dbPassiveTreeVersion,
    pobbTreeSvgVersion: version.pobbTreeSvgVersion,
    dataRoot: version.dataRoot,
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: [
      `Selected by scripts/switch-current.mjs from ${version.id}.`,
      `PoE2DB passive tree ${manifest.tree?.poe2dbVersion}; PoB SVG ${manifest.tree?.pobbSvgVersion}.`
    ]
  };
}

function makeSources(versions, manifest) {
  return {
    ...(versions.sources || {}),
    poe2dbPassiveTree: {
      en: manifest.tree?.sources?.en || '',
      zhCN: manifest.tree?.sources?.zhCN || '',
      zhTW: manifest.tree?.sources?.zhTW || ''
    },
    pobbTreeSvg: manifest.tree?.sources?.svg || versions.sources?.pobbTreeSvg || ''
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.id) throw new Error('--id is required');

  const versions = await readJson(versionsPath);
  const targetIndex = (versions.history || []).findIndex((version) => version.id === args.id);
  if (targetIndex < 0) throw new Error(`version not found: ${args.id}`);
  const target = versions.history[targetIndex];
  const manifestPath = path.join(repoRoot, target.dataRoot, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const readiness = await collectReadiness(target, manifest);
  const missing = readiness.filter((item) => item.status !== 'ok');
  const metadataFailures = validateMetadata(target, manifest);
  const statusFailure = target.status === 'draft' && !args.allowDraft ? ['target version is draft'] : [];
  const failures = [...statusFailure, ...metadataFailures, ...missing.map((item) => `missing ${item.label}: ${item.file}`)];
  const nextCommands = [
    `node scripts/validate-versions.mjs --id ${target.id}`,
    `node scripts/validate-all.mjs --season ${target.dataRoot.split('/').pop()}`,
    `node scripts/validate-suite.mjs --season ${target.dataRoot.split('/').pop()} --serve`
  ];
  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    id: args.id,
    fromCurrent: versions.current?.id,
    toCurrent: target.id,
    targetStatus: target.status || 'unknown',
    failed: failures.length,
    failures,
    checkedFiles: readiness.length,
    missingFiles: missing,
    nextCommands
  };

  if (failures.length) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(1);
  }

  if (!args.write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  versions.current = makeCurrent(target, manifest);
  versions.sources = makeSources(versions, manifest);
  versions.history = versions.history.map((version, index) => {
    if (index === targetIndex) return { ...version, status: 'active' };
    if (version.status === 'active') return { ...version, status: 'archived' };
    return version;
  });
  await writeJson(versionsPath, versions);

  console.log(JSON.stringify({ ...plan, status: 'written' }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
