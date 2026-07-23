#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-versions.mjs',
    '  node scripts/validate-versions.mjs --id s05-tree-4.5',
    '',
    'Checks data/versions.json and the season manifests referenced by its history entries.',
    'Use --id to validate one history entry and its season manifest.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = { id: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id') args.id = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function exists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function assertManifestFile(dataRoot, file, label, failures) {
  assert(typeof file === 'string' && file.trim().length > 0, `${label} missing`, failures);
  if (typeof file !== 'string' || file.trim().length === 0) return;
  assert(await exists(path.join(dataRoot, file)), `${label} file missing: ${file}`, failures);
}

function localizedReady(value) {
  return Boolean(value)
    && typeof value === 'object'
    && ['zhCN', 'zhTW', 'en'].every((locale) => typeof value[locale] === 'string' && value[locale].trim().length > 0);
}

async function validateBuildCandidates(dataRoot, file, label, failures) {
  await assertManifestFile(dataRoot, file, `${label} manifest.buildCandidates`, failures);
  if (typeof file !== 'string' || file.trim().length === 0) return;
  const absolute = path.join(dataRoot, file);
  if (!(await exists(absolute))) return;
  let data;
  try {
    data = await readJson(absolute);
  } catch (error) {
    failures.push(`${label} manifest.buildCandidates cannot read JSON: ${error.message}`);
    return;
  }
  assert(data.schemaVersion === 1, `${label} buildCandidates invalid schemaVersion`, failures);
  assert(Array.isArray(data.candidates), `${label} buildCandidates missing candidates`, failures);
  const ids = new Set();
  for (const [index, candidate] of (data.candidates || []).entries()) {
    const prefix = `${label} buildCandidates[${index}]`;
    assert(typeof candidate.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id), `${prefix} invalid id`, failures);
    assert(!ids.has(candidate.id), `${prefix} duplicate id: ${candidate.id}`, failures);
    ids.add(candidate.id);
    assert(localizedReady(candidate.title), `${prefix} missing localized title`, failures);
    assert(localizedReady(candidate.class?.base), `${prefix} missing localized base class`, failures);
    assert(localizedReady(candidate.class?.ascendancy), `${prefix} missing localized ascendancy`, failures);
    assert(typeof candidate.data === 'string' && candidate.data.startsWith('builds/') && candidate.data.endsWith('.json'), `${prefix} invalid data path`, failures);
    assert(typeof candidate.guide === 'string' && candidate.guide.endsWith('.html'), `${prefix} invalid guide path`, failures);
  }
}

function validateVersionShape(version, label, failures) {
  assert(typeof version?.id === 'string' && version.id.trim().length > 0, `${label} missing id`, failures);
  assert(typeof version?.season === 'string' && version.season.trim().length > 0, `${label} missing season`, failures);
  assert(typeof version?.poe2dbPassiveTreeVersion === 'string' && version.poe2dbPassiveTreeVersion.trim().length > 0, `${label} missing poe2dbPassiveTreeVersion`, failures);
  assert(typeof version?.pobbTreeSvgVersion === 'string' && version.pobbTreeSvgVersion.trim().length > 0, `${label} missing pobbTreeSvgVersion`, failures);
  assert(typeof version?.dataRoot === 'string' && version.dataRoot.trim().length > 0, `${label} missing dataRoot`, failures);
}

