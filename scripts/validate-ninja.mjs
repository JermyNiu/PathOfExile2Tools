#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedParserHints = new Set([
  'pob-skill-groups',
  'pob-compressed-code',
  'pob-xml',
  'text-passive-patterns',
  'gear-container'
]);

function parseArgs(argv) {
  const args = { season: 's05', file: null, key: null, examples: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--key') args.key = argv[++i];
    else if (arg === '--examples') args.examples = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-ninja.mjs [--season s05]',
    '  node scripts/validate-ninja.mjs [--season s05] --examples',
    '  node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json [--key example]',
    '',
    'Checks ninja import JSON files registered in data/seasons/<season>/manifest.json.',
    'Use --examples to also validate JSON fixtures under ninja/examples/.',
    'Use --file to validate one exported parser result before registering it in the manifest.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateNamedArray(value, label, failures) {
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (!Array.isArray(value)) return;
  for (const [index, entry] of value.entries()) {
    assert(typeof entry.name === 'string' && entry.name.trim().length > 0, `${label}[${index}] missing name`, failures);
    assert(typeof entry.context === 'string', `${label}[${index}] missing context`, failures);
  }
}

function validateImport(data, file) {
  const failures = [];
  assert(data.parserVersion === 'local-ninja-import-v1', `${file} unsupported parserVersion`, failures);
  assert(data.schemaVersion === 1, `${file} unsupported schemaVersion`, failures);
  assert(typeof data.parsedAt === 'string' && data.parsedAt.trim().length > 0, `${file} missing parsedAt`, failures);
  assert(['json', 'base64-json', 'pob-code', 'pob-xml', 'text', 'none'].includes(data.format), `${file} invalid format`, failures);
  assert(typeof data.selectedToolVersion === 'string' && data.selectedToolVersion.trim().length > 0, `${file} missing selectedToolVersion`, failures);
  assert(typeof data.assignedVersion === 'string' && data.assignedVersion.trim().length > 0, `${file} missing assignedVersion`, failures);
  assert(['export', 'selected-tool-version'].includes(data.versionSource), `${file} invalid versionSource`, failures);
  validateVersionCompatibility(data.versionCompatibility, `${file}.versionCompatibility`, failures);
  assert(data.character && typeof data.character === 'object', `${file} missing character`, failures);
  assert(data.counts && typeof data.counts === 'object', `${file} missing counts`, failures);
  validateNamedArray(data.skills, `${file}.skills`, failures);
  validateNamedArray(data.supports, `${file}.supports`, failures);
  validateNamedArray(data.items, `${file}.items`, failures);
  assert(Array.isArray(data.passiveIds), `${file}.passiveIds should be an array`, failures);
  if (Array.isArray(data.passiveIds)) {
    assert(data.passiveIds.every((id) => Number.isInteger(id)), `${file}.passiveIds contains invalid id`, failures);
  }
  assert(data.counts?.skills === data.skills?.length, `${file} skill count mismatch`, failures);
  assert(data.counts?.supports === data.supports?.length, `${file} support count mismatch`, failures);
  assert(data.counts?.items === data.items?.length, `${file} item count mismatch`, failures);
  assert(data.counts?.passives === data.passiveIds?.length, `${file} passive count mismatch`, failures);
  if (data.sourceEvidence !== undefined && data.sourceEvidence !== null) {
    validateSourceEvidence(data.sourceEvidence, `${file}.sourceEvidence`, failures);
  }
  validateFormatProfile(data.formatProfile, `${file}.formatProfile`, failures);
  if (data.analysis !== undefined && data.analysis !== null) {
    validateAnalysis(data.analysis, `${file}.analysis`, failures);
  }
  return failures;
}

function validateOptionalString(value, label, failures) {
  if (value === undefined || value === null) return;
  assert(typeof value === 'string', `${label} should be string or null`, failures);
}

function validateVersionCompatibility(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  if (!value || typeof value !== 'object') return;
  assert(['matched', 'needs-review', 'source-version-unknown'].includes(value.status), `${label}.status invalid`, failures);
  assert(typeof value.selectedToolVersion === 'string' && value.selectedToolVersion.trim().length > 0, `${label}.selectedToolVersion missing`, failures);
  assert(typeof value.comparedVersion === 'string' && value.comparedVersion.trim().length > 0, `${label}.comparedVersion missing`, failures);
  validateOptionalString(value.selectedSeason, `${label}.selectedSeason`, failures);
  validateOptionalString(value.selectedPoe2dbVersion, `${label}.selectedPoe2dbVersion`, failures);
  validateOptionalString(value.selectedDataRoot, `${label}.selectedDataRoot`, failures);
  validateOptionalString(value.explicitVersion, `${label}.explicitVersion`, failures);
  validateOptionalString(value.explicitVersionPath, `${label}.explicitVersionPath`, failures);
  validateOptionalString(value.exportSeason, `${label}.exportSeason`, failures);
  validateOptionalString(value.exportSeasonPath, `${label}.exportSeasonPath`, failures);
  validateOptionalString(value.exportPoe2dbVersion, `${label}.exportPoe2dbVersion`, failures);
  validateOptionalString(value.exportPoe2dbVersionPath, `${label}.exportPoe2dbVersionPath`, failures);
  assert(Array.isArray(value.warnings), `${label}.warnings should be an array`, failures);
  if (Array.isArray(value.warnings)) {
    for (const [index, warning] of value.warnings.entries()) {
      assert(typeof warning === 'string' && warning.trim().length > 0, `${label}.warnings[${index}] invalid`, failures);
    }
    assert(value.status === 'matched' ? value.warnings.length === 0 : value.warnings.length > 0, `${label}.warnings do not match status`, failures);
  }
}

function validateSourceEvidence(sourceEvidence, label, failures) {
  assert(sourceEvidence && typeof sourceEvidence === 'object', `${label} missing object`, failures);
  for (const key of ['skills', 'supports', 'items', 'passives']) {
    assert(typeof sourceEvidence?.[key] === 'string' && sourceEvidence[key].trim().length > 0, `${label}.${key} missing`, failures);
  }
  assert(Number.isInteger(sourceEvidence?.skillGroupsDetected) && sourceEvidence.skillGroupsDetected >= 0, `${label}.skillGroupsDetected invalid`, failures);
  validateParserHints(sourceEvidence?.parserHints, `${label}.parserHints`, failures);
}

function validateFormatProfile(formatProfile, label, failures) {
  assert(formatProfile && typeof formatProfile === 'object', `${label} missing object`, failures);
  if (!formatProfile || typeof formatProfile !== 'object') return;
  assert(['json', 'base64-json', 'pob-code', 'pob-xml', 'text', 'none'].includes(formatProfile.inputFormat), `${label}.inputFormat invalid`, failures);
  assert(Array.isArray(formatProfile.topLevelKeys), `${label}.topLevelKeys should be an array`, failures);
  if (Array.isArray(formatProfile.topLevelKeys)) {
    formatProfile.topLevelKeys.forEach((key, index) => {
      assert(typeof key === 'string' && key.trim().length > 0, `${label}.topLevelKeys[${index}] invalid`, failures);
    });
  }
  validateOptionalString(formatProfile.explicitVersionPath, `${label}.explicitVersionPath`, failures);
  validateOptionalString(formatProfile.characterPath, `${label}.characterPath`, failures);
  validateOptionalString(formatProfile.skillGroupPath, `${label}.skillGroupPath`, failures);
  validateOptionalString(formatProfile.skillSourcePath, `${label}.skillSourcePath`, failures);
  validateOptionalString(formatProfile.supportSourcePath, `${label}.supportSourcePath`, failures);
  validateOptionalString(formatProfile.itemSourcePath, `${label}.itemSourcePath`, failures);
  validateOptionalString(formatProfile.passiveSourcePath, `${label}.passiveSourcePath`, failures);
  assert(Number.isInteger(formatProfile.skillGroupCount) && formatProfile.skillGroupCount >= 0, `${label}.skillGroupCount invalid`, failures);
  assert(formatProfile.recognizedCounts && typeof formatProfile.recognizedCounts === 'object', `${label}.recognizedCounts missing`, failures);
  for (const key of ['skills', 'supports', 'items', 'passives']) {
    assert(Number.isInteger(formatProfile.recognizedCounts?.[key]) && formatProfile.recognizedCounts[key] >= 0, `${label}.recognizedCounts.${key} invalid`, failures);
  }
  validateParserHints(formatProfile.parserHints, `${label}.parserHints`, failures);
  validateStringArray(formatProfile.risks, `${label}.risks`, failures);
}

function validateParserHints(value, label, failures) {
  validateStringArray(value, label, failures);
  if (!Array.isArray(value)) return;
  for (const [index, hint] of value.entries()) {
    assert(allowedParserHints.has(hint), `${label}[${index}] unknown parser hint: ${hint}`, failures);
  }
}

function validateRatio(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  assert(Number.isInteger(value?.matched) && value.matched >= 0, `${label}.matched invalid`, failures);
  assert(Number.isInteger(value?.expected) && value.expected >= 0, `${label}.expected invalid`, failures);
  assert(value?.matched <= value?.expected, `${label}.matched exceeds expected`, failures);
}

function validateImportedCatalogRatio(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  assert(Number.isInteger(value?.matched) && value.matched >= 0, `${label}.matched invalid`, failures);
  assert(Number.isInteger(value?.imported) && value.imported >= 0, `${label}.imported invalid`, failures);
  assert(value?.matched <= value?.imported, `${label}.matched exceeds imported`, failures);
  assert(Array.isArray(value?.unknown), `${label}.unknown should be an array`, failures);
  if (Array.isArray(value?.unknown)) {
    for (const [index, name] of value.unknown.entries()) {
      assert(typeof name === 'string' && name.trim().length > 0, `${label}.unknown[${index}] should be non-empty string`, failures);
    }
  }
}

function validateCatalogAnalysis(catalog, label, failures) {
  assert(catalog && typeof catalog === 'object', `${label} missing object`, failures);
  assert(typeof catalog.sourceType === 'string' && catalog.sourceType.trim().length > 0, `${label}.sourceType missing`, failures);
  validateImportedCatalogRatio(catalog.skills, `${label}.skills`, failures);
  validateImportedCatalogRatio(catalog.supports, `${label}.supports`, failures);
  assert(Number.isInteger(catalog.pendingVerification) && catalog.pendingVerification >= 0, `${label}.pendingVerification invalid`, failures);
  const matchedTotal = (catalog.skills?.matched || 0) + (catalog.supports?.matched || 0);
  assert(catalog.pendingVerification <= matchedTotal, `${label}.pendingVerification exceeds matched catalog entries`, failures);
}

function validateStringArray(value, label, failures) {
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (!Array.isArray(value)) return;
  for (const [index, item] of value.entries()) {
    assert(typeof item === 'string' && item.trim().length > 0, `${label}[${index}] should be non-empty string`, failures);
  }
}

function validateGearAnalysis(gear, label, failures) {
  assert(gear && typeof gear === 'object', `${label} missing object`, failures);
  validateRatio(gear, label, failures);
  validateStringArray(gear.matchedCategories, `${label}.matchedCategories`, failures);
  validateStringArray(gear.missingCategories, `${label}.missingCategories`, failures);
  validateStringArray(gear.detectedCategories, `${label}.detectedCategories`, failures);
  validateStringArray(gear.riskItems, `${label}.riskItems`, failures);
  assert(gear.matchedCategories?.length === gear.matched, `${label}.matchedCategories count mismatch`, failures);
  assert(gear.missingCategories?.length + gear.matched === gear.expected, `${label}.missingCategories count mismatch`, failures);
  if (gear.stageReadiness !== undefined && gear.stageReadiness !== null) {
    validateGearStageReadiness(gear.stageReadiness, `${label}.stageReadiness`, failures);
  }
}

function validateGearStageReadiness(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  assert(Array.isArray(value.stages), `${label}.stages should be an array`, failures);
  assert(Number.isInteger(value.stageCount) && value.stageCount >= 0, `${label}.stageCount invalid`, failures);
  assert(Number.isInteger(value.rowCount) && value.rowCount >= 0, `${label}.rowCount invalid`, failures);
  assert(Number.isInteger(value.passed) && value.passed >= 0, `${label}.passed invalid`, failures);
  assert(Number.isInteger(value.weak) && value.weak >= 0, `${label}.weak invalid`, failures);
  assert(Number.isInteger(value.missing) && value.missing >= 0, `${label}.missing invalid`, failures);
  assert(typeof value.bestStageId === 'string', `${label}.bestStageId should be string`, failures);
  assert(typeof value.bestStageTitle === 'string', `${label}.bestStageTitle should be string`, failures);
  assert(Number.isInteger(value.bestStageScore) && value.bestStageScore >= 0, `${label}.bestStageScore invalid`, failures);
  assert(typeof value.sourceStatus === 'string', `${label}.sourceStatus should be string`, failures);
  if (!Array.isArray(value.stages)) return;
  assert(value.stages.length === value.stageCount, `${label}.stageCount mismatch`, failures);
  const rows = value.stages.flatMap((stage) => stage.rows || []);
  assert(rows.length === value.rowCount, `${label}.rowCount mismatch`, failures);
  assert(rows.filter((row) => row.status === 'passed').length === value.passed, `${label}.passed mismatch`, failures);
  assert(rows.filter((row) => row.status === 'weak').length === value.weak, `${label}.weak mismatch`, failures);
  assert(rows.filter((row) => row.status === 'missing').length === value.missing, `${label}.missing mismatch`, failures);
  for (const [index, stage] of value.stages.entries()) {
    const stageLabel = `${label}.stages[${index}]`;
    assert(typeof stage.stageId === 'string' && stage.stageId.trim().length > 0, `${stageLabel}.stageId missing`, failures);
    assert(typeof stage.title === 'string' && stage.title.trim().length > 0, `${stageLabel}.title missing`, failures);
    assert(typeof stage.sourceStatus === 'string' && stage.sourceStatus.trim().length > 0, `${stageLabel}.sourceStatus missing`, failures);
    assert(Array.isArray(stage.rows), `${stageLabel}.rows should be an array`, failures);
    assert(Number.isInteger(stage.rowCount) && stage.rowCount >= 0, `${stageLabel}.rowCount invalid`, failures);
    assert(Number.isInteger(stage.passed) && stage.passed >= 0, `${stageLabel}.passed invalid`, failures);
    assert(Number.isInteger(stage.weak) && stage.weak >= 0, `${stageLabel}.weak invalid`, failures);
    assert(Number.isInteger(stage.missing) && stage.missing >= 0, `${stageLabel}.missing invalid`, failures);
    assert(Number.isInteger(stage.score) && stage.score >= 0, `${stageLabel}.score invalid`, failures);
    for (const [rowIndex, row] of (stage.rows || []).entries()) {
      const rowLabel = `${stageLabel}.rows[${rowIndex}]`;
      assert(typeof row.stat === 'string' && row.stat.trim().length > 0, `${rowLabel}.stat missing`, failures);
      assert(['passed', 'weak', 'missing'].includes(row.status), `${rowLabel}.status invalid`, failures);
      assert(typeof row.minimum === 'string' && row.minimum.trim().length > 0, `${rowLabel}.minimum missing`, failures);
      assert(typeof row.upgradeTarget === 'string' && row.upgradeTarget.trim().length > 0, `${rowLabel}.upgradeTarget missing`, failures);
      assert(Number.isInteger(row.priority) && row.priority > 0, `${rowLabel}.priority invalid`, failures);
      assert(typeof row.reason === 'string' && row.reason.trim().length > 0, `${rowLabel}.reason missing`, failures);
      assert(typeof row.source === 'string' && row.source.trim().length > 0, `${rowLabel}.source missing`, failures);
    }
  }
}

function validateOptionalIdArray(value, label, failures) {
  if (value === undefined) return;
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (Array.isArray(value)) {
    assert(value.every((id) => Number.isInteger(id) && id > 0), `${label} contains invalid id`, failures);
  }
}

function validateLocalizedObject(value, label, failures) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} should be localized object`, failures);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of ['zhCN', 'zhTW', 'en']) {
    assert(typeof value[key] === 'string' && value[key].trim().length > 0, `${label}.${key} missing`, failures);
  }
}

function validateLocalizedArray(value, label, failures) {
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (!Array.isArray(value)) return;
  for (const [index, item] of value.entries()) {
    validateLocalizedObject(item, `${label}[${index}]`, failures);
  }
}

function validateDecisionRow(row, label, failures) {
  assert(typeof row.id === 'string' && row.id.trim().length > 0, `${label}.id missing`, failures);
  validateLocalizedObject(row.title, `${label}.title`, failures);
  validateRatio({ matched: row.skillMatched, expected: row.skillExpected }, `${label}.skill`, failures);
  validateRatio({ matched: row.firstSupportMatched, expected: row.firstSupportExpected }, `${label}.firstSupport`, failures);
  validateRatio({ matched: row.laterSupportMatched, expected: row.laterSupportExpected }, `${label}.laterSupport`, failures);
  assert(Number.isInteger(row.globalFirstSupportMatched) && row.globalFirstSupportMatched >= 0, `${label}.globalFirstSupportMatched invalid`, failures);
  assert(Number.isInteger(row.globalLaterSupportMatched) && row.globalLaterSupportMatched >= 0, `${label}.globalLaterSupportMatched invalid`, failures);
  assert(Number.isInteger(row.contextualSupportCount) && row.contextualSupportCount >= 0, `${label}.contextualSupportCount invalid`, failures);
  assert(typeof row.hasContextualSupports === 'boolean', `${label}.hasContextualSupports invalid`, failures);
  validateLocalizedArray(row.missingSkills, `${label}.missingSkills`, failures);
  validateLocalizedArray(row.missingFirstSupports, `${label}.missingFirstSupports`, failures);
  validateLocalizedArray(row.missingLaterSupports, `${label}.missingLaterSupports`, failures);
  validateLocalizedObject(row.reviewNote, `${label}.reviewNote`, failures);
}

function validateSupportDecisionAnalysis(supportDecision, label, failures) {
  assert(supportDecision && typeof supportDecision === 'object', `${label} missing object`, failures);
  assert(Array.isArray(supportDecision?.rows), `${label}.rows should be an array`, failures);
  if (!Array.isArray(supportDecision?.rows)) return;
  for (const [index, row] of supportDecision.rows.entries()) {
    validateDecisionRow(row, `${label}.rows[${index}]`, failures);
  }
  const rowCount = supportDecision.rows.length;
  const skillMatched = supportDecision.rows.reduce((sum, row) => sum + (row.skillMatched || 0), 0);
  const skillExpected = supportDecision.rows.reduce((sum, row) => sum + (row.skillExpected || 0), 0);
  const firstSupportMatched = supportDecision.rows.reduce((sum, row) => sum + (row.firstSupportMatched || 0), 0);
  const firstSupportExpected = supportDecision.rows.reduce((sum, row) => sum + (row.firstSupportExpected || 0), 0);
  const globalFirstSupportMatched = supportDecision.rows.reduce((sum, row) => sum + (row.globalFirstSupportMatched || 0), 0);
  const contextualRows = supportDecision.rows.filter((row) => row.hasContextualSupports).length;
  assert(supportDecision.rowCount === rowCount, `${label}.rowCount mismatch`, failures);
  assert(supportDecision.skillMatched === skillMatched, `${label}.skillMatched mismatch`, failures);
  assert(supportDecision.skillExpected === skillExpected, `${label}.skillExpected mismatch`, failures);
  assert(supportDecision.firstSupportMatched === firstSupportMatched, `${label}.firstSupportMatched mismatch`, failures);
  assert(supportDecision.firstSupportExpected === firstSupportExpected, `${label}.firstSupportExpected mismatch`, failures);
  assert(supportDecision.globalFirstSupportMatched === globalFirstSupportMatched, `${label}.globalFirstSupportMatched mismatch`, failures);
  assert(supportDecision.contextualRows === contextualRows, `${label}.contextualRows mismatch`, failures);
}

function validatePassiveStageReadiness(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  assert(Array.isArray(value.stages), `${label}.stages should be an array`, failures);
  assert(Number.isInteger(value.stageCount) && value.stageCount >= 0, `${label}.stageCount invalid`, failures);
  validateRatio({ matched: value.matched, expected: value.expected }, label, failures);
  assert(Number.isInteger(value.missing) && value.missing >= 0, `${label}.missing invalid`, failures);
  assert(typeof value.bestStageId === 'string', `${label}.bestStageId should be string`, failures);
  assert(typeof value.bestStageTitle === 'string', `${label}.bestStageTitle should be string`, failures);
  assert(Number.isInteger(value.bestStageScore) && value.bestStageScore >= 0, `${label}.bestStageScore invalid`, failures);
  assert(typeof value.sourceStatus === 'string' && value.sourceStatus.trim().length > 0, `${label}.sourceStatus missing`, failures);
  if (!Array.isArray(value.stages)) return;
  assert(value.stages.length === value.stageCount, `${label}.stageCount mismatch`, failures);
  assert(value.stages.reduce((sum, stage) => sum + (stage.matched || 0), 0) === value.matched, `${label}.matched mismatch`, failures);
  assert(value.stages.reduce((sum, stage) => sum + (stage.expected || 0), 0) === value.expected, `${label}.expected mismatch`, failures);
  assert(value.stages.reduce((sum, stage) => sum + (stage.missing || 0), 0) === value.missing, `${label}.missing mismatch`, failures);
  for (const [index, stage] of value.stages.entries()) {
    const stageLabel = `${label}.stages[${index}]`;
    assert(typeof stage.stageId === 'string' && stage.stageId.trim().length > 0, `${stageLabel}.stageId missing`, failures);
    assert(typeof stage.treeStage === 'string' && stage.treeStage.trim().length > 0, `${stageLabel}.treeStage missing`, failures);
    assert(typeof stage.title === 'string' && stage.title.trim().length > 0, `${stageLabel}.title missing`, failures);
    assert(typeof stage.origin === 'string', `${stageLabel}.origin should be string`, failures);
    assert(typeof stage.handTuned === 'boolean', `${stageLabel}.handTuned invalid`, failures);
    validateRatio(stage, stageLabel, failures);
    assert(Number.isInteger(stage.missing) && stage.missing >= 0, `${stageLabel}.missing invalid`, failures);
    assert(stage.matched + stage.missing === stage.expected, `${stageLabel}.matched/missing do not add to expected`, failures);
    validateOptionalIdArray(stage.matchedIds, `${stageLabel}.matchedIds`, failures);
    validateOptionalIdArray(stage.missingIds, `${stageLabel}.missingIds`, failures);
    assert(Number.isInteger(stage.score) && stage.score >= 0, `${stageLabel}.score invalid`, failures);
    assert(typeof stage.source === 'string' && stage.source.trim().length > 0, `${stageLabel}.source missing`, failures);
  }
}

function validateProgressionAnalysis(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing object`, failures);
  assert(typeof value.sourceStatus === 'string' && value.sourceStatus.trim().length > 0, `${label}.sourceStatus missing`, failures);
  assert(typeof value.passiveBestStageId === 'string', `${label}.passiveBestStageId should be string`, failures);
  assert(typeof value.passiveBestStageTitle === 'string', `${label}.passiveBestStageTitle should be string`, failures);
  assert(Number.isInteger(value.passiveBestStageScore) && value.passiveBestStageScore >= 0, `${label}.passiveBestStageScore invalid`, failures);
  assert(typeof value.gearBestStageId === 'string', `${label}.gearBestStageId should be string`, failures);
  assert(typeof value.gearBestStageTitle === 'string', `${label}.gearBestStageTitle should be string`, failures);
  assert(Number.isInteger(value.gearBestStageScore) && value.gearBestStageScore >= 0, `${label}.gearBestStageScore invalid`, failures);
  assert(['passives', 'gear'].includes(value.bottleneck), `${label}.bottleneck invalid`, failures);
  assert(typeof value.reviewStageId === 'string', `${label}.reviewStageId should be string`, failures);
  assert(typeof value.reviewStageTitle === 'string', `${label}.reviewStageTitle should be string`, failures);
  assert(typeof value.note === 'string' && value.note.trim().length > 0, `${label}.note missing`, failures);
}

