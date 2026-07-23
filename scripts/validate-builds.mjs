#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];

function parseArgs(argv) {
  const args = { season: 's05', file: null, id: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-builds.mjs [--season s05]',
    '  node scripts/validate-builds.mjs --season s05 --id tactician-supporting-fire --file builds/tactician-supporting-fire.json',
    '',
    'Checks build JSON files registered in data/seasons/<season>/manifest.json.',
    'Use --file and --id to validate one candidate build before registering it in the manifest.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateLocalizedText(value, label, failures) {
  assert(value && typeof value === 'object', `${label} missing localized object`, failures);
  for (const locale of locales) {
    assert(typeof value?.[locale] === 'string' && value[locale].trim().length > 0, `${label} missing ${locale}`, failures);
  }
}

function collectStrings(value, pathLabel, rows = []) {
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

function validateTacticianGuideNaming(data, label, failures) {
  if (label !== 'tactician-supporting-fire') return;

  const bannedTitleTerms = {
    zhCN: '召唤流',
    zhTW: '召喚流',
    en: 'Supporting Fire Minions'
  };
  for (const [locale, term] of Object.entries(bannedTitleTerms)) {
    assert(!data.title?.[locale]?.includes(term), `${label}.title.${locale} should avoid misleading pure-minion naming: ${term}`, failures);
  }

  const bannedGuideTerms = [
    '最终召唤流',
    '最终是召唤流',
    '最终 BD 是召唤流',
    '最終召喚流',
    '最終是召喚流',
    '最終 BD 是召喚流',
    '召唤流死亡',
    '召喚流死亡'
  ];
  for (const row of collectStrings(data, label)) {
    for (const term of bannedGuideTerms) {
      assert(!row.value.includes(term), `${row.path} should avoid misleading pure-minion wording: ${term}`, failures);
    }
  }
}

function validateStringArray(value, label, failures) {
  assert(Array.isArray(value), `${label} should be an array`, failures);
  if (Array.isArray(value)) {
    assert(value.every((item) => typeof item === 'string' && item.trim().length > 0), `${label} contains invalid item`, failures);
  }
}

function validateLocalizedStringArray(value, label, failures) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} missing localized array object`, failures);
  for (const locale of locales) {
    validateStringArray(value?.[locale], `${label}.${locale}`, failures);
  }
}

function validateBuildData(buildEntry, data, manifestRoutes) {
  const failures = [];
  const label = buildEntry.id;
  assert(data.id === buildEntry.id, `${label} id mismatch`, failures);
  assert(typeof data.season === 'string' && data.season.trim().length > 0, `${label} missing season`, failures);
  assert(typeof data.versionId === 'string' && data.versionId.trim().length > 0, `${label} missing versionId`, failures);
  validateLocalizedText(data.title, `${label}.title`, failures);
  validateTacticianGuideNaming(data, label, failures);
  validateLocalizedText(data.class?.base, `${label}.class.base`, failures);
  validateLocalizedText(data.class?.ascendancy, `${label}.class.ascendancy`, failures);
  assert(data.source && typeof data.source === 'object', `${label} missing source`, failures);
  assert(data.overview && typeof data.overview === 'object', `${label} missing overview`, failures);
  validateLocalizedText(data.overview?.difficulty, `${label}.overview.difficulty`, failures);
  validateLocalizedText(data.overview?.budget, `${label}.overview.budget`, failures);
  validateLocalizedStringArray(data.overview?.bestFor, `${label}.overview.bestFor`, failures);
  validateLocalizedStringArray(data.overview?.strengths, `${label}.overview.strengths`, failures);
  validateLocalizedStringArray(data.overview?.risks, `${label}.overview.risks`, failures);
  assert(data.guideArticle && typeof data.guideArticle === 'object', `${label} missing guideArticle`, failures);
  validateLocalizedText(data.guideArticle?.title, `${label}.guideArticle.title`, failures);
  validateLocalizedText(data.guideArticle?.intro, `${label}.guideArticle.intro`, failures);
  assert(Array.isArray(data.guideArticle?.sections) && data.guideArticle.sections.length > 0, `${label}.guideArticle missing sections`, failures);
  for (const [index, section] of (data.guideArticle?.sections || []).entries()) {
    const sectionLabel = `${label}.guideArticle.sections[${index}]`;
    assert(typeof section.id === 'string' && section.id.trim().length > 0, `${sectionLabel} missing id`, failures);
    validateLocalizedText(section.title, `${sectionLabel}.title`, failures);
    validateLocalizedText(section.body, `${sectionLabel}.body`, failures);
    validateLocalizedStringArray(section.checks, `${sectionLabel}.checks`, failures);
  }
  assert(data.evidenceSummary && typeof data.evidenceSummary === 'object', `${label} missing evidenceSummary`, failures);
  validateLocalizedText(data.evidenceSummary?.title, `${label}.evidenceSummary.title`, failures);
  validateLocalizedText(data.evidenceSummary?.intro, `${label}.evidenceSummary.intro`, failures);
  assert(Array.isArray(data.evidenceSummary?.checks) && data.evidenceSummary.checks.length > 0, `${label}.evidenceSummary missing checks`, failures);
  for (const [index, check] of (data.evidenceSummary?.checks || []).entries()) {
    const checkLabel = `${label}.evidenceSummary.checks[${index}]`;
    assert(typeof check.id === 'string' && check.id.trim().length > 0, `${checkLabel} missing id`, failures);
    validateLocalizedText(check.status, `${checkLabel}.status`, failures);
    validateLocalizedText(check.evidence, `${checkLabel}.evidence`, failures);
    validateLocalizedText(check.limitation, `${checkLabel}.limitation`, failures);
    validateLocalizedText(check.nextAction, `${checkLabel}.nextAction`, failures);
    assert(['ok', 'warning', 'pending'].includes(check.severity), `${checkLabel} invalid severity`, failures);
  }
  assert(data.guideStrategy && typeof data.guideStrategy === 'object', `${label} missing guideStrategy`, failures);
  assert(typeof data.guideStrategy?.coreLoop?.title === 'string' && data.guideStrategy.coreLoop.title.trim().length > 0, `${label}.guideStrategy.coreLoop missing title`, failures);
  validateStringArray(data.guideStrategy?.coreLoop?.steps, `${label}.guideStrategy.coreLoop.steps`, failures);
  for (const [index, signal] of (data.guideStrategy?.powerSignals || []).entries()) {
    const signalLabel = `${label}.guideStrategy.powerSignals[${index}]`;
    assert(typeof signal.id === 'string' && signal.id.trim().length > 0, `${signalLabel} missing id`, failures);
    assert(typeof signal.title === 'string' && signal.title.trim().length > 0, `${signalLabel} missing title`, failures);
    assert(typeof signal.good === 'string' && signal.good.trim().length > 0, `${signalLabel} missing good`, failures);
    assert(typeof signal.check === 'string' && signal.check.trim().length > 0, `${signalLabel} missing check`, failures);
  }
  assert((data.guideStrategy?.powerSignals || []).length > 0, `${label}.guideStrategy missing powerSignals`, failures);
  for (const [index, diagnosis] of (data.guideStrategy?.failureDiagnosis || []).entries()) {
    const diagnosisLabel = `${label}.guideStrategy.failureDiagnosis[${index}]`;
    assert(typeof diagnosis.symptom === 'string' && diagnosis.symptom.trim().length > 0, `${diagnosisLabel} missing symptom`, failures);
    assert(typeof diagnosis.likelyCause === 'string' && diagnosis.likelyCause.trim().length > 0, `${diagnosisLabel} missing likelyCause`, failures);
    assert(typeof diagnosis.fix === 'string' && diagnosis.fix.trim().length > 0, `${diagnosisLabel} missing fix`, failures);
    assert(typeof diagnosis.priority === 'string' && diagnosis.priority.trim().length > 0, `${diagnosisLabel} missing priority`, failures);
  }
  assert((data.guideStrategy?.failureDiagnosis || []).length > 0, `${label}.guideStrategy missing failureDiagnosis`, failures);
  for (const [index, ruleGroup] of (data.guideStrategy?.decisionRules || []).entries()) {
    const ruleLabel = `${label}.guideStrategy.decisionRules[${index}]`;
    assert(typeof ruleGroup.id === 'string' && ruleGroup.id.trim().length > 0, `${ruleLabel} missing id`, failures);
    assert(typeof ruleGroup.title === 'string' && ruleGroup.title.trim().length > 0, `${ruleLabel} missing title`, failures);
    validateStringArray(ruleGroup.rules, `${ruleLabel}.rules`, failures);
  }
  assert((data.guideStrategy?.decisionRules || []).length > 0, `${label}.guideStrategy missing decisionRules`, failures);

  assert(data.executionPlan && typeof data.executionPlan === 'object', `${label} missing executionPlan`, failures);
  assert(typeof data.executionPlan?.title === 'string' && data.executionPlan.title.trim().length > 0, `${label}.executionPlan missing title`, failures);
  assert(typeof data.executionPlan?.intro === 'string' && data.executionPlan.intro.trim().length > 0, `${label}.executionPlan missing intro`, failures);
  assert(Array.isArray(data.executionPlan?.stages) && data.executionPlan.stages.length > 0, `${label}.executionPlan missing stages`, failures);

  assert(data.routes && typeof data.routes === 'object', `${label} missing routes`, failures);
  validateStringArray(data.tags, `${label}.tags`, failures);

  const routeStages = new Map(
    manifestRoutes
      .filter((route) => route.buildId === buildEntry.id)
      .map((route) => [route.stageId, route])
  );

  assert(Array.isArray(data.stages) && data.stages.length > 0, `${label} missing stages`, failures);
  const stageIds = new Set();
  for (const [index, stage] of (data.stages || []).entries()) {
    const stageLabel = `${label}.stages[${index}]`;
    assert(typeof stage.id === 'string' && stage.id.trim().length > 0, `${stageLabel} missing id`, failures);
    assert(!stageIds.has(stage.id), `${stageLabel} duplicate id ${stage.id}`, failures);
    stageIds.add(stage.id);
    assert(typeof stage.title === 'string' && stage.title.trim().length > 0, `${stageLabel} missing title`, failures);
    assert(typeof stage.summary === 'string' && stage.summary.trim().length > 0, `${stageLabel} missing summary`, failures);
    validateStringArray(stage.priorities, `${stageLabel}.priorities`, failures);
    assert(stage.playbook && typeof stage.playbook === 'object', `${stageLabel} missing playbook`, failures);
    assert(typeof stage.playbook?.title === 'string' && stage.playbook.title.trim().length > 0, `${stageLabel}.playbook missing title`, failures);
    validateStringArray(stage.playbook?.steps, `${stageLabel}.playbook.steps`, failures);
    if (stage.playbook?.checks) validateStringArray(stage.playbook.checks, `${stageLabel}.playbook.checks`, failures);
    if (stage.playbook?.mistakes) validateStringArray(stage.playbook.mistakes, `${stageLabel}.playbook.mistakes`, failures);
    if (stage.treeStage) {
      const route = routeStages.get(stage.treeStage);
      assert(Boolean(route), `${stageLabel} treeStage not registered in manifest: ${stage.treeStage}`, failures);
      assert(stage.treeNodes === route?.nodes, `${stageLabel} treeNodes mismatch with manifest`, failures);
      assert(stage.routeOrigin === route?.origin, `${stageLabel} routeOrigin mismatch with manifest`, failures);
      assert(stage.overridePolicy === route?.overridePolicy, `${stageLabel} overridePolicy mismatch with manifest`, failures);
      assert(stage.handTuned === route?.handTuned, `${stageLabel} handTuned mismatch with manifest`, failures);
      assert(stage.routeReview && typeof stage.routeReview === 'object', `${stageLabel} missing routeReview`, failures);
      assert(typeof stage.routeReview?.status === 'string' && stage.routeReview.status.trim().length > 0, `${stageLabel}.routeReview missing status`, failures);
      assert(typeof stage.routeReview?.reason === 'string' && stage.routeReview.reason.trim().length > 0, `${stageLabel}.routeReview missing reason`, failures);
      assert(typeof stage.routeReview?.useUntil === 'string' && stage.routeReview.useUntil.trim().length > 0, `${stageLabel}.routeReview missing useUntil`, failures);
      validateStringArray(stage.routeReview?.manualChecks, `${stageLabel}.routeReview.manualChecks`, failures);
    }
  }

  for (const [index, execution] of (data.executionPlan?.stages || []).entries()) {
    const executionLabel = `${label}.executionPlan.stages[${index}]`;
    assert(stageIds.has(execution.stageId), `${executionLabel} references unknown stageId ${execution.stageId}`, failures);
    assert(typeof execution.mainAction === 'string' && execution.mainAction.trim().length > 0, `${executionLabel} missing mainAction`, failures);
    validateStringArray(execution.buyFirst, `${executionLabel}.buyFirst`, failures);
    assert(typeof execution.stopLine === 'string' && execution.stopLine.trim().length > 0, `${executionLabel} missing stopLine`, failures);
    assert(typeof execution.fallback === 'string' && execution.fallback.trim().length > 0, `${executionLabel} missing fallback`, failures);
    assert(typeof execution.nextGate === 'string' && execution.nextGate.trim().length > 0, `${executionLabel} missing nextGate`, failures);
  }

  assert(data.skills?.overview && typeof data.skills.overview === 'object', `${label}.skills missing overview`, failures);
  validateLocalizedText(data.skills?.overview?.title, `${label}.skills.overview.title`, failures);
  validateLocalizedText(data.skills?.overview?.intro, `${label}.skills.overview.intro`, failures);
  assert(Array.isArray(data.skills?.overview?.cards) && data.skills.overview.cards.length > 0, `${label}.skills.overview missing cards`, failures);
  for (const [index, card] of (data.skills?.overview?.cards || []).entries()) {
    const cardLabel = `${label}.skills.overview.cards[${index}]`;
    assert(typeof card.id === 'string' && card.id.trim().length > 0, `${cardLabel} missing id`, failures);
    validateLocalizedText(card.title, `${cardLabel}.title`, failures);
    validateLocalizedText(card.body, `${cardLabel}.body`, failures);
    validateLocalizedStringArray(card.checks, `${cardLabel}.checks`, failures);
  }

  const activeSkills = data.skills?.active || [];
  assert(Array.isArray(activeSkills) && activeSkills.length > 0, `${label} missing active skills`, failures);
  const activeIds = new Set();
  for (const [index, skill] of activeSkills.entries()) {
    const skillLabel = `${label}.skills.active[${index}]`;
    assert(typeof skill.id === 'string' && skill.id.trim().length > 0, `${skillLabel} missing id`, failures);
    assert(!activeIds.has(skill.id), `${skillLabel} duplicate id ${skill.id}`, failures);
    activeIds.add(skill.id);
    assert(typeof skill.role === 'string' && skill.role.trim().length > 0, `${skillLabel} missing role`, failures);
    validateLocalizedText(skill.name, `${skillLabel}.name`, failures);
  }

  const supports = data.skills?.supports || {};
  assert(supports && typeof supports === 'object' && !Array.isArray(supports), `${label} missing supports`, failures);
  const supportIds = new Set(Object.keys(supports));
  for (const [supportId, supportName] of Object.entries(supports)) {
    validateLocalizedText(supportName, `${label}.skills.supports.${supportId}`, failures);
  }

  for (const [index, skill] of activeSkills.entries()) {
    const skillLabel = `${label}.skills.active[${index}]`;
    for (const supportId of skill.supports || []) {
      assert(supportIds.has(supportId), `${skillLabel} references unknown support ${supportId}`, failures);
    }
    if (skill.supportProfile) {
      assert(Array.isArray(data.skills?.supportProfiles?.[skill.supportProfile]), `${skillLabel} references unknown supportProfile ${skill.supportProfile}`, failures);
    }
  }

  for (const [profileId, profileSupports] of Object.entries(data.skills?.supportProfiles || {})) {
    validateStringArray(profileSupports, `${label}.skills.supportProfiles.${profileId}`, failures);
    for (const supportId of profileSupports || []) {
      assert(supportIds.has(supportId), `${label}.skills.supportProfiles.${profileId} references unknown support ${supportId}`, failures);
    }
  }

  const linkIds = new Set();
  for (const [index, link] of (data.skills?.recommendedLinks || []).entries()) {
    const linkLabel = `${label}.skills.recommendedLinks[${index}]`;
    assert(typeof link.id === 'string' && link.id.trim().length > 0, `${linkLabel} missing id`, failures);
    assert(!linkIds.has(link.id), `${linkLabel} duplicate id ${link.id}`, failures);
    linkIds.add(link.id);
    assert(typeof link.slotType === 'string' && link.slotType.trim().length > 0, `${linkLabel} missing slotType`, failures);
    assert(Number.isInteger(link.priority) && link.priority > 0, `${linkLabel} invalid priority`, failures);
    validateLocalizedText(link.note, `${linkLabel}.note`, failures);
    if (link.rules) {
      validateLocalizedStringArray(link.rules, `${linkLabel}.rules`, failures);
    }
    if (link.skill) assert(activeIds.has(link.skill), `${linkLabel} references unknown skill ${link.skill}`, failures);
    for (const skillId of link.chooseFrom || []) {
      assert(activeIds.has(skillId), `${linkLabel} chooseFrom references unknown skill ${skillId}`, failures);
    }
    assert(link.skill || Array.isArray(link.chooseFrom), `${linkLabel} should declare skill or chooseFrom`, failures);
    validateStringArray(link.supports, `${linkLabel}.supports`, failures);
    for (const supportId of link.supports || []) {
      assert(supportIds.has(supportId), `${linkLabel} references unknown support ${supportId}`, failures);
    }
  }

  for (const [index, rule] of (data.skills?.supportSelectionRules || []).entries()) {
    const ruleLabel = `${label}.skills.supportSelectionRules[${index}]`;
    assert(typeof rule.id === 'string' && rule.id.trim().length > 0, `${ruleLabel} missing id`, failures);
    validateLocalizedText(rule.title, `${ruleLabel}.title`, failures);
    validateLocalizedStringArray(rule.items, `${ruleLabel}.items`, failures);
  }

  const minionSelection = data.skills?.minionSelectionGuide;
  assert(minionSelection && typeof minionSelection === 'object' && !Array.isArray(minionSelection), `${label}.skills missing minionSelectionGuide`, failures);
  validateLocalizedText(minionSelection?.title, `${label}.skills.minionSelectionGuide.title`, failures);
  validateLocalizedText(minionSelection?.intro, `${label}.skills.minionSelectionGuide.intro`, failures);
  assert(Array.isArray(minionSelection?.groups) && minionSelection.groups.length > 0, `${label}.skills.minionSelectionGuide missing groups`, failures);
  const minionSelectionGroupIds = new Set();
  for (const [index, group] of (minionSelection?.groups || []).entries()) {
    const groupLabel = `${label}.skills.minionSelectionGuide.groups[${index}]`;
    assert(typeof group.id === 'string' && group.id.trim().length > 0, `${groupLabel} missing id`, failures);
    assert(!minionSelectionGroupIds.has(group.id), `${groupLabel} duplicate id ${group.id}`, failures);
    minionSelectionGroupIds.add(group.id);
    validateLocalizedText(group.title, `${groupLabel}.title`, failures);
    validateLocalizedText(group.job, `${groupLabel}.job`, failures);
    validateLocalizedStringArray(group.chooseWhen, `${groupLabel}.chooseWhen`, failures);
    validateStringArray(group.skillIds, `${groupLabel}.skillIds`, failures);
    for (const skillId of group.skillIds || []) {
      assert(activeIds.has(skillId), `${groupLabel}.skillIds references unknown active skill ${skillId}`, failures);
      assert(!supportIds.has(skillId), `${groupLabel}.skillIds should not reference support gem ${skillId}`, failures);
    }
    validateStringArray(group.firstSupports, `${groupLabel}.firstSupports`, failures);
    for (const supportId of group.firstSupports || []) {
      assert(supportIds.has(supportId), `${groupLabel}.firstSupports references unknown support ${supportId}`, failures);
      assert(!activeIds.has(supportId), `${groupLabel}.firstSupports should not reference active skill ${supportId}`, failures);
    }
    validateLocalizedText(group.cutFirst, `${groupLabel}.cutFirst`, failures);
  }
  validateLocalizedStringArray(minionSelection?.rules, `${label}.skills.minionSelectionGuide.rules`, failures);

  for (const [index, row] of (data.skills?.supportDecisionMatrix || []).entries()) {
    const rowLabel = `${label}.skills.supportDecisionMatrix[${index}]`;
    assert(typeof row.id === 'string' && row.id.trim().length > 0, `${rowLabel} missing id`, failures);
    validateLocalizedText(row.title, `${rowLabel}.title`, failures);
    validateLocalizedText(row.role, `${rowLabel}.role`, failures);
    validateLocalizedStringArray(row.useWhen, `${rowLabel}.useWhen`, failures);
    validateLocalizedStringArray(row.cutWhen, `${rowLabel}.cutWhen`, failures);
    validateLocalizedText(row.reviewNote, `${rowLabel}.reviewNote`, failures);
    validateStringArray(row.skillIds, `${rowLabel}.skillIds`, failures);
    for (const skillId of row.skillIds || []) {
      assert(activeIds.has(skillId), `${rowLabel}.skillIds references unknown active skill ${skillId}`, failures);
    }
    validateStringArray(row.firstSupports, `${rowLabel}.firstSupports`, failures);
    for (const supportId of row.firstSupports || []) {
      assert(supportIds.has(supportId), `${rowLabel}.firstSupports references unknown support ${supportId}`, failures);
    }
    if (row.addLater !== undefined) {
      validateStringArray(row.addLater, `${rowLabel}.addLater`, failures);
      for (const supportId of row.addLater || []) {
        assert(supportIds.has(supportId), `${rowLabel}.addLater references unknown support ${supportId}`, failures);
      }
    }
  }

  const supportDecisionIds = new Set((data.skills?.supportDecisionMatrix || []).map((row) => row.id));
  for (const [index, item] of (data.skills?.troubleshooting || []).entries()) {
    const itemLabel = `${label}.skills.troubleshooting[${index}]`;
    assert(typeof item.id === 'string' && item.id.trim().length > 0, `${itemLabel} missing id`, failures);
    validateLocalizedText(item.problem, `${itemLabel}.problem`, failures);
    validateLocalizedStringArray(item.check, `${itemLabel}.check`, failures);
    validateLocalizedText(item.note, `${itemLabel}.note`, failures);
    validateStringArray(item.add, `${itemLabel}.add`, failures);
    validateStringArray(item.cut, `${itemLabel}.cut`, failures);
    for (const refId of item.add || []) {
      assert(activeIds.has(refId) || supportIds.has(refId) || supportDecisionIds.has(refId), `${itemLabel}.add references unknown skill/support/matrix ${refId}`, failures);
    }
    for (const refId of item.cut || []) {
      assert(activeIds.has(refId) || supportIds.has(refId) || supportDecisionIds.has(refId), `${itemLabel}.cut references unknown skill/support/matrix ${refId}`, failures);
    }
  }

  for (const [index, progression] of (data.skillProgression || []).entries()) {
    const progressionLabel = `${label}.skillProgression[${index}]`;
    assert(stageIds.has(progression.stageId), `${progressionLabel} references unknown stageId ${progression.stageId}`, failures);
    validateStringArray(progression.activeSkills, `${progressionLabel}.activeSkills`, failures);
    validateStringArray(progression.minions, `${progressionLabel}.minions`, failures);
    validateStringArray(progression.supportPriority, `${progressionLabel}.supportPriority`, failures);
    assert(typeof progression.swapRule === 'string' && progression.swapRule.trim().length > 0, `${progressionLabel} missing swapRule`, failures);
  }

  assert(Array.isArray(data.skillAcquisition) && data.skillAcquisition.length > 0, `${label} missing skillAcquisition`, failures);
  for (const [index, acquisition] of (data.skillAcquisition || []).entries()) {
    const acquisitionLabel = `${label}.skillAcquisition[${index}]`;
    assert(stageIds.has(acquisition.stageId), `${acquisitionLabel} references unknown stageId ${acquisition.stageId}`, failures);
    assert(typeof acquisition.timing === 'string' && acquisition.timing.trim().length > 0, `${acquisitionLabel} missing timing`, failures);
    validateStringArray(acquisition.take, `${acquisitionLabel}.take`, failures);
    if (acquisition.activeSkillIds !== undefined) {
      validateStringArray(acquisition.activeSkillIds, `${acquisitionLabel}.activeSkillIds`, failures);
      for (const skillId of acquisition.activeSkillIds || []) {
        assert(activeIds.has(skillId), `${acquisitionLabel}.activeSkillIds references unknown active skill ${skillId}`, failures);
      }
    }
    validateStringArray(acquisition.doNotForce, `${acquisitionLabel}.doNotForce`, failures);
    validateStringArray(acquisition.confirmBefore, `${acquisitionLabel}.confirmBefore`, failures);
    validateStringArray(acquisition.sourceUse, `${acquisitionLabel}.sourceUse`, failures);
    validateStringArray(acquisition.fallback, `${acquisitionLabel}.fallback`, failures);
    assert(typeof acquisition.evidenceNote === 'string' && acquisition.evidenceNote.trim().length > 0, `${acquisitionLabel} missing evidenceNote`, failures);
    assert(typeof acquisition.sourceStatus === 'string' && acquisition.sourceStatus.trim().length > 0, `${acquisitionLabel} missing sourceStatus`, failures);
  }

  assert(data.gearOverview && typeof data.gearOverview === 'object', `${label} missing gearOverview`, failures);
  assert(typeof data.gearOverview?.title === 'string' && data.gearOverview.title.trim().length > 0, `${label}.gearOverview missing title`, failures);
  assert(typeof data.gearOverview?.intro === 'string' && data.gearOverview.intro.trim().length > 0, `${label}.gearOverview missing intro`, failures);
  assert(Array.isArray(data.gearOverview?.cards) && data.gearOverview.cards.length > 0, `${label}.gearOverview missing cards`, failures);
  for (const [index, card] of (data.gearOverview?.cards || []).entries()) {
    const cardLabel = `${label}.gearOverview.cards[${index}]`;
    assert(typeof card.id === 'string' && card.id.trim().length > 0, `${cardLabel} missing id`, failures);
    assert(typeof card.title === 'string' && card.title.trim().length > 0, `${cardLabel} missing title`, failures);
    assert(typeof card.body === 'string' && card.body.trim().length > 0, `${cardLabel} missing body`, failures);
    validateStringArray(card.checks, `${cardLabel}.checks`, failures);
  }

  assert(Array.isArray(data.gearPriorities) && data.gearPriorities.length > 0, `${label} missing gearPriorities`, failures);
  for (const [index, gear] of (data.gearPriorities || []).entries()) {
    const gearLabel = `${label}.gearPriorities[${index}]`;
    assert(typeof gear.slot === 'string' && gear.slot.trim().length > 0, `${gearLabel} missing slot`, failures);
    assert(typeof gear.early === 'string' && gear.early.trim().length > 0, `${gearLabel} missing early`, failures);
    assert(typeof gear.mid === 'string' && gear.mid.trim().length > 0, `${gearLabel} missing mid`, failures);
    assert(typeof gear.endgame === 'string' && gear.endgame.trim().length > 0, `${gearLabel} missing endgame`, failures);
    validateStringArray(gear.priorityStats, `${gearLabel}.priorityStats`, failures);
    validateStringArray(gear.avoid, `${gearLabel}.avoid`, failures);
  }

  assert(Array.isArray(data.earlyGearStatPriority) && data.earlyGearStatPriority.length > 0, `${label} missing earlyGearStatPriority`, failures);
  for (const [index, priority] of (data.earlyGearStatPriority || []).entries()) {
    const priorityLabel = `${label}.earlyGearStatPriority[${index}]`;
    assert(typeof priority.id === 'string' && priority.id.trim().length > 0, `${priorityLabel} missing id`, failures);
    assert(typeof priority.title === 'string' && priority.title.trim().length > 0, `${priorityLabel} missing title`, failures);
    validateStringArray(priority.priority, `${priorityLabel}.priority`, failures);
    assert(typeof priority.rule === 'string' && priority.rule.trim().length > 0, `${priorityLabel} missing rule`, failures);
    validateStringArray(priority.avoid, `${priorityLabel}.avoid`, failures);
  }

  for (const [index, stagePlan] of (data.gearStagePlan || []).entries()) {
    const stagePlanLabel = `${label}.gearStagePlan[${index}]`;
    assert(stageIds.has(stagePlan.stageId), `${stagePlanLabel} references unknown stageId ${stagePlan.stageId}`, failures);
    assert(typeof stagePlan.budgetTier === 'string' && stagePlan.budgetTier.trim().length > 0, `${stagePlanLabel} missing budgetTier`, failures);
    assert(typeof stagePlan.focus === 'string' && stagePlan.focus.trim().length > 0, `${stagePlanLabel} missing focus`, failures);
    validateStringArray(stagePlan.mustHave, `${stagePlanLabel}.mustHave`, failures);
    assert(typeof stagePlan.upgradeWhen === 'string' && stagePlan.upgradeWhen.trim().length > 0, `${stagePlanLabel} missing upgradeWhen`, failures);
  }

  assert(Array.isArray(data.gearStatThresholds) && data.gearStatThresholds.length > 0, `${label} missing gearStatThresholds`, failures);
  for (const [index, group] of (data.gearStatThresholds || []).entries()) {
    const groupLabel = `${label}.gearStatThresholds[${index}]`;
    assert(stageIds.has(group.stageId), `${groupLabel} references unknown stageId ${group.stageId}`, failures);
    assert(typeof group.title === 'string' && group.title.trim().length > 0, `${groupLabel} missing title`, failures);
    assert(typeof group.sourceStatus === 'string' && group.sourceStatus.trim().length > 0, `${groupLabel} missing sourceStatus`, failures);
    assert(typeof group.note === 'string' && group.note.trim().length > 0, `${groupLabel} missing note`, failures);
    assert(Array.isArray(group.thresholds) && group.thresholds.length > 0, `${groupLabel} missing thresholds`, failures);
    for (const [thresholdIndex, threshold] of (group.thresholds || []).entries()) {
      const thresholdLabel = `${groupLabel}.thresholds[${thresholdIndex}]`;
      assert(typeof threshold.stat === 'string' && threshold.stat.trim().length > 0, `${thresholdLabel} missing stat`, failures);
      assert(typeof threshold.minimum === 'string' && threshold.minimum.trim().length > 0, `${thresholdLabel} missing minimum`, failures);
      assert(typeof threshold.upgradeTarget === 'string' && threshold.upgradeTarget.trim().length > 0, `${thresholdLabel} missing upgradeTarget`, failures);
      assert(Number.isInteger(threshold.priority) && threshold.priority > 0, `${thresholdLabel} missing positive integer priority`, failures);
      assert(typeof threshold.reason === 'string' && threshold.reason.trim().length > 0, `${thresholdLabel} missing reason`, failures);
    }
  }

  for (const [index, craft] of (data.craftingPlan || []).entries()) {
    const craftLabel = `${label}.craftingPlan[${index}]`;
    assert(typeof craft.id === 'string' && craft.id.trim().length > 0, `${craftLabel} missing id`, failures);
    assert(typeof craft.title === 'string' && craft.title.trim().length > 0, `${craftLabel} missing title`, failures);
    assert(stageIds.has(craft.stageId), `${craftLabel} references unknown stageId ${craft.stageId}`, failures);
    assert(typeof craft.sourceStatus === 'string' && craft.sourceStatus.trim().length > 0, `${craftLabel} missing sourceStatus`, failures);
    assert(typeof craft.goal === 'string' && craft.goal.trim().length > 0, `${craftLabel} missing goal`, failures);
    assert(typeof craft.base === 'string' && craft.base.trim().length > 0, `${craftLabel} missing base`, failures);
    assert(typeof craft.purchaseFirst === 'string' && craft.purchaseFirst.trim().length > 0, `${craftLabel} missing purchaseFirst`, failures);
    validateStringArray(craft.priorityMods, `${craftLabel}.priorityMods`, failures);
    validateStringArray(craft.materials, `${craftLabel}.materials`, failures);
    validateStringArray(craft.steps, `${craftLabel}.steps`, failures);
    validateStringArray(craft.successChecks, `${craftLabel}.successChecks`, failures);
    validateStringArray(craft.fallback, `${craftLabel}.fallback`, failures);
    assert(typeof craft.stopRule === 'string' && craft.stopRule.trim().length > 0, `${craftLabel} missing stopRule`, failures);
  }

  const gearStageIds = new Set((data.gearStagePlan || []).map((item) => item.stageId));
  const thresholdStageIds = new Set((data.gearStatThresholds || []).map((item) => item.stageId));
  const progressionStageIds = new Set((data.skillProgression || []).map((item) => item.stageId));
  for (const stage of data.stages || []) {
    const stageLabel = `${label}.stageCoverage.${stage.id}`;
    if (stage.treeStage) {
      assert(routeStages.has(stage.treeStage), `${stageLabel} missing manifest tree route`, failures);
    }
    assert(gearStageIds.has(stage.id), `${stageLabel} missing gearStagePlan`, failures);
    assert(thresholdStageIds.has(stage.id), `${stageLabel} missing gearStatThresholds`, failures);
    assert(progressionStageIds.has(stage.id), `${stageLabel} missing skillProgression`, failures);
  }

  return failures;
}

function resolveBuildFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

async function validateBuild(seasonRoot, buildEntry, manifestRoutes) {
  let data;
  try {
    data = await readJson(resolveBuildFile(seasonRoot, buildEntry.data));
  } catch (error) {
    return {
      build: buildEntry.id,
      file: buildEntry.data,
      status: 'failed',
      failures: [`Cannot read build JSON: ${error.message}`]
    };
  }

  const failures = validateBuildData(buildEntry, data, manifestRoutes);
  return {
    build: buildEntry.id,
    file: buildEntry.data,
    status: failures.length ? 'failed' : 'ok',
    stages: data.stages?.length || 0,
    activeSkills: data.skills?.active?.length || 0,
    supports: Object.keys(data.skills?.supports || {}).length,
    minionSelectionGroups: data.skills?.minionSelectionGuide?.groups?.length || 0,
    recommendedLinks: data.skills?.recommendedLinks?.length || 0,
    gearSlots: data.gearPriorities?.length || 0,
    craftPlans: data.craftingPlan?.length || 0,
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

  if (args.file || args.id) {
    if (!args.file || !args.id) throw new Error('--file and --id must be used together');
    const result = await validateBuild(seasonRoot, { id: args.id, data: args.file }, manifest.tree?.routes || []);
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
  for (const build of manifest.builds || []) {
    results.push(await validateBuild(seasonRoot, build, manifest.tree?.routes || []));
  }

  const failed = results.filter((result) => result.status !== 'ok');
  console.log(JSON.stringify({
    season: args.season,
    buildCount: results.length,
    failed: failed.length,
    results
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
