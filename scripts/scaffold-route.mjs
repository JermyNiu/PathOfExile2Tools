#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeFiles = [
  ['en', 'en'],
  ['zh-CN', 'zhCN'],
  ['zh-TW', 'zhTW']
];

function usage() {
  return [
    'Usage:',
    '  node scripts/scaffold-route.mjs --season s05 --build infernalist-minions --stage campaign-early --nodes 6077,27296 --out /tmp/infernalist-campaign-early-route.json',
    '  node scripts/scaffold-route.mjs --season s05 --build infernalist-minions --stage campaign-early --nodes 6077,27296 --out /tmp/infernalist-campaign-early-route.json --write',
    '',
    'Builds a hand-tuned passive route candidate JSON from node IDs and PoE2DB raw tree data.',
    'Dry-run by default. Use --write to write --out.',
    'This does not edit manifest.json, build JSON, or publish the build.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    build: '',
    stage: '',
    nodes: '',
    out: '',
    classId: 0,
    ascendancyId: 0,
    alternateAscendancyId: 0,
    write: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--stage') args.stage = argv[++i];
    else if (arg === '--nodes') args.nodes = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--class-id') args.classId = Number(argv[++i]);
    else if (arg === '--ascendancy-id') args.ascendancyId = Number(argv[++i]);
    else if (arg === '--alternate-ascendancy-id') args.alternateAscendancyId = Number(argv[++i]);
    else if (arg === '--write') args.write = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function requireKebab(value, label) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || '')) {
    throw new Error(`${label} must be lowercase kebab-case`);
  }
}

function parseNodeIds(value) {
  const nodes = String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (!nodes.length) throw new Error('--nodes must contain at least one numeric node id');
  if (new Set(nodes).size !== nodes.length) throw new Error('--nodes contains duplicate ids');
  return nodes;
}

function resolveSeasonFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function normalizeNode(rawNode, order, id) {
  return {
    order,
    id,
    name: rawNode?.name || `Node ${id}`,
    kind: rawNode?.isNotable ? 'Notable' : rawNode?.isKeystone ? 'Keystone' : rawNode?.isJewelSocket ? 'JewelSocket' : 'Normal',
    stats: Array.isArray(rawNode?.stats) ? rawNode.stats : [],
    asc: rawNode?.ascendancyName || rawNode?.ascendancy || ''
  };
}

async function buildLocales(seasonRoot, manifest, nodeIds) {
  const rawFiles = manifest.tree?.raw || {};
  const locales = {};
  for (const [outputKey, manifestKey] of localeFiles) {
    const rawFile = rawFiles[manifestKey];
    if (!rawFile) throw new Error(`manifest.tree.raw.${manifestKey} missing`);
    const raw = await readJson(resolveSeasonFile(seasonRoot, rawFile));
    const rawNodes = raw.nodes || {};
    locales[outputKey] = nodeIds.map((id, index) => {
      const rawNode = rawNodes[String(id)] || rawNodes[id];
      if (!rawNode) throw new Error(`Node ${id} missing in ${rawFile}`);
      return normalizeNode(rawNode, index + 1, id);
    });
  }
  return locales;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  requireKebab(args.build, '--build');
  requireKebab(args.stage, '--stage');
  const nodeIds = parseNodeIds(args.nodes);
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const locales = await buildLocales(seasonRoot, manifest, nodeIds);
  const outFile = path.resolve(repoRoot, args.out || path.join('/tmp', `${args.build}-${args.stage}-hand-tuned.json`));

  const route = {
    nodeIds,
    classId: args.classId,
    ascendancyId: args.ascendancyId,
    alternateAscendancyId: args.alternateAscendancyId,
    locales,
    meta: {
      buildId: args.build,
      stageId: args.stage,
      origin: 'hand-tuned-manual',
      source: 'scaffold-route.mjs',
      overridePolicy: 'manual-review-required',
      handTuned: true,
      nodes: nodeIds.length,
      nodeCount: nodeIds.length,
      poe2dbVersion: manifest.tree?.poe2dbVersion || manifest.tree?.raw?.version || '',
      createdAt: new Date().toISOString(),
      review: {
        status: '待复核',
        reason: '由节点 ID 生成的手调候选路线；写入 manifest 前必须人工确认顺序、属性和阶段适配。',
        useUntil: '仅作为候选文件，不代表当前版本正式路线。',
        manualChecks: [
          '确认节点 ID 顺序来自实际开荒阶段，而不是终局路线截断。',
          '确认该阶段需要的属性、精魂、生存和输出节点没有过早绕路。',
          '确认独立天赋树查看器能高亮全部节点并显示三语言属性。'
        ]
      }
    }
  };

  const result = {
    mode: args.write ? 'write' : 'dry-run',
    season: args.season,
    buildId: args.build,
    stageId: args.stage,
    nodeCount: nodeIds.length,
    out: path.relative(repoRoot, outFile),
    route
  };

  if (args.write) {
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, `${JSON.stringify(route, null, 2)}\n`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
