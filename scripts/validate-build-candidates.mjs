#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];
const placeholderTerms = [
  '待填写',
  '待填寫',
  'TBD',
  'Template placeholder',
  'Replace placeholders',
  'template',
  '模板占位',
  '說明',
  '说明'
];

function parseArgs(argv) {
  const args = {
    season: 's05',
    file: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-build-candidates.mjs [--season s05]',
    '  node scripts/validate-build-candidates.mjs --season s05 --file builds/candidates.json',
    '',
    'Validates the versioned future-BD candidate backlog. These entries are planning records only; they do not publish a build until scaffolded, completed, validated, and registered in manifest.builds.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function resolveSeasonFile(seasonRoot, file) {
  const absolute = path.resolve(seasonRoot, file);
  if (!absolute.startsWith(seasonRoot + path.sep)) {
    throw new Error(`File must stay inside ${seasonRoot}: ${file}`);
  }
  return absolute;
}

function resolveRepoFile(file) {
  const absolute = path.resolve(repoRoot, file);
  if (!absolute.startsWith(repoRoot + path.sep)) {
    throw new Error(`File must stay inside ${repoRoot}: ${file}`);
  }
  return absolute;
}

function localizedReady(value) {
  return Boolean(value)
    && typeof value === 'object'
    && locales.every((locale) => typeof value[locale] === 'string' && value[locale].trim().length > 0);
}

function validKebabId(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function collectStrings(value, pathLabel = '', rows = []) {
  if (typeof value === 'string') {
    rows.push({ path: pathLabel, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${pathLabel}[${index}]`, rows));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, pathLabel ? `${pathLabel}.${key}` : key, rows);
    }
  }
  return rows;
}

function placeholderHits(value) {
  return collectStrings(value)
    .filter((row) => placeholderTerms.some((term) => row.value.includes(term)))
    .map((row) => row.path);
}

function validateCandidate(candidate, index, registeredIds) {
  const failures = [];
  const prefix = `candidates[${index}]`;
  assert(validKebabId(candidate?.id), `${prefix}.id must be lowercase kebab-case`, failures);
  assert(['planned', 'draft', 'blocked', 'registered'].includes(candidate?.status), `${prefix}.status invalid`, failures);
  assert(Number.isInteger(candidate?.priority) && candidate.priority > 0, `${prefix}.priority must be a positive integer`, failures);
  assert(localizedReady(candidate?.title), `${prefix}.title missing localized zhCN/zhTW/en`, failures);
  assert(localizedReady(candidate?.class?.base), `${prefix}.class.base missing localized zhCN/zhTW/en`, failures);
  assert(localizedReady(candidate?.class?.ascendancy), `${prefix}.class.ascendancy missing localized zhCN/zhTW/en`, failures);
  assert(localizedReady(candidate?.reason), `${prefix}.reason missing localized zhCN/zhTW/en`, failures);
  assert(typeof candidate?.data === 'string' && candidate.data.startsWith('builds/') && candidate.data.endsWith('.json'), `${prefix}.data must point to builds/*.json`, failures);
  assert(typeof candidate?.guide === 'string' && candidate.guide.endsWith('.html'), `${prefix}.guide must point to an html guide page`, failures);
  if (candidate?.routeCandidates !== undefined) {
    assert(Array.isArray(candidate.routeCandidates), `${prefix}.routeCandidates must be an array when provided`, failures);
    const routeStages = new Set();
    for (const [routeIndex, route] of (candidate.routeCandidates || []).entries()) {
      const routePrefix = `${prefix}.routeCandidates[${routeIndex}]`;
      assert(validKebabId(route?.stageId), `${routePrefix}.stageId must be lowercase kebab-case`, failures);
      assert(typeof route?.file === 'string' && route.file.startsWith('tree/') && route.file.endsWith('.candidate.json'), `${routePrefix}.file must point to tree/*.candidate.json`, failures);
      assert(typeof route?.status === 'string' && route.status.trim().length > 0, `${routePrefix}.status missing`, failures);
      if (routeStages.has(route?.stageId)) failures.push(`${routePrefix}.stageId duplicate: ${route.stageId}`);
      routeStages.add(route?.stageId);
    }
  }
  if (registeredIds.has(candidate?.id)) {
    assert(candidate.status === 'registered', `${prefix}.status must be registered when id is already in manifest.builds`, failures);
  } else {
    assert(candidate?.status !== 'registered', `${prefix}.status registered but id is not in manifest.builds`, failures);
  }
  return failures;
}

async function validateBuildCandidates(args) {
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const relativeFile = args.file || manifest.buildCandidates || 'builds/candidates.json';
  const file = resolveSeasonFile(seasonRoot, relativeFile);
  const data = await readJson(file);
  const failures = [];
  const registeredIds = new Set((manifest.builds || []).map((entry) => entry.id));

  assert(data?.schemaVersion === 1, 'schemaVersion must be 1', failures);
  assert(data?.source && typeof data.source === 'object', 'source missing', failures);
  assert(typeof data?.source?.type === 'string' && data.source.type.trim().length > 0, 'source.type missing', failures);
  assert(typeof data?.source?.updatedAt === 'string' && data.source.updatedAt.trim().length > 0, 'source.updatedAt missing', failures);
  assert(Array.isArray(data?.candidates), 'candidates must be an array', failures);

  const ids = new Set();
  const draftDetails = [];
  for (const [index, candidate] of (data.candidates || []).entries()) {
    if (ids.has(candidate.id)) failures.push(`candidates[${index}] duplicate id: ${candidate.id}`);
    ids.add(candidate.id);
    failures.push(...validateCandidate(candidate, index, registeredIds));
    if (
      candidate.status === 'draft'
      && typeof candidate.data === 'string'
      && candidate.data.startsWith('builds/')
      && candidate.data.endsWith('.json')
    ) {
      const draftFile = resolveSeasonFile(seasonRoot, candidate.data || '');
      if (!await exists(draftFile)) {
        failures.push(`candidates[${index}].status draft requires existing data file: ${candidate.data}`);
      } else {
        const draftData = await readJson(draftFile);
        const placeholders = placeholderHits(draftData);
        const guideFile = resolveRepoFile(path.relative(repoRoot, path.resolve(seasonRoot, candidate.guide || '')));
        const guideExists = await exists(guideFile);
        if (!guideExists) failures.push(`candidates[${index}].status draft requires existing guide page: ${candidate.guide}`);
        for (const [routeIndex, route] of (candidate.routeCandidates || []).entries()) {
          const routeFile = resolveSeasonFile(seasonRoot, route.file || '');
          if (!await exists(routeFile)) {
            failures.push(`candidates[${index}].routeCandidates[${routeIndex}].file missing: ${route.file}`);
          }
        }
        draftDetails.push({
          id: candidate.id,
          file: candidate.data,
          guide: candidate.guide,
          guideExists,
          placeholderCount: placeholders.length,
          placeholderPaths: placeholders.slice(0, 12)
        });
      }
    }
  }

  const registeredCount = (data.candidates || []).filter((candidate) => registeredIds.has(candidate.id)).length;
  const available = (data.candidates || []).filter((candidate) => !registeredIds.has(candidate.id));
  const statusCounts = (data.candidates || []).reduce((acc, candidate) => {
    const status = candidate.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    season: args.season,
    file: path.relative(repoRoot, file),
    status: failures.length ? 'failed' : 'ok',
    schemaVersion: data?.schemaVersion || 0,
    sourceType: data?.source?.type || '',
    candidateCount: data?.candidates?.length || 0,
    availableCount: available.length,
    registeredCount,
    candidateIds: (data?.candidates || []).map((candidate) => candidate.id),
    availableIds: available.map((candidate) => candidate.id),
    statusCounts,
    draftDetails,
    failures
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await validateBuildCandidates(args);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ok') process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