async function validateHistoryEntry(version, index) {
  const failures = [];
  const label = `history[${index}]`;
  validateVersionShape(version, label, failures);
  assert(Number.isInteger(version.buildCount) && version.buildCount >= 0, `${label} invalid buildCount`, failures);
  assert(Array.isArray(version.builds), `${label} missing builds array`, failures);
  assert(['draft', 'active', 'archived'].includes(version.status), `${label} invalid status`, failures);
  if (Array.isArray(version.builds)) {
    assert(version.builds.length === version.buildCount, `${label} buildCount mismatch`, failures);
  }

  const dataRoot = path.join(repoRoot, version.dataRoot || '');
  const manifestPath = path.join(dataRoot, 'manifest.json');
  if (!(await exists(manifestPath))) {
    failures.push(`${label} manifest missing: ${version.dataRoot}/manifest.json`);
    return { versionId: version.id, status: 'failed', failures };
  }

  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    failures.push(`${label} cannot read manifest: ${error.message}`);
    return { versionId: version.id, status: 'failed', failures };
  }

  assert(manifest.versionId === version.id, `${label} manifest.versionId mismatch`, failures);
  assert(manifest.label === version.season, `${label} manifest.label mismatch`, failures);
  assert(manifest.tree?.poe2dbVersion === version.poe2dbPassiveTreeVersion, `${label} manifest tree poe2dbVersion mismatch`, failures);
  assert(manifest.tree?.pobbSvgVersion === version.pobbTreeSvgVersion, `${label} manifest tree pobbSvgVersion mismatch`, failures);
  assert(Array.isArray(manifest.builds), `${label} manifest missing builds`, failures);
  assert(manifest.builds?.length === version.buildCount, `${label} manifest build count mismatch`, failures);
  assert(manifest.dataFolders && typeof manifest.dataFolders === 'object', `${label} manifest missing dataFolders`, failures);
  for (const folder of ['builds', 'tree', 'skills', 'market', 'ninja']) {
    assert(typeof manifest.dataFolders?.[folder] === 'string' && manifest.dataFolders[folder].trim().length > 0, `${label} manifest missing dataFolders.${folder}`, failures);
  }
  assert(manifest.modules && typeof manifest.modules === 'object', `${label} manifest missing modules`, failures);

  for (const buildPath of version.builds || []) {
    assert(await exists(path.join(repoRoot, buildPath)), `${label} build file missing: ${buildPath}`, failures);
  }
  await assertManifestFile(dataRoot, manifest.tree?.raw?.en, `${label} manifest.tree.raw.en`, failures);
  await assertManifestFile(dataRoot, manifest.tree?.raw?.zhCN, `${label} manifest.tree.raw.zhCN`, failures);
  await assertManifestFile(dataRoot, manifest.tree?.raw?.zhTW, `${label} manifest.tree.raw.zhTW`, failures);
  await assertManifestFile(dataRoot, manifest.tree?.assets?.baseSvg, `${label} manifest.tree.assets.baseSvg`, failures);
  await assertManifestFile(dataRoot, manifest.tree?.assets?.highlightSvg, `${label} manifest.tree.assets.highlightSvg`, failures);
  await assertManifestFile(dataRoot, manifest.skills?.catalog, `${label} manifest.skills.catalog`, failures);
  await assertManifestFile(dataRoot, manifest.market?.gemFlips, `${label} manifest.market.gemFlips`, failures);
  await assertManifestFile(dataRoot, manifest.market?.hideoutFlips, `${label} manifest.market.hideoutFlips`, failures);
  await assertManifestFile(dataRoot, manifest.ninja?.sampleImport, `${label} manifest.ninja.sampleImport`, failures);
  await validateBuildCandidates(dataRoot, manifest.buildCandidates || 'builds/candidates.json', label, failures);
  await assertManifestFile(dataRoot, 'ninja/schema-v1.md', `${label} ninja.schema`, failures);
  await assertManifestFile(dataRoot, 'ninja/examples/parsed-import-with-analysis.example.json', `${label} ninja.example.analysis`, failures);
  await assertManifestFile(dataRoot, 'ninja/examples/parsed-raw-pob-xml.example.json', `${label} ninja.example.rawPobXml`, failures);
  for (const [buildIndex, build] of (manifest.builds || []).entries()) {
    await assertManifestFile(dataRoot, build.data, `${label} manifest.builds[${buildIndex}].data`, failures);
  }
  for (const [routeIndex, route] of (manifest.tree?.routes || []).entries()) {
    await assertManifestFile(dataRoot, route.data, `${label} manifest.tree.routes[${routeIndex}].data`, failures);
  }

  return {
    versionId: version.id,
    dataRoot: version.dataRoot,
    status: failures.length ? 'failed' : 'ok',
    failures
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const failures = [];
  const versions = await readJson(path.join(repoRoot, 'data', 'versions.json'));
  validateVersionShape(versions.current, 'current', failures);
  assert(Array.isArray(versions.history) && versions.history.length > 0, 'history missing or empty', failures);
  assert(versions.sources && typeof versions.sources === 'object', 'sources missing', failures);

  const ids = new Set();
  const duplicateIds = [];
  for (const version of versions.history || []) {
    if (ids.has(version.id)) duplicateIds.push(version.id);
    ids.add(version.id);
  }
  assert(duplicateIds.length === 0, `duplicate history ids: ${duplicateIds.join(', ')}`, failures);
  assert(ids.has(versions.current?.id), 'current id is not present in history', failures);

  if (args.id) {
    const index = (versions.history || []).findIndex((version) => version.id === args.id);
    assert(index >= 0, `history id not found: ${args.id}`, failures);
    const result = index >= 0 ? await validateHistoryEntry(versions.history[index], index) : null;
    const failed = failures.length + (result?.status === 'failed' ? 1 : 0);
    console.log(JSON.stringify({
      mode: 'single-version',
      id: args.id,
      failed,
      topLevelFailures: failures,
      result
    }, null, 2));
    if (failed) process.exit(1);
    return;
  }

  const results = [];
  for (const [index, version] of (versions.history || []).entries()) {
    results.push(await validateHistoryEntry(version, index));
  }

  const failed = results.filter((result) => result.status !== 'ok');
  console.log(JSON.stringify({
    failed: failures.length + failed.length,
    versionCount: results.length,
    topLevelFailures: failures,
    results
  }, null, 2));

  if (failures.length || failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
