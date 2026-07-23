#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { season: 's05', build: null, stage: null, file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--build') args.build = argv[++i];
    else if (arg === '--stage') args.stage = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-routes.mjs [--season s05]',
    '  node scripts/validate-routes.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file tree/tactician-supporting-fire-campaign-early.json',
    '',
    'Checks route JSON files registered in data/seasons/<season>/manifest.json.',
    'Use --build, --stage, and --file to validate one candidate route against the matching manifest route metadata.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function resolveRouteFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

async function validateRoute(seasonRoot, route) {
  const failures = [];
  const routePath = resolveRouteFile(seasonRoot, route.data);
  let data;
  try {
    data = await readJson(routePath);
  } catch (error) {
    return {
      route: `${route.buildId}:${route.stageId}`,
      file: route.data,
      status: 'failed',
      failures: [`Cannot read route JSON: ${error.message}`]
    };
  }

  const routeLabel = `${route.buildId}:${route.stageId}`;
  assert(data.meta, `${routeLabel} missing meta`, failures);
  assert(data.meta?.buildId === route.buildId, `${routeLabel} meta.buildId mismatch`, failures);
  assert(data.meta?.stageId === route.stageId, `${routeLabel} meta.stageId mismatch`, failures);
  assert(data.meta?.origin === route.origin, `${routeLabel} origin mismatch`, failures);
  assert(data.meta?.overridePolicy === route.overridePolicy, `${routeLabel} overridePolicy mismatch`, failures);
  assert(data.meta?.handTuned === route.handTuned, `${routeLabel} handTuned mismatch`, failures);
  assert(Array.isArray(data.nodeIds), `${routeLabel} nodeIds missing`, failures);
  assert(data.nodeIds.length === route.nodes, `${routeLabel} node count mismatch: route ${route.nodes}, data ${data.nodeIds?.length}`, failures);
  assert(new Set(data.nodeIds).size === data.nodeIds.length, `${routeLabel} duplicate node IDs`, failures);

  for (const lang of ['en', 'zh-CN', 'zh-TW']) {
    const nodes = data.locales?.[lang];
    assert(Array.isArray(nodes), `${routeLabel} missing locale ${lang}`, failures);
    if (Array.isArray(nodes)) {
      assert(nodes.length === data.nodeIds.length, `${routeLabel} locale ${lang} count mismatch`, failures);
      const ids = nodes.map((node) => node.id);
      assert(ids.every((id) => data.nodeIds.includes(id)), `${routeLabel} locale ${lang} contains unknown node`, failures);
      assert(nodes.every((node, index) => node.order === index + 1), `${routeLabel} locale ${lang} order mismatch`, failures);
    }
  }

  if (route.origin === 'projected-from-endgame-order') {
    assert(data.meta?.projection?.strategy === 'prefix-by-pob-node-order', `${routeLabel} projected route missing projection strategy`, failures);
    assert(route.overridePolicy === 'replaceable-until-hand-tuned', `${routeLabel} projected route should remain replaceable until hand tuned`, failures);
  }

  return {
    route: routeLabel,
    file: route.data,
    status: failures.length ? 'failed' : 'ok',
    nodes: data.nodeIds.length,
    origin: route.origin,
    overridePolicy: route.overridePolicy,
    handTuned: route.handTuned,
    failures
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const routes = manifest.tree?.routes || [];

  if (args.file || args.build || args.stage) {
    if (!args.file || !args.build || !args.stage) throw new Error('--file, --build, and --stage must be used together');
    const manifestRoute = routes.find((route) => route.buildId === args.build && route.stageId === args.stage);
    if (!manifestRoute) throw new Error(`No manifest route found for ${args.build}:${args.stage}`);
    const result = await validateRoute(seasonRoot, { ...manifestRoute, data: args.file });
    console.log(JSON.stringify({
      season: args.season,
      mode: 'single-file',
      failed: result.status === 'ok' ? 0 : 1,
      result
    }, null, 2));
    if (result.status !== 'ok') process.exit(1);
    return;
  }

  const results = [];
  for (const route of routes) {
    results.push(await validateRoute(seasonRoot, route));
  }

  const failed = results.filter((result) => result.status !== 'ok');
  console.log(JSON.stringify({
    season: args.season,
    routeCount: results.length,
    failed: failed.length,
    results
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
