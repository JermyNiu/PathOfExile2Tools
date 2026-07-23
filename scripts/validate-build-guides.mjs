#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];

function parseArgs(argv) {
  const args = { season: 's05', id: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-build-guides.mjs [--season s05]',
    '  node scripts/validate-build-guides.mjs --season s05 --id tactician-supporting-fire',
    '',
    'Reports guide-writing completeness for registered build JSON files.',
    'This is an authoring gate: it fails if a registered build is missing the guide article, strategy, staged execution plan, stage playbooks, skill overview, minion selection guide, gear overview, or guide report page entry.'
  ].join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (_) {
    return false;
  }
}

function localizedReady(value) {
  return Boolean(value)
    && typeof value === 'object'
    && locales.every((locale) => typeof value[locale] === 'string' && value[locale].trim().length > 0);
}

function localizedListCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Math.max(...locales.map((locale) => Array.isArray(value[locale]) ? value[locale].length : 0), 0);
}

function sourceStatusFor(row) {
  return [
    row.articleSections ? 'manual-guide-article' : '',
    row.skillOverviewCards ? 'manual-guide-skill-flow' : '',
    row.minionSelectionGroups ? 'manual-guide-minion-selection' : '',
    row.gearOverviewCards ? 'manual-guide-gear-flow' : '',
    row.strategyReady ? 'manual-guide-strategy' : '',
    row.stagePlaybooks === row.stageCount && row.stageCount > 0 ? 'manual-guide-stage-playbook' : '',
    row.executionStages ? 'manual-guide-execution-plan' : ''
  ].filter(Boolean).join(',');
}

function guidePagePath(entry, build, seasonRoot) {
  if (entry?.guide) return path.resolve(seasonRoot, entry.guide);
  if (build.routes?.guide) return path.resolve(repoRoot, build.routes.guide);
  return '';
}

