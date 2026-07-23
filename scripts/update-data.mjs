#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionsPath = path.join(repoRoot, 'data', 'versions.json');

function parseArgs(argv) {
  const args = {
    write: false,
    force: false,
    season: null,
    dataRoot: null,
    poe2dbVersion: null,
    pobbSvgVersion: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--season') args.season = argv[++i];
    else if (arg === '--data-root') args.dataRoot = argv[++i];
    else if (arg === '--poe2db-version') args.poe2dbVersion = argv[++i];
    else if (arg === '--pobb-svg-version') args.pobbSvgVersion = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/update-data.mjs [--season S05] [--data-root data/seasons/s05] [--poe2db-version 4.5] [--pobb-svg-version 4.4] [--write] [--force]',
    '',
    'Default mode is dry-run: it prints the planned sources and target files.',
    '--write downloads source data into the selected season folder.',
    '--force allows replacing existing downloaded source files.'
  ].join('\n');
}

function seasonFolder(season) {
  return String(season).trim().toLowerCase();
}

async function loadVersions() {
  return JSON.parse(await readFile(versionsPath, 'utf8'));
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}

async function writeIfAllowed(file, text, force) {
  if (existsSync(file) && !force) {
    return { file, status: 'exists' };
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return { file, status: 'written', bytes: Buffer.byteLength(text) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const versions = await loadVersions();
  const current = versions.current;
  const season = args.season || current.season;
  const poe2dbVersion = args.poe2dbVersion || current.poe2dbPassiveTreeVersion;
  const pobbSvgVersion = args.pobbSvgVersion || current.pobbTreeSvgVersion;
  const folder = seasonFolder(season);
  const seasonRoot = args.dataRoot ? path.join(repoRoot, args.dataRoot) : path.join(repoRoot, 'data', 'seasons', folder);
  const rawTreeRoot = path.join(seasonRoot, 'tree', 'raw', poe2dbVersion);
  const assetFile = path.join(repoRoot, 'assets', `poe2-tree-${pobbSvgVersion}.svg`);

  const sources = {
    en: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_us.json?5`,
    zhCN: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_cn.json?5`,
    zhTW: `https://poe2db.tw/data/passive-skill-tree/${poe2dbVersion}/data_tw.json?5`,
    svg: `https://pobb.in/assets/${pobbSvgVersion}.svg`
  };

  const targets = {
    en: path.join(rawTreeRoot, 'data_us.json'),
    zhCN: path.join(rawTreeRoot, 'data_cn.json'),
    zhTW: path.join(rawTreeRoot, 'data_tw.json'),
    svg: assetFile
  };

  const plan = {
    mode: args.write ? 'write' : 'dry-run',
    season,
    seasonRoot,
    dataRoot: args.dataRoot || path.join('data', 'seasons', folder),
    poe2dbVersion,
    pobbSvgVersion,
    sources,
    targets
  };

  if (!args.write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const results = [];
  for (const key of ['en', 'zhCN', 'zhTW', 'svg']) {
    if (existsSync(targets[key]) && !args.force) {
      results.push({ file: targets[key], status: 'exists' });
      continue;
    }
    const text = await fetchText(sources[key]);
    results.push(await writeIfAllowed(targets[key], text, args.force));
  }

  console.log(JSON.stringify({ ...plan, results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