function validateAnalysis(analysis, label, failures) {
  assert(typeof analysis.comparedBuildId === 'string' && analysis.comparedBuildId.trim().length > 0, `${label} missing comparedBuildId`, failures);
  assert(analysis.comparedBuildTitle && typeof analysis.comparedBuildTitle === 'object', `${label} missing comparedBuildTitle`, failures);
  validateRatio(analysis.skills, `${label}.skills`, failures);
  validateRatio(analysis.supports, `${label}.supports`, failures);
  validateRatio(analysis.items, `${label}.items`, failures);
  validateRatio(analysis.passives, `${label}.passives`, failures);
  assert(Array.isArray(analysis.skills?.missing), `${label}.skills.missing should be an array`, failures);
  assert(Array.isArray(analysis.supports?.missing), `${label}.supports.missing should be an array`, failures);
  assert(Array.isArray(analysis.items?.missing), `${label}.items.missing should be an array`, failures);
  validateOptionalIdArray(analysis.passives?.matchedIds, `${label}.passives.matchedIds`, failures);
  validateOptionalIdArray(analysis.passives?.missingIds, `${label}.passives.missingIds`, failures);
  if (analysis.catalog !== undefined && analysis.catalog !== null) {
    validateCatalogAnalysis(analysis.catalog, `${label}.catalog`, failures);
  }
  if (analysis.gear !== undefined && analysis.gear !== null) {
    validateGearAnalysis(analysis.gear, `${label}.gear`, failures);
  }
  if (analysis.supportDecision !== undefined && analysis.supportDecision !== null) {
    validateSupportDecisionAnalysis(analysis.supportDecision, `${label}.supportDecision`, failures);
  }
  if (analysis.passiveStages !== undefined && analysis.passiveStages !== null) {
    validatePassiveStageReadiness(analysis.passiveStages, `${label}.passiveStages`, failures);
  }
  if (analysis.progression !== undefined && analysis.progression !== null) {
    validateProgressionAnalysis(analysis.progression, `${label}.progression`, failures);
  }
  if (Array.isArray(analysis.passives?.matchedIds) && Array.isArray(analysis.passives?.missingIds)) {
    assert(analysis.passives.matchedIds.length === analysis.passives.matched, `${label}.passives.matchedIds count mismatch`, failures);
    assert(analysis.passives.matchedIds.length + analysis.passives.missingIds.length === analysis.passives.expected, `${label}.passives ids do not add up to expected`, failures);
  }
}

function resolveNinjaFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

async function validateNinjaFile(seasonRoot, key, file) {
  if (!file) return { key, file, status: 'skipped', failures: [] };
  let data;
  try {
    data = await readJson(resolveNinjaFile(seasonRoot, file));
  } catch (error) {
    return { key, file, status: 'failed', failures: [`Cannot read ninja JSON: ${error.message}`] };
  }
  const failures = validateImport(data, file);
  return {
    key,
    file,
    status: failures.length ? 'failed' : 'ok',
    parserVersion: data.parserVersion,
    schemaVersion: data.schemaVersion,
    failures
  };
}

async function listExampleFiles(seasonRoot) {
  const examplesRoot = path.join(seasonRoot, 'ninja', 'examples');
  let entries = [];
  try {
    entries = await readdir(examplesRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.posix.join('ninja', 'examples', entry.name))
    .sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);

  if (args.file) {
    const result = await validateNinjaFile(seasonRoot, args.key || 'candidate', args.file);
    console.log(JSON.stringify({
      season: args.season,
      mode: 'single-file',
      failed: result.status === 'failed' ? 1 : 0,
      result
    }, null, 2));
    if (result.status === 'failed') process.exit(1);
    return;
  }

  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const results = [];
  for (const [key, file] of Object.entries(manifest.ninja || {})) {
    results.push(await validateNinjaFile(seasonRoot, key, file));
  }
  const exampleResults = [];
  if (args.examples) {
    for (const file of await listExampleFiles(seasonRoot)) {
      exampleResults.push(await validateNinjaFile(seasonRoot, path.basename(file, '.json'), file));
    }
  }

  const failed = [...results, ...exampleResults].filter((result) => result.status === 'failed');
  console.log(JSON.stringify({
    season: args.season,
    ninjaCount: results.length,
    exampleCount: exampleResults.length,
    failed: failed.length,
    results,
    examples: exampleResults
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
