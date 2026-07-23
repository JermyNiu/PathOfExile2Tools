#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const langToRawKey = { en: 'en', zhCN: 'zhCN', zhTW: 'zhTW' };

function usage() {
  return [
    'Usage:',
    '  node scripts/diff-tree.mjs --from-file data/seasons/s05/tree/raw/4.5/data_cn.json --to-file data/seasons/s05/tree/raw/4.5/data_cn.json --season s05',
    '  node scripts/diff-tree.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6 --lang zhCN --season s05',
    '',
    'Compares PoE2DB passive tree raw node data and reports added, removed, changed nodes, plus route impact when --season is provided.',
    'The script is read-only and never updates route or manifest files.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    fromFile: null,
    toFile: null,
    fromVersion: null,
    toVersion: null,
    lang: 'zhCN',
    season: null,
    limit: 20
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from-file') args.fromFile = argv[++i];
    else if (arg === '--to-file') args.toFile = argv[++i];
    else if (arg === '--from-version') args.fromVersion = argv[++i];
    else if (arg === '--to-version') args.toVersion = argv[++i];
    else if (arg === '--lang') args.lang = argv[++i];
    else if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer');
  if (!langToRawKey[args.lang]) throw new Error('--lang must be one of en, zhCN, zhTW');
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function resolveRepoFile(file) {
  if (path.isAbsolute(file)) return file;
  return path.join(repoRoot, file);
}

async function resolveRawFile(versionId, lang) {
  const versions = await readJson(path.join(repoRoot, 'data', 'versions.json'));
  const version = (versions.history || []).find((item) => item.id === versionId);
  if (!version) throw new Error(`version not found: ${versionId}`);
  const manifest = await readJson(path.join(repoRoot, version.dataRoot, 'manifest.json'));
  const rawPath = manifest.tree?.raw?.[langToRawKey[lang]];
  if (!rawPath) throw new Error(`manifest raw file missing for ${versionId}/${lang}`);
  return path.join(repoRoot, version.dataRoot, rawPath);
}

async function resolveCompareFile(args, side) {
  const explicitFile = side === 'from' ? args.fromFile : args.toFile;
  const versionId = side === 'from' ? args.fromVersion : args.toVersion;
  if (explicitFile) return resolveRepoFile(explicitFile);
  if (versionId) return resolveRawFile(versionId, args.lang);
  throw new Error(`--${side}-file or --${side}-version is required`);
}

function normalizeNode(node) {
  return {
    id: String(node.skill ?? node.id ?? ''),
    name: node.name || '',
    stats: Array.isArray(node.stats) ? node.stats.map(String) : [],
    isNotable: Boolean(node.isNotable),
    isKeystone: Boolean(node.isKeystone),
    isAscendancyStart: Boolean(node.isAscendancyStart),
    ascendancyName: node.ascendancyName || '',
    classStartIndex: Array.isArray(node.classStartIndex) ? node.classStartIndex.map(Number) : node.classStartIndex ?? null
  };
}

function extractNodes(raw) {
  const nodes = raw.nodes || {};
  const result = new Map();
  for (const [id, node] of Object.entries(nodes)) {
    result.set(String(id), normalizeNode({ ...node, skill: node.skill ?? id }));
  }
  return result;
}

function arrayEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function diffOneNode(before, after) {
  const changes = [];
  if (before.name !== after.name) changes.push('name');
  if (!arrayEqual(before.stats, after.stats)) changes.push('stats');
  for (const key of ['isNotable', 'isKeystone', 'isAscendancyStart', 'ascendancyName']) {
    if (before[key] !== after[key]) changes.push(key);
  }
  const beforeClassStart = Array.isArray(before.classStartIndex) ? before.classStartIndex : [];
  const afterClassStart = Array.isArray(after.classStartIndex) ? after.classStartIndex : [];
  if (!arrayEqual(beforeClassStart, afterClassStart)) changes.push('classStartIndex');
  return changes;
}

function summarizeNode(node) {
  return {
    name: node.name,
    stats: node.stats,
    isNotable: node.isNotable,
    isKeystone: node.isKeystone,
    ascendancyName: node.ascendancyName
  };
}

async function routeImpact(season, changedNodeIds, limit) {
  if (!season) return [];
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const impacted = [];

  for (const route of manifest.tree?.routes || []) {
    const routeFile = path.join(seasonRoot, route.data);
    const data = await readJson(routeFile);
    const hitIds = (data.nodeIds || []).map(String).filter((id) => changedNodeIds.has(id));
    if (hitIds.length) {
      impacted.push({
        buildId: route.buildId,
        stageId: route.stageId,
        routeFile: route.data,
        affectedNodeCount: hitIds.length,
        affectedNodeIds: hitIds.slice(0, limit)
      });
    }
  }

  return impacted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const fromFile = await resolveCompareFile(args, 'from');
  const toFile = await resolveCompareFile(args, 'to');
  const before = extractNodes(await readJson(fromFile));
  const after = extractNodes(await readJson(toFile));
  const beforeIds = new Set(before.keys());
  const afterIds = new Set(after.keys());
  const addedIds = [...afterIds].filter((id) => !beforeIds.has(id)).sort((a, b) => Number(a) - Number(b));
  const removedIds = [...beforeIds].filter((id) => !afterIds.has(id)).sort((a, b) => Number(a) - Number(b));
  const changed = [];

  for (const id of [...beforeIds].filter((nodeId) => afterIds.has(nodeId))) {
    const changes = diffOneNode(before.get(id), after.get(id));
    if (changes.length) {
      changed.push({
        id,
        changes,
        before: summarizeNode(before.get(id)),
        after: summarizeNode(after.get(id))
      });
    }
  }
  changed.sort((a, b) => Number(a.id) - Number(b.id));

  const changedNodeIds = new Set([...addedIds, ...removedIds, ...changed.map((item) => item.id)]);
  const impactedRoutes = await routeImpact(args.season, changedNodeIds, args.limit);

  console.log(JSON.stringify({
    lang: args.lang,
    fromFile: path.relative(repoRoot, fromFile),
    toFile: path.relative(repoRoot, toFile),
    compared: {
      fromNodes: before.size,
      toNodes: after.size
    },
    summary: {
      added: addedIds.length,
      removed: removedIds.length,
      changed: changed.length,
      impactedRoutes: impactedRoutes.length
    },
    addedNodeIds: addedIds.slice(0, args.limit),
    removedNodeIds: removedIds.slice(0, args.limit),
    changedNodes: changed.slice(0, args.limit),
    impactedRoutes: impactedRoutes.slice(0, args.limit)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