async function buildGuideStats(entry, build, seasonRoot) {
  const article = build.guideArticle;
  const articleSections = article?.sections || [];
  const skillCards = build.skills?.overview?.cards || [];
  const minionSelection = build.skills?.minionSelectionGuide;
  const minionSelectionGroups = minionSelection?.groups || [];
  const gearCards = build.gearOverview?.cards || [];
  const stages = build.stages || [];
  const executionStages = build.executionPlan?.stages || [];
  const strategyReady = Boolean(build.guideStrategy?.coreLoop?.steps?.length)
    && Boolean(build.guideStrategy?.powerSignals?.length)
    && Boolean(build.guideStrategy?.failureDiagnosis?.length)
    && Boolean(build.guideStrategy?.decisionRules?.length);
  const articleReady = localizedReady(article?.title)
    && localizedReady(article?.intro)
    && articleSections.length > 0
    && articleSections.every((section) => (
      typeof section.id === 'string'
      && localizedReady(section.title)
      && localizedReady(section.body)
      && localizedListCount(section.checks) > 0
    ));
  const stagePlaybooks = stages.filter((stage) => stage.playbook?.steps?.length).length;

  const guideFile = guidePagePath(entry, build, seasonRoot);
  const guideReportReady = Boolean(guideFile) && await exists(guideFile);
  const row = {
    id: build.id || 'unknown',
    articleReady,
    articleSections: articleSections.length,
    articleChecks: articleSections.reduce((sum, section) => sum + localizedListCount(section.checks), 0),
    strategyReady,
    executionStages: executionStages.length,
    stageCount: stages.length,
    stagePlaybooks,
    skillOverviewCards: skillCards.length,
    skillOverviewChecks: skillCards.reduce((sum, card) => sum + localizedListCount(card.checks), 0),
    minionSelectionReady: localizedReady(minionSelection?.title)
      && localizedReady(minionSelection?.intro)
      && minionSelectionGroups.length > 0
      && minionSelectionGroups.every((group) => (
        typeof group.id === 'string'
        && localizedReady(group.title)
        && localizedReady(group.job)
        && localizedListCount(group.chooseWhen) > 0
        && Array.isArray(group.skillIds)
        && group.skillIds.length > 0
        && Array.isArray(group.firstSupports)
        && group.firstSupports.length > 0
        && localizedReady(group.cutFirst)
      ))
      && localizedListCount(minionSelection?.rules) > 0,
    minionSelectionGroups: minionSelectionGroups.length,
    minionSelectionSkillRefs: minionSelectionGroups.reduce((sum, group) => sum + (group.skillIds?.length || 0), 0),
    minionSelectionSupportRefs: minionSelectionGroups.reduce((sum, group) => sum + (group.firstSupports?.length || 0), 0),
    minionSelectionRules: localizedListCount(minionSelection?.rules),
    gearOverviewCards: gearCards.length,
    gearOverviewChecks: gearCards.reduce((sum, card) => sum + localizedListCount(card.checks), 0),
    guideReportReady,
    guideReportFile: guideFile ? path.relative(repoRoot, guideFile) : ''
  };
  row.complete = row.articleReady
    && row.strategyReady
    && row.executionStages > 0
    && row.stageCount > 0
    && row.stagePlaybooks === row.stageCount
    && row.skillOverviewCards > 0
    && row.minionSelectionReady
    && row.gearOverviewCards > 0;
  row.publishReady = row.complete && row.guideReportReady;
  row.sourceStatus = sourceStatusFor(row);
  row.missing = [
    row.articleReady ? '' : 'guideArticle',
    row.strategyReady ? '' : 'guideStrategy',
    row.executionStages > 0 ? '' : 'executionPlan.stages',
    row.stageCount > 0 ? '' : 'stages',
    row.stagePlaybooks === row.stageCount && row.stageCount > 0 ? '' : 'stages.playbook',
    row.skillOverviewCards > 0 ? '' : 'skills.overview',
    row.minionSelectionReady ? '' : 'skills.minionSelectionGuide',
    row.gearOverviewCards > 0 ? '' : 'gearOverview',
    row.guideReportReady ? '' : 'guideReportPage'
  ].filter(Boolean);
  return row;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const entries = (manifest.builds || []).filter((entry) => !args.id || entry.id === args.id);
  if (args.id && entries.length === 0) {
    throw new Error(`Build id not registered in ${args.season}: ${args.id}`);
  }

  const rows = [];
  for (const entry of entries) {
    const build = await readJson(path.join(seasonRoot, entry.data));
    rows.push(await buildGuideStats(entry, build, seasonRoot));
  }

  const failedRows = rows.filter((row) => !row.publishReady);
  const summary = {
    season: args.season,
    buildCount: rows.length,
    complete: rows.filter((row) => row.complete).length,
    guideReportReady: rows.filter((row) => row.guideReportReady).length,
    publishReady: rows.filter((row) => row.publishReady).length,
    missing: failedRows.length,
    articleSections: rows.reduce((sum, row) => sum + row.articleSections, 0),
    articleChecks: rows.reduce((sum, row) => sum + row.articleChecks, 0),
    skillOverviewCards: rows.reduce((sum, row) => sum + row.skillOverviewCards, 0),
    skillOverviewChecks: rows.reduce((sum, row) => sum + row.skillOverviewChecks, 0),
    minionSelectionReady: rows.filter((row) => row.minionSelectionReady).length,
    minionSelectionGroups: rows.reduce((sum, row) => sum + row.minionSelectionGroups, 0),
    minionSelectionSkillRefs: rows.reduce((sum, row) => sum + row.minionSelectionSkillRefs, 0),
    minionSelectionSupportRefs: rows.reduce((sum, row) => sum + row.minionSelectionSupportRefs, 0),
    minionSelectionRules: rows.reduce((sum, row) => sum + row.minionSelectionRules, 0),
    gearOverviewCards: rows.reduce((sum, row) => sum + row.gearOverviewCards, 0),
    gearOverviewChecks: rows.reduce((sum, row) => sum + row.gearOverviewChecks, 0),
    stagePlaybooks: rows.reduce((sum, row) => sum + row.stagePlaybooks, 0),
    executionStages: rows.reduce((sum, row) => sum + row.executionStages, 0),
    sourceStatus: [...new Set(rows.flatMap((row) => row.sourceStatus.split(',').filter(Boolean)))].join(','),
    rows
  };

  console.log(JSON.stringify(summary, null, 2));
  if (failedRows.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
