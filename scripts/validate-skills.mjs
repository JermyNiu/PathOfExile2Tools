#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];
const sourceTypes = ['manual-seed-needs-poe2db', 'poe2db-snapshot-v1'];
const verificationStatuses = ['needs-poe2db-verification', 'verified'];

function parseArgs(argv) {
  const args = { season: 's05', file: null };
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
    '  node scripts/validate-skills.mjs [--season s05]',
    '  node scripts/validate-skills.mjs --season s05 --file skills/catalog.json',
    '',
    'Checks the versioned skill/support catalog and build guide references.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateLocalizedText(value, label, failures) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} missing localized object`, failures);
  for (const locale of locales) {
    assert(typeof value?.[locale] === 'string' && value[locale].trim().length > 0, `${label} missing ${locale}`, failures);
  }
}

function validateStringArray(value, label, failures, { allowEmpty = false } = {}) {
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (!allowEmpty) assert(value?.length > 0, `${label} should not be empty`, failures);
  for (const [index, item] of (value || []).entries()) {
    assert(typeof item === 'string' && item.trim().length > 0, `${label}[${index}] should be non-empty string`, failures);
  }
}

function resolveCatalogFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function validateAcquisition(acquisition, label, failures) {
  if (acquisition == null) return;
  assert(typeof acquisition === 'object' && !Array.isArray(acquisition), `${label} should be object`, failures);
  if (acquisition.act != null) assert(typeof acquisition.act === 'string' && acquisition.act.trim().length > 0, `${label}.act should be string or null`, failures);
  if (acquisition.level != null) assert(Number.isInteger(acquisition.level) && acquisition.level > 0, `${label}.level should be positive integer or null`, failures);
  if (acquisition.sourceRef != null) assert(typeof acquisition.sourceRef === 'string' && acquisition.sourceRef.trim().length > 0, `${label}.sourceRef should be string or null`, failures);
}

function validateSupportRequirements(requirements, label, failures) {
  if (requirements == null) return;
  assert(typeof requirements === 'object' && !Array.isArray(requirements), `${label} should be object`, failures);
  if (requirements.requiresTags) validateStringArray(requirements.requiresTags, `${label}.requiresTags`, failures);
  if (requirements.damageTypes) validateStringArray(requirements.damageTypes, `${label}.damageTypes`, failures);
  if (requirements.notes) validateStringArray(requirements.notes, `${label}.notes`, failures);
  if (requirements.requiresHit != null) assert(typeof requirements.requiresHit === 'boolean', `${label}.requiresHit should be boolean`, failures);
  if (requirements.sourceRef != null) assert(typeof requirements.sourceRef === 'string' && requirements.sourceRef.trim().length > 0, `${label}.sourceRef should be string`, failures);
}

function validatePoe2dbMeta(meta, label, failures) {
  if (meta == null) return;
  assert(typeof meta === 'object' && !Array.isArray(meta), `${label} should be object`, failures);
  assert(typeof meta.href === 'string' && meta.href.trim().length > 0, `${label}.href missing`, failures);
  assert(Number.isInteger(meta.gemTier) && meta.gemTier > 0, `${label}.gemTier should be positive integer`, failures);
  if (meta.detail != null) validatePoe2dbDetail(meta.detail, `${label}.detail`, failures);
}

function validateGemRows(value, label, failures) {
  if (value == null) return;
  assert(Array.isArray(value), `${label} should be array`, failures);
  for (const [index, row] of (value || []).entries()) {
    assert(row && typeof row === 'object' && !Array.isArray(row), `${label}[${index}] should be object`, failures);
    if (row.tier != null) assert(Number.isInteger(row.tier) && row.tier > 0, `${label}[${index}].tier should be positive integer or null`, failures);
    assert(Array.isArray(row.gems) && row.gems.length > 0, `${label}[${index}].gems should not be empty`, failures);
    for (const [gemIndex, gem] of (row.gems || []).entries()) {
      assert(typeof gem?.name === 'string' && gem.name.trim().length > 0, `${label}[${index}].gems[${gemIndex}].name missing`, failures);
      assert(typeof gem?.href === 'string' && gem.href.trim().length > 0, `${label}[${index}].gems[${gemIndex}].href missing`, failures);
    }
  }
}

