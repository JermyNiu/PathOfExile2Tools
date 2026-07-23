#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionsPath = path.join(repoRoot, 'data', 'versions.json');

function usage() {
  return [
    'Usage:',
    '  node scripts/create-version.mjs --id s05-tree-4.6 --season S05 --poe2db-version 4.6 --pobb-svg-version 4.6 --data-root data/seasons/s05-tree-4.6',
    '  node scripts/create-version.mjs --id s05-tree-4.6 --season S05 --poe2db-version 4.6 --pobb-svg-version 4.6 --data-root data/seasons/s05-tree-4.6 --write',
    '',
    'Clones the current version data folder into a new draft version folder and registers it in data/versions.json.',
    'Default mode is dry-run. Use --write to create files.',
    'The script never changes current; use scripts/switch-current.mjs after source data and validators pass.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    write: false,
    id: null,
    season: null,
    poe2dbVersion: null,
    pobbSvgVersion: null,
    dataRoot: null,
    fromId: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--season') args.season = argv[++i];
    else if (arg === '--poe2db-version') args.poe2dbVersion = argv[++i];
    else if (arg === '--pobb-svg-version') args.pobbSvgVersion = argv[++i];
    else if (arg === '--data-root') args.dataRoot = argv[++i];
    else if (arg === '--from-id') args.fromId = argv[++i];
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

async function patchJsonFile(file, patcher) {
  if (!existsSync(file)) return { file: path.relative(repoRoot, file), status: 'missing' };
  const data = await readJson(file);
  const next = patcher(data);
  await writeJson(file, next);
  return { file: path.relative(repoRoot, file), status: 'patched' };
}

function requireArg(value, name) {
  if (!value || !String(value).trim()) throw new Error(`${name} is required`);
}

function sourceUrls(poe2dbVersion, pobbSvgVersion) {
  return {
    en: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_us.json?5`,
    zhCN: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_cn.json?5`,
    zhTW: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_tw.json?5`,
    svg: `https://pobb.in/assets/${pobbSvgVersion}.svg`
  };
}

function updateManifest(manifest, args) {
  const next = structuredClone(manifest);
  const today = new Date().toISOString().slice(0, 10);
  next.versionId = args.id;
  next.label = args.season;
  next.updatedAt = today;
  next.tree = next.tree || {};
  next.tree.poe2dbVersion = args.poe2dbVersion;
  next.tree.pobbSvgVersion = args.pobbSvgVersion;
  next.tree.sources = sourceUrls(args.poe2dbVersion, args.pobbSvgVersion);
  next.tree.raw = {
    version: args.poe2dbVersion,
    en: `tree/raw/${args.poe2dbVersion}/data_us.json`,
    zhCN: `tree/raw/${args.poe2dbVersion}/data_cn.json`,
    zhTW: `tree/raw/${args.poe2dbVersion}/data_tw.json`
  };
  next.tree.assets = {
    ...(next.tree.assets || {}),
    baseSvg: `../../../assets/poe2-tree-${args.pobbSvgVersion}.svg`,
    highlightSvg: `../../../assets/poe2-tree-${args.pobbSvgVersion}-highlight.svg`
  };
  return next;
}

function makeHistoryEntry(args, manifest) {
  return {
    id: args.id,
    season: args.season,
    poe2dbPassiveTreeVersion: args.poe2dbVersion,
    pobbTreeSvgVersion: args.pobbSvgVersion,
    dataRoot: args.dataRoot,
    builds: (manifest.builds || []).map((build) => path.posix.join(args.dataRoot, build.data)),
    buildCount: manifest.builds?.length || 0,
    status: 'draft'
  };
}

async function patchClonedVersionData(targetRoot, manifest, args) {
  const results = [];
  for (const build of manifest.builds || []) {
    results.push(await patchJsonFile(path.join(targetRoot, build.data), (data) => ({
      ...data,
      season: args.season,
      versionId: args.id
    })));
  }

  for (const marketFile of Object.values(manifest.market || {}).filter(Boolean)) {
    results.push(await patchJsonFile(path.join(targetRoot, marketFile), (data) => ({
      ...data,
      season: args.season,
      versionId: args.id
    })));
  }

  for (const ninjaFile of Object.values(manifest.ninja || {}).filter(Boolean)) {
    results.push(await patchJsonFile(path.join(targetRoot, ninjaFile), (data) => ({
      ...data,
      selectedToolVersion: args.id,
      explicitVersion: data.explicitVersion ? args.id : data.explicitVersion,
      assignedVersion: args.id
    })));
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  requireArg(args.id, '--id');
  requireArg(args.season, '--season');
  requireArg(args.poe2dbVersion, '--poe2db-version');
  requireArg(args.pobbSvgVersion, '--pobb-svg-version');
  requireArg(args.dataRoot, '--data-root');

  const versions = await readJson(versionsPath);
  const fromId = args.fromId || versions.current?.id;
  const sourceVersion = (versions.history || []).find((version) => version.id === fromId);
  if (!sourceVersion) throw new Error(`source version not found: ${fromId}`);
  if ((versions.history || []).some((version) => version.id === args.id)) {
    throw new Error(`target version already exists in history: ${args.id}`);
  }

  const sourceRoot = path.join(repoRoot, sourceVersion.dataRoot);
  const targetRoot = path.join(repoRoot, args.dataRoot);
  const targetManifestPath = path.join(targetRoot, 'manifest.json');
  if (!existsSync(sourceRoot)) throw new Error(`source dataRoot missing: ${sourceVersion.dataRoot}`);
  if (existsSync(targetRoot)) throw new Error(`target dataRoot already exists: ${args.dataRoot}`);

  const sourceManifest = await readJson(path.join(sourceRoot, 'manifest.json'));
  const targetManifest = updateManifest(sourceManifest, args);
  const historyEntry = makeHistoryEntry(args, targetManifest);
  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    fromId,
    sourceDataRoot: sourceVersion.dataRoot,
    targetVersion: historyEntry,
    targetManifest: path.relative(repoRoot, targetManifestPath),
    nextCommands: [
      `node scripts/update-data.mjs --data-root ${args.dataRoot} --season ${args.season} --poe2db-version ${args.poe2dbVersion} --pobb-svg-version ${args.pobbSvgVersion} --write`,
      `node scripts/validate-versions.mjs --id ${args.id}`,
      'node scripts/validate-versions.mjs'
    ]
  };

  if (!args.write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });
  await writeJson(targetManifestPath, targetManifest);
  const patchedFiles = await patchClonedVersionData(targetRoot, targetManifest, args);
  versions.history.push(historyEntry);
  await writeJson(versionsPath, versions);

  console.log(JSON.stringify({ ...plan, status: 'written', patchedFiles }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