function validateNumberRange(value, label, failures) {
  if (value == null) return;
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} should be object`, failures);
  assert(Number.isInteger(value.min) && value.min >= 0, `${label}.min should be non-negative integer`, failures);
  assert(Number.isInteger(value.max) && value.max >= value.min, `${label}.max should be integer >= min`, failures);
}

function validatePoe2dbDetail(detail, label, failures) {
  assert(detail && typeof detail === 'object' && !Array.isArray(detail), `${label} should be object`, failures);
  assert(typeof detail.pageFetchedAt === 'string' && detail.pageFetchedAt.trim().length > 0, `${label}.pageFetchedAt missing`, failures);
  assert(typeof detail.sourceRef === 'string' && detail.sourceRef.trim().length > 0, `${label}.sourceRef missing`, failures);
  if (detail.from != null) {
    assert(detail.from && typeof detail.from === 'object' && !Array.isArray(detail.from), `${label}.from should be object`, failures);
    assert(typeof detail.from.text === 'string' && detail.from.text.trim().length > 0, `${label}.from.text missing`, failures);
    if (detail.from.item != null) assert(typeof detail.from.item === 'string' && detail.from.item.trim().length > 0, `${label}.from.item should be string`, failures);
    if (detail.from.href != null) assert(typeof detail.from.href === 'string' && detail.from.href.trim().length > 0, `${label}.from.href should be string`, failures);
    if (detail.from.tier != null) assert(Number.isInteger(detail.from.tier) && detail.from.tier > 0, `${label}.from.tier should be positive integer or null`, failures);
  }
  if (detail.tierText != null) assert(typeof detail.tierText === 'string' && detail.tierText.trim().length > 0, `${label}.tierText should be string`, failures);
  validateNumberRange(detail.levelRange, `${label}.levelRange`, failures);
  validateNumberRange(detail.requiresLevelRange, `${label}.requiresLevelRange`, failures);
  if (detail.requirementsText != null) assert(typeof detail.requirementsText === 'string' && detail.requirementsText.trim().length > 0, `${label}.requirementsText should be string`, failures);
  if (detail.reservation != null) assert(typeof detail.reservation === 'string' && detail.reservation.trim().length > 0, `${label}.reservation should be string`, failures);
  if (detail.category != null) assert(typeof detail.category === 'string' && detail.category.trim().length > 0, `${label}.category should be string`, failures);
  if (detail.description != null) assert(typeof detail.description === 'string' && detail.description.trim().length > 0, `${label}.description should be string`, failures);
  validateGemRows(detail.recommendedSupportRows, `${label}.recommendedSupportRows`, failures);
  validateGemRows(detail.compatibleSkillRows, `${label}.compatibleSkillRows`, failures);
}

function validateCatalog(data, file) {
  const failures = [];
  assert(typeof data.id === 'string' && data.id.trim().length > 0, `${file} missing id`, failures);
  assert(typeof data.season === 'string' && data.season.trim().length > 0, `${file} missing season`, failures);
  assert(typeof data.versionId === 'string' && data.versionId.trim().length > 0, `${file} missing versionId`, failures);
  assert(typeof data.updatedAt === 'string' && data.updatedAt.trim().length > 0, `${file} missing updatedAt`, failures);
  assert(sourceTypes.includes(data.source?.type), `${file} unsupported source.type ${data.source?.type}`, failures);
  assert(typeof data.source?.note === 'string' && data.source.note.trim().length > 0, `${file} missing source.note`, failures);
  assert(Array.isArray(data.entries) && data.entries.length > 0, `${file} entries should not be empty`, failures);

  const seen = new Set();
  const activeIds = new Set();
  const supportIds = new Set();
  for (const [index, entry] of (data.entries || []).entries()) {
    const label = `${file}.entries[${index}]`;
    assert(typeof entry.id === 'string' && entry.id.trim().length > 0, `${label} missing id`, failures);
    assert(!seen.has(entry.id), `${label} duplicate id ${entry.id}`, failures);
    seen.add(entry.id);
    assert(['active', 'support'].includes(entry.kind), `${label} invalid kind ${entry.kind}`, failures);
    if (entry.kind === 'active') activeIds.add(entry.id);
    if (entry.kind === 'support') supportIds.add(entry.id);
    validateLocalizedText(entry.name, `${label}.name`, failures);
    assert(verificationStatuses.includes(entry.verificationStatus), `${label} invalid verificationStatus ${entry.verificationStatus}`, failures);
    validateStringArray(entry.tags, `${label}.tags`, failures);
    validateAcquisition(entry.acquisition, `${label}.acquisition`, failures);
    validateSupportRequirements(entry.supportRequirements, `${label}.supportRequirements`, failures);
    validatePoe2dbMeta(entry.poe2db, `${label}.poe2db`, failures);
    if (data.source?.type === 'manual-seed-needs-poe2db') {
      assert(entry.verificationStatus === 'needs-poe2db-verification', `${label} manual seed entries must stay needs-poe2db-verification`, failures);
      assert(entry.tags.includes('needs-source'), `${label} manual seed entries should include needs-source tag`, failures);
    }
    if (data.source?.type === 'poe2db-snapshot-v1') {
      assert(entry.verificationStatus === 'verified', `${label} PoE2DB snapshot entries must be verified`, failures);
      assert(!entry.tags.includes('needs-source'), `${label} PoE2DB snapshot entries must not include needs-source tag`, failures);
      assert(entry.poe2db && typeof entry.poe2db === 'object', `${label} PoE2DB snapshot entries must include poe2db metadata`, failures);
      if (entry.kind === 'active') {
        assert(typeof entry.acquisition?.sourceRef === 'string' && entry.acquisition.sourceRef.trim().length > 0, `${label} active PoE2DB snapshot entries must include acquisition.sourceRef`, failures);
      }
      if (entry.kind === 'support') {
        assert(typeof entry.supportRequirements?.sourceRef === 'string' && entry.supportRequirements.sourceRef.trim().length > 0, `${label} support PoE2DB snapshot entries must include supportRequirements.sourceRef`, failures);
      }
    }
  }

  return { failures, activeIds, supportIds, entryCount: data.entries?.length || 0 };
}

async function validateBuildReferences(seasonRoot, manifest, catalogIds) {
  const failures = [];
  for (const buildEntry of manifest.builds || []) {
    const build = await readJson(path.join(seasonRoot, buildEntry.data));
    const label = `build:${buildEntry.id}`;
    for (const skill of build.skills?.active || []) {
      assert(catalogIds.activeIds.has(skill.id), `${label} active skill missing in catalog: ${skill.id}`, failures);
    }
    for (const supportId of Object.keys(build.skills?.supports || {})) {
      assert(catalogIds.supportIds.has(supportId), `${label} support missing in catalog: ${supportId}`, failures);
    }
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const catalogFile = args.file || manifest.skills?.catalog;
  if (!catalogFile) throw new Error('manifest.skills.catalog is required');

  const catalogPath = resolveCatalogFile(seasonRoot, catalogFile);
  const catalog = await readJson(catalogPath);
  const catalogResult = validateCatalog(catalog, catalogFile);
  const referenceFailures = args.file ? [] : await validateBuildReferences(seasonRoot, manifest, catalogResult);
  const failures = [...catalogResult.failures, ...referenceFailures];

  console.log(JSON.stringify({
    season: args.season,
    mode: args.file ? 'single-file' : 'manifest',
    file: catalogFile,
    sourceType: catalog.source?.type,
    entries: catalogResult.entryCount,
    activeSkills: catalogResult.activeIds.size,
    supports: catalogResult.supportIds.size,
    buildReferenceChecks: args.file ? 'skipped' : 'checked',
    failed: failures.length,
    failures
  }, null, 2));

  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
