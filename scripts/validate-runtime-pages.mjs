#!/usr/bin/env node

import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBaseUrl = 'http://127.0.0.1:8766';
const bundledPlaywright = '/Users/happyelements/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js';
const defaultChromePaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
];

function parseArgs(argv) {
  const args = {
    baseUrl: defaultBaseUrl,
    timeoutMs: 10000,
    browser: process.env.CHROME_PATH || null,
    playwright: process.env.PLAYWRIGHT_INDEX || null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (arg === '--browser') args.browser = argv[++i];
    else if (arg === '--playwright') args.playwright = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-runtime-pages.mjs [--base-url http://127.0.0.1:8766] [--timeout-ms 10000]',
    '  node scripts/validate-runtime-pages.mjs --browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
    '',
    'Opens core pages in Chromium/Chrome and checks dataset fields after browser-side fetch hydration.',
    'Start the local server first, for example: node scripts/serve.mjs'
  ].join('\n');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (_) {
    return false;
  }
}

async function loadPlaywright(explicitPath) {
  if (explicitPath) {
    const mod = await import(pathToFileURL(explicitPath).href);
    return mod.default || mod;
  }
  try {
    const mod = await import('playwright');
    return mod.default || mod;
  } catch (_) {
    const localPath = path.join(repoRoot, 'node_modules', 'playwright', 'index.js');
    for (const candidate of [localPath, bundledPlaywright]) {
      if (await exists(candidate)) {
        const mod = await import(pathToFileURL(candidate).href);
        return mod.default || mod;
      }
    }
    throw new Error('Cannot find Playwright. Set PLAYWRIGHT_INDEX or pass --playwright <path-to-playwright/index.js>.');
  }
}

async function resolveBrowser(explicitPath) {
  if (explicitPath) return explicitPath;
  for (const candidate of defaultChromePaths) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function joinUrl(baseUrl, pagePath) {
  return new URL(pagePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function atLeast(key, min) {
  return (dataset) => {
    const value = num(dataset[key]);
    return value >= min ? null : `${key} expected >= ${min}, got ${dataset[key] ?? '<missing>'}`;
  };
}

function equals(key, expected) {
  return (dataset) => dataset[key] === expected ? null : `${key} expected ${expected}, got ${dataset[key] ?? '<missing>'}`;
}

function oneOf(key, values) {
  return (dataset) => values.includes(dataset[key]) ? null : `${key} expected one of ${values.join(', ')}, got ${dataset[key] ?? '<missing>'}`;
}

function includes(key, token) {
  return (dataset) => String(dataset[key] || '').includes(token) ? null : `${key} expected to include ${token}, got ${dataset[key] ?? '<missing>'}`;
}

function numericEquals(leftKey, rightKey) {
  return (dataset) => {
    const left = num(dataset[leftKey]);
    const right = num(dataset[rightKey]);
    return left === right ? null : `${leftKey} expected to equal ${rightKey}, got ${dataset[leftKey] ?? '<missing>'} vs ${dataset[rightKey] ?? '<missing>'}`;
  };
}

function pageTextIncludes(token) {
  return (_dataset, pageText) => pageText.includes(token) ? null : `page text expected to include ${token}`;
}

function runtimeChecks() {
  return [
    {
      id: 'home',
      path: '/',
      waitFor: 'homeReady',
      asserts: [
        equals('homeReady', 'true'),
        atLeast('levelingBuildCount', 1),
        atLeast('homeRouteQualityTotal', 1),
        atLeast('homeRouteReviewCount', 1),
        equals('homeBuildGuideCompleteCount', '1'),
        equals('homeBuildGuideMissingCount', '0'),
        equals('homeBuildGuideReportReadyCount', '1'),
        equals('homeBuildGuideSkillOverviewCards', '3'),
        equals('homeBuildGuideSkillOverviewChecks', '9'),
        equals('homeBuildGuideMinionSelectionGroups', '3'),
        atLeast('homeBuildGuideMinionSelectionSkillRefs', 9),
        atLeast('homeBuildGuideMinionSelectionSupportRefs', 6),
        equals('homeBuildGuideMinionSelectionRules', '3'),
        equals('homeBuildGuideGearOverviewCards', '4'),
        equals('homeBuildGuideGearOverviewChecks', '16'),
        equals('homeBuildGuideStagePlaybooks', '5'),
        equals('homeBuildGuideExecutionStages', '5'),
        includes('homeBuildGuideSourceStatus', 'manual-guide-article'),
        includes('homeBuildGuideSourceStatus', 'manual-guide-skill-flow'),
        includes('homeBuildGuideSourceStatus', 'manual-guide-gear-flow'),
        equals('homeBuildGearThresholdStageCount', '5'),
        equals('homeBuildGearThresholdRowCount', '20'),
        includes('homeBuildGearThresholdSourceStatus', 'manual-guide-threshold'),
        equals('homeBuildCraftPlanCount', '4'),
        equals('homeBuildCraftStructuredCount', '4'),
        includes('homeBuildCraftSourceStatus', 'manual-guide-crafting'),
        equals('homeBuildCandidateSchema', '1'),
        equals('homeBuildCandidateSourceFile', 'builds/candidates.json'),
        equals('homeBuildCandidateCount', '1'),
        equals('homeBuildCandidateAvailableCount', '1'),
        equals('homeBuildCandidateDraftCount', '1'),
        equals('homeBuildCandidateDraftFileCount', '1'),
        equals('homeBuildCandidateRouteStageCount', '4'),
        equals('homeBuildCandidateRouteFileCount', '4'),
        equals('homeBuildCandidateRouteMissingFileCount', '0'),
        equals('homeBuildCandidateHandTunedRouteCount', '4'),
        equals('homeBuildCandidateManifestRouteCount', '0'),
        equals('homeBuildCandidateMaterialReadyCount', '1'),
        equals('homeBuildCandidateReviewReadyCount', '1'),
        equals('homeBuildCandidateManifestPublishedCount', '0'),
        equals('homeBuildCandidatePublishReadyCount', '0'),
        includes('homeBuildCandidateBlockedBy', '未登记正式 BD'),
        includes('homeBuildCandidateBlockedBy', '未登记正式路线'),
        includes('homeBuildCandidateStatuses', 'draft'),
        pageTextIncludes('攻略正文 完整'),
        pageTextIncludes('攻略报告 可导出'),
        pageTextIncludes('技能总览 3 卡 / 9 检查'),
        pageTextIncludes('装备总览 4 卡 / 16 检查'),
        pageTextIncludes('候选路线文件'),
        pageTextIncludes('4/4'),
        pageTextIncludes('手调候选'),
        pageTextIncludes('正式路线'),
        pageTextIncludes('素材就绪'),
        pageTextIncludes('复核就绪'),
        pageTextIncludes('可发布'),
        pageTextIncludes('等待正式登记'),
        pageTextIncludes('市场复核工作台'),
        atLeast('homeGemMarketEntryCount', 1),
        atLeast('homeHideoutMarketEntryCount', 1),
        equals('homeGemMarketQualityAvgConfidence', '0.00'),
        equals('homeGemMarketQualityMinBuyDepth', '0'),
        equals('homeGemMarketQualityMinSellDepth', '0'),
        equals('homeHideoutMarketQualityAvgConfidence', '0.00'),
        equals('homeHideoutMarketQualityMinBuyDepth', '0'),
        equals('homeHideoutMarketQualityMinSellDepth', '0'),
        equals('homeGemMarketDecisionAction', 'sample-hold'),
        atLeast('homeGemMarketDecisionCapital', 1),
        atLeast('homeGemMarketDecisionNetProfit', 1),
        equals('homeGemMarketBudgetPlanReady', 'true'),
        equals('homeGemMarketBudgetPlanCapital', '100.00'),
        equals('homeGemMarketBudgetPlanTopId', 'supporting-fire-21'),
        equals('homeGemMarketBudgetPlanUnits', '5'),
        equals('homeGemMarketBudgetPlanSpend', '90.00'),
        equals('homeGemMarketBudgetPlanNetProfit', '57.20'),
        equals('homeGemMarketBudgetPlanAction', 'sample-plan-only'),
        equals('homeGemMarketCandidateIndexSchema', '1'),
        equals('homeGemMarketCandidateCount', '0'),
        equals('homeGemMarketCandidateReadyCount', '0'),
        equals('homeGemMarketCandidateCurrentKind', 'gemFlips'),
        equals('homeGemMarketCandidateCurrentKindCount', '0'),
        equals('homeGemMarketCandidateCurrentKindReadyCount', '0'),
        equals('homeSkillCatalogSourceType', 'poe2db-snapshot-v1'),
        equals('homeSkillCatalogEntryCount', '964'),
        equals('homeSkillCatalogActiveCount', '407'),
        equals('homeSkillCatalogSupportCount', '557'),
        equals('homeSkillCatalogDetailCount', '0'),
        equals('homeSkillCatalogVerifiedCount', '964'),
        equals('homeSkillCatalogBoundaryStatus', 'skill-data-not-live-price'),
        equals('homeHideoutMarketDecisionAction', 'sample-hold'),
        atLeast('homeHideoutMarketDecisionGoldCost', 1),
        atLeast('homeHideoutMarketDecisionCashCost', 1),
        atLeast('homeHideoutMarketDecisionNetProfit', 1),
        equals('homeHideoutMarketBudgetPlanReady', 'true'),
        equals('homeHideoutMarketBudgetPlanGold', '100000'),
        equals('homeHideoutMarketBudgetPlanCash', '50.00'),
        equals('homeHideoutMarketBudgetPlanTopId', 'waystone-tier-15'),
        equals('homeHideoutMarketBudgetPlanUnits', '8'),
        equals('homeHideoutMarketBudgetPlanGoldSpend', '96000'),
        equals('homeHideoutMarketBudgetPlanCashSpend', '16.00'),
        equals('homeHideoutMarketBudgetPlanNetProfit', '50.24'),
        equals('homeHideoutMarketBudgetPlanAction', 'sample-plan-only'),
        equals('homeHideoutMarketCandidateIndexSchema', '1'),
        equals('homeHideoutMarketCandidateCount', '0'),
        equals('homeHideoutMarketCandidateReadyCount', '0'),
        equals('homeHideoutMarketCandidateCurrentKind', 'hideoutFlips'),
        equals('homeHideoutMarketCandidateCurrentKindCount', '0'),
        equals('homeHideoutMarketCandidateCurrentKindReadyCount', '0'),
        oneOf('homeGemMarketFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown']),
        oneOf('homeHideoutMarketFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown']),
        equals('homeNinjaSchemaStatus', 'ok'),
        atLeast('homeNinjaParserHintCount', 5),
        includes('homeNinjaParserHints', 'pob-xml'),
        atLeast('homeNinjaExampleCount', 2),
        numericEquals('homeNinjaExampleOk', 'homeNinjaExampleCount'),
        atLeast('homeNinjaExamplePobXmlCount', 1),
        equals('homeNinjaArchiveCount', '1'),
        equals('homeNinjaArchiveReadyCount', '1'),
        equals('homeNinjaArchiveMatchedCount', '1'),
        equals('homeNinjaArchiveNeedsReviewCount', '0'),
        equals('homeNinjaArchiveSourceUnknownCount', '0'),
        includes('homeNinjaArchiveFormats', 'json')
      ]
    },
    {
      id: 'build-list',
      path: '/builds/index.html',
      waitFor: 'buildListCandidateCount',
      asserts: [
        equals('buildListCount', '1'),
        equals('buildListVisibleCount', '1'),
        equals('buildListFilterClass', 'all'),
        equals('buildListFilterStatus', 'all'),
        equals('buildListFilterRoute', 'all'),
        equals('buildListFilterGuide', 'all'),
        equals('buildListCandidateSchema', '1'),
        equals('buildListCandidateSourceFile', 'builds/candidates.json'),
        equals('buildListCandidateSourceType', 'manual-platform-backlog'),
        equals('buildListCandidateCount', '1'),
        equals('buildListCandidateAvailableCount', '1'),
        equals('buildListCandidateDraftCount', '1'),
        equals('buildListCandidateDraftFileCount', '1'),
        equals('buildListCandidateRouteStageCount', '4'),
        equals('buildListCandidateRouteFileCount', '4'),
        equals('buildListCandidateRouteMissingFileCount', '0'),
        includes('buildListCandidateStatuses', 'draft'),
        atLeast('buildListStageCount', 1),
        atLeast('buildListRouteCount', 1),
        atLeast('buildListStrategyCount', 1),
        equals('buildListGuideCompleteCount', '1'),
        equals('buildListGuideMissingCount', '0'),
        equals('buildListGuideReportReadyCount', '1'),
        equals('buildListGuideSkillOverviewCards', '3'),
        equals('buildListGuideSkillOverviewChecks', '9'),
        equals('buildListGuideMinionSelectionGroups', '3'),
        atLeast('buildListGuideMinionSelectionSkillRefs', 9),
        atLeast('buildListGuideMinionSelectionSupportRefs', 6),
        equals('buildListGuideMinionSelectionRules', '3'),
        equals('buildListGuideGearOverviewCards', '4'),
        equals('buildListGuideGearOverviewChecks', '16'),
        equals('buildListGuideStagePlaybooks', '5'),
        equals('buildListGuideExecutionStages', '5'),
        includes('buildListGuideSourceStatus', 'manual-guide-article'),
        includes('buildListGuideSourceStatus', 'manual-guide-skill-flow'),
        includes('buildListGuideSourceStatus', 'manual-guide-gear-flow'),
        equals('buildListGearThresholdStageCount', '5'),
        equals('buildListGearThresholdRowCount', '20'),
        includes('buildListGearThresholdSourceStatus', 'manual-guide-threshold'),
        equals('buildListCraftPlanCount', '4'),
        equals('buildListCraftStructuredCount', '4'),
        includes('buildListCraftSourceStatus', 'manual-guide-crafting'),
        pageTextIncludes('查看战术家攻略'),
        pageTextIncludes('独立天赋树工具'),
        pageTextIncludes('攻略正文 1 完整 / 0 缺口'),
        pageTextIncludes('攻略正文 完整'),
        pageTextIncludes('攻略报告 可导出'),
        pageTextIncludes('报告导出'),
        pageTextIncludes('技能总览 3 卡 / 9 检查'),
        pageTextIncludes('装备总览 4 卡 / 16 检查'),
        pageTextIncludes('候选 BD 队列'),
        pageTextIncludes('候选路线文件 4 / 4'),
        pageTextIncludes('缺失路线 0'),
        pageTextIncludes('魔巫召唤开荒'),
        pageTextIncludes('不参与上方正式 BD 筛选')
      ]
    },
    {
      id: 'build-list-guide-filter-report-ready',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#guideFilter', value: 'report-ready' },
        { type: 'waitForDataset', key: 'buildListFilterGuide', value: 'report-ready' }
      ],
      asserts: [
        equals('buildListVisibleCount', '1'),
        equals('buildListFilterGuide', 'report-ready'),
        pageTextIncludes('攻略 报告可导出'),
        pageTextIncludes('攻略报告 1 可导出 / 0 待补'),
        pageTextIncludes('战术家')
      ]
    },
    {
      id: 'build-list-guide-filter-report-missing',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#guideFilter', value: 'report-missing' },
        { type: 'waitForDataset', key: 'buildListVisibleCount', value: '0' }
      ],
      asserts: [
        equals('buildListVisibleCount', '0'),
        equals('buildListFilterGuide', 'report-missing'),
        pageTextIncludes('攻略 报告待补'),
        pageTextIncludes('攻略报告 0 可导出 / 0 待补'),
        pageTextIncludes('没有符合筛选条件的 BD')
      ]
    },
    {
      id: 'build-list-guide-filter-complete',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#guideFilter', value: 'complete' },
        { type: 'waitForDataset', key: 'buildListFilterGuide', value: 'complete' }
      ],
      asserts: [
        equals('buildListVisibleCount', '1'),
        equals('buildListFilterGuide', 'complete'),
        pageTextIncludes('攻略 正文完整'),
        pageTextIncludes('攻略正文 1 完整 / 0 缺口'),
        pageTextIncludes('战术家')
      ]
    },
    {
      id: 'build-list-guide-filter-missing',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#guideFilter', value: 'missing' },
        { type: 'waitForDataset', key: 'buildListVisibleCount', value: '0' }
      ],
      asserts: [
        equals('buildListVisibleCount', '0'),
        equals('buildListFilterGuide', 'missing'),
        pageTextIncludes('攻略 正文有缺口'),
        pageTextIncludes('没有符合筛选条件的 BD')
      ]
    },
    {
      id: 'build-list-filters',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#routeFilter', value: 'manual-review' },
        { type: 'waitForDataset', key: 'buildListFilterRoute', value: 'manual-review' }
      ],
      asserts: [
        equals('buildListVisibleCount', '1'),
        equals('buildListFilterRoute', 'manual-review'),
        pageTextIncludes('战术家'),
        pageTextIncludes('需复核'),
        pageTextIncludes('攻略正文 1 完整 / 0 缺口')
      ]
    },
    {
      id: 'build-list-filters-empty',
      path: '/builds/index.html',
      waitFor: 'buildListCount',
      actions: [
        { type: 'selectOption', selector: '#routeFilter', value: 'ready' },
        { type: 'waitForDataset', key: 'buildListVisibleCount', value: '0' }
      ],
      asserts: [
        equals('buildListVisibleCount', '0'),
        equals('buildListFilterRoute', 'ready'),
        pageTextIncludes('没有符合筛选条件的 BD')
      ]
    },
    {
      id: 'tactician-guide-reader-default',
      path: '/builds/tactician-supporting-fire.html',
      waitFor: 'guideSummaryStages',
      asserts: [
        equals('guideViewMode', 'read'),
        equals('guideAdvancedPanelsVisible', 'false'),
        atLeast('guideAdvancedPanelCount', 9),
        pageTextIncludes('阅读版：隐藏详细数据'),
        pageTextIncludes('阅读版'),
        pageTextIncludes('完整数据')
      ]
    },
    {
      id: 'tactician-guide',
      path: '/builds/tactician-supporting-fire.html',
      waitFor: 'guideSummaryStages',
      actions: [
        { type: 'click', selector: '#fullGuideViewBtn' },
        { type: 'waitForDataset', key: 'guideViewMode', value: 'full' },
        { type: 'click', selector: '#copyGuideMarkdownBtn' },
        { type: 'waitForDataset', key: 'guideMarkdownCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('guideViewMode', 'full'),
        equals('guideAdvancedPanelsVisible', 'true'),
        atLeast('guideAdvancedPanelCount', 9),
        pageTextIncludes('阅读版'),
        pageTextIncludes('完整数据'),
        atLeast('guideSummaryStages', 5),
        atLeast('guideSummaryMaxNodes', 100),
        equals('guideArticleSections', '5'),
        equals('guideArticleCheckCount', '15'),
        equals('guideArticleLang', 'zh'),
        equals('guideMarkdownReady', 'true'),
        equals('guideMarkdownFormat', 'markdown'),
        atLeast('guideMarkdownLineCount', 90),
        atLeast('guideMarkdownSectionCount', 8),
        includes('guideMarkdownFileName', 'tactician-supporting-fire'),
        atLeast('guideMarkdownPreviewChars', 5000),
        equals('guideMarkdownCopyStatus', 'copied'),
        equals('guidePageLang', 'zh'),
        equals('guideArticleSourceStatus', 'manual-guide-article'),
        atLeast('guideStrategyFailureRows', 1),
        atLeast('executionPlanCount', 5),
        atLeast('executionPlanBuyFirstCount', 10),
        atLeast('executionPlanStopLineCount', 5),
        atLeast('executionPlanFallbackCount', 5),
        atLeast('executionPlanNextGateCount', 5),
        equals('stageDataCoverageStageCount', '5'),
        equals('stageDataCoverageRouteCount', '5'),
        equals('stageDataCoverageGearStageCount', '5'),
        equals('stageDataCoverageThresholdStageCount', '5'),
        equals('stageDataCoverageThresholdRowCount', '20'),
        equals('stageDataCoverageCraftStageCount', '2'),
        equals('stageDataCoverageCraftPlanCount', '4'),
        equals('stageDataCoverageSkillAcquisitionStageCount', '4'),
        equals('stageDataCoverageSkillProgressionStageCount', '5'),
        equals('stageDataCoverageFullyCoveredCount', '5'),
        atLeast('guideEvidenceSummaryCount', 1),
        atLeast('guideEvidencePendingCount', 1),
        atLeast('guideEvidenceProjectedRoutes', 1),
        equals('guideEvidenceHandTunedRoutes', '0'),
        equals('guideEvidenceMarketStatus', 'sample-not-live'),
        atLeast('stageTreeLinkCount', 5),
        atLeast('activeSkillCount', 1),
        atLeast('supportGemCount', 1),
        equals('skillOverviewCardCount', '3'),
        atLeast('skillOverviewCheckCount', 9),
        equals('skillOverviewLang', 'zh'),
        equals('skillOverviewSourceStatus', 'manual-guide-skill-flow'),
        atLeast('supportDecisionMatrixCount', 1),
        equals('minionSelectionGroupCount', '3'),
        atLeast('minionSelectionSkillRefs', 9),
        atLeast('minionSelectionSupportRefs', 6),
        equals('minionSelectionRuleCount', '3'),
        atLeast('minionSelectionChooseWhenCount', 9),
        equals('minionSelectionLang', 'zh'),
        equals('minionSelectionSourceStatus', 'manual-guide-minion-selection'),
        equals('skillTroubleshootingCount', '4'),
        atLeast('skillTroubleshootingCheckCount', 10),
        atLeast('skillTroubleshootingAddRefs', 8),
        atLeast('skillTroubleshootingCutRefs', 6),
        atLeast('skillAcquisitionCount', 1),
        atLeast('skillAcquisitionConfirmCount', 1),
        atLeast('skillAcquisitionSourceUseCount', 1),
        atLeast('skillAcquisitionFallbackCount', 1),
        equals('skillAcquisitionEvidenceRows', '0'),
        equals('skillAcquisitionEvidenceLang', 'zh'),
        equals('skillAcquisitionSnapshotStatus', 'poe2db-snapshot-v1'),
        equals('skillAcquisitionFromCount', '0'),
        includes('skillAcquisitionEvidenceCoverage', '/'),
        equals('skillAcquisitionBoundaryStatus', 'snapshot-evidence-not-vendor-act'),
        atLeast('skillSourceMatrixRows', 20),
        equals('skillSourceMatrixDetailCount', '0'),
        equals('skillSourceMatrixRequirementCount', '0'),
        equals('skillSourceMatrixFromCount', '0'),
        equals('skillSourceMatrixLang', 'zh'),
        atLeast('gearAvoidCount', 1),
        equals('gearOverviewCardCount', '4'),
        atLeast('gearOverviewCheckCount', 16),
        equals('gearOverviewSourceStatus', 'manual-guide-gear-flow'),
        equals('gearStatThresholdStageCount', '5'),
        atLeast('gearStatThresholdRowCount', 20),
        includes('gearStatThresholdSourceStatus', 'manual-guide-threshold'),
        equals('gearStatThresholdHighestPriority', '1'),
        equals('gearTroubleshootingCount', '4'),
        atLeast('gearTroubleshootingCheckCount', 16),
        atLeast('gearTroubleshootingActionCount', 10),
        atLeast('gearTroubleshootingAvoidCount', 10),
        equals('gearTroubleshootingStageCount', '4'),
        equals('craftingPlanStructuredCount', '4'),
        atLeast('craftingPlanPriorityModCount', 12),
        atLeast('craftingPlanMaterialCount', 12),
        atLeast('craftingPlanSuccessCheckCount', 10),
        atLeast('craftingPlanFallbackCount', 8),
        includes('craftingPlanSourceStatus', 'manual-guide-crafting')
      ],
      textIncludes: [
        '开荒正文速读',
        '攻略 Markdown',
        '已复制攻略 Markdown',
        '起什么职业',
        '什么时候转型',
        '技能和辅助怎么分',
        '装备怎么过渡',
        '什么时候制作',
        '这套技能到底怎么玩',
        '先分清技能本体和辅助宝石',
        '前期不是硬玩召唤',
        '辅助宝石按职责分配',
        '召唤物到底选哪几个',
        '精魂紧张时的删减顺序',
        '装备先解决短板，再追毕业件',
        '装备卡关处理',
        '换暗金后面板看着更强',
        '多数部位先买半成品'
      ]
    },
    {
      id: 'tactician-guide-skill-language',
      path: '/builds/tactician-supporting-fire.html',
      waitFor: 'skillSourceMatrixRows',
      actions: [
        { type: 'click', selector: '#fullGuideViewBtn' },
        { type: 'waitForDataset', key: 'guideViewMode', value: 'full' },
        { type: 'click', selector: '[data-guide-lang="en"]' },
        { type: 'waitForDataset', key: 'skillSourceMatrixLang', value: 'en' }
      ],
      asserts: [
        equals('guideViewMode', 'full'),
        equals('guideAdvancedPanelsVisible', 'true'),
        equals('skillSourceMatrixLang', 'en'),
        equals('guidePageLang', 'en'),
        equals('guideArticleLang', 'en'),
        equals('guideArticleSections', '5'),
        equals('guideMarkdownReady', 'true'),
        includes('guideMarkdownFileName', '-en.md'),
        atLeast('guideMarkdownLineCount', 90),
        equals('skillOverviewLang', 'en'),
        equals('skillOverviewCardCount', '3'),
        equals('minionSelectionLang', 'en'),
        equals('minionSelectionGroupCount', '3'),
        equals('minionSelectionSourceStatus', 'manual-guide-minion-selection'),
        equals('skillAcquisitionEvidenceLang', 'en'),
        equals('skillAcquisitionEvidenceRows', '0'),
        equals('skillAcquisitionSnapshotStatus', 'poe2db-snapshot-v1'),
        equals('skillAcquisitionBoundaryStatus', 'snapshot-evidence-not-vendor-act'),
        atLeast('skillSourceMatrixRows', 20),
        equals('skillSourceMatrixDetailCount', '0'),
        pageTextIncludes('Leveling Guide Read First'),
        pageTextIncludes('Guide Markdown'),
        pageTextIncludes('Copy Guide Markdown'),
        pageTextIncludes('Which Minions to Pick'),
        pageTextIncludes('Cut Order When Spirit Is Tight'),
        pageTextIncludes('PoE2DB Source'),
        pageTextIncludes('Snapshot evidence, not an actual character level or vendor act.')
      ]
    },
    {
      id: 'infernalist-draft-guide',
      path: '/builds/infernalist-minions.html',
      waitFor: 'infernalistDraftReady',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'click', selector: '#copyCommandsBtn' },
        { type: 'waitForDataset', key: 'infernalistDraftCommandCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyGuideReportBtn' },
        { type: 'waitForDataset', key: 'infernalistDraftGuideReportCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('infernalistDraftReady', 'true'),
        equals('infernalistDraftLang', 'en'),
        equals('infernalistDraftStatus', 'draft'),
        equals('infernalistDraftRegistered', 'false'),
        equals('infernalistDraftPlaceholderCount', '0'),
        equals('infernalistDraftGuideArticleReady', 'true'),
        equals('infernalistDraftGuideArticleSections', '5'),
        equals('infernalistDraftGuideArticleChecks', '15'),
        equals('infernalistDraftActiveSkillCount', '5'),
        equals('infernalistDraftSupportCount', '5'),
        equals('infernalistDraftSkillOverviewReady', 'true'),
        equals('infernalistDraftSkillOverviewCards', '3'),
        equals('infernalistDraftSkillOverviewChecks', '9'),
        equals('infernalistDraftGearReady', 'true'),
        equals('infernalistDraftGearOverviewCards', '3'),
        equals('infernalistDraftGearOverviewChecks', '12'),
        equals('infernalistDraftGearPriorityRows', '4'),
        equals('infernalistDraftEarlyGearPriorityRows', '2'),
        equals('infernalistDraftGearThresholdStages', '4'),
        equals('infernalistDraftGearThresholdRows', '12'),
        equals('infernalistDraftGearStagePlanRows', '4'),
        equals('infernalistDraftStageReady', 'true'),
        equals('infernalistDraftStageCount', '4'),
        equals('infernalistDraftStagePlaybooks', '4'),
        equals('infernalistDraftStageChecks', '16'),
        equals('infernalistDraftStageMistakes', '12'),
        equals('infernalistDraftExecutionRows', '4'),
        equals('infernalistDraftStagePassiveButtonCount', '4'),
        includes('infernalistDraftStagePassiveButtonStages', 'campaign-early'),
        includes('infernalistDraftStagePassiveButtonStages', 'minion-transition'),
        includes('infernalistDraftStagePassiveButtonStages', 'early-maps'),
        includes('infernalistDraftStagePassiveButtonStages', 'red-map-prep'),
        includes('infernalistDraftStagePassiveButtonLinks', 'passive-tree.html?route='),
        includes('infernalistDraftStagePassiveButtonLinks', 'infernalist-minions-red-map-prep.candidate.json'),
        equals('infernalistDraftRouteCandidateStageCount', '4'),
        equals('infernalistDraftRouteCandidateFileCount', '4'),
        equals('infernalistDraftRouteCandidateMissingCount', '0'),
        includes('infernalistDraftRouteCandidateFiles', 'tree/infernalist-minions-campaign-early.candidate.json'),
        includes('infernalistDraftRouteCandidateFiles', 'tree/infernalist-minions-minion-transition.candidate.json'),
        includes('infernalistDraftRouteCandidateFiles', 'tree/infernalist-minions-early-maps.candidate.json'),
        includes('infernalistDraftRouteCandidateFiles', 'tree/infernalist-minions-red-map-prep.candidate.json'),
        equals('infernalistDraftRouteCandidateMissingStages', ''),
        includes('infernalistDraftRouteCandidatePreviewLinks', 'passive-tree.html?route='),
        includes('infernalistDraftRouteCandidateValidateCommands', 'validate-route-candidate.mjs'),
        equals('infernalistDraftRouteCandidateScaffoldCommands', ''),
        equals('infernalistDraftCraftingReady', 'true'),
        equals('infernalistDraftCraftPlanCount', '4'),
        equals('infernalistDraftCraftStructuredCount', '4'),
        atLeast('infernalistDraftCraftPriorityModCount', 16),
        atLeast('infernalistDraftCraftMaterialCount', 12),
        atLeast('infernalistDraftCraftStepCount', 16),
        atLeast('infernalistDraftCraftSuccessCheckCount', 12),
        atLeast('infernalistDraftCraftFallbackCount', 8),
        includes('infernalistDraftCraftSourceStatus', 'draft-manual-crafting'),
        equals('infernalistDraftGuideReportReady', 'true'),
        equals('infernalistDraftGuideReportFormat', 'markdown'),
        atLeast('infernalistDraftGuideReportLineCount', 80),
        atLeast('infernalistDraftGuideReportSectionCount', 8),
        atLeast('infernalistDraftGuideReportPreviewChars', 3000),
        includes('infernalistDraftGuideReportFileName', 'guide-draft-s05-tree-4.5-infernalist-minions-en.md'),
        equals('infernalistDraftMinionSelectionReady', 'true'),
        equals('infernalistDraftMinionSelectionGroups', '3'),
        equals('infernalistDraftMinionSelectionSkillRefs', '5'),
        equals('infernalistDraftMinionSelectionSupportRefs', '7'),
        equals('infernalistDraftMinionSelectionChooseWhen', '9'),
        equals('infernalistDraftMinionSelectionRules', '3'),
        equals('infernalistDraftMissingModuleCount', '0'),
        equals('infernalistDraftVersion', 's05-tree-4.5'),
        equals('infernalistDraftGuideBoundary', 'unpublished-draft'),
        includes('infernalistDraftCommandText', 'validate-build-candidates.mjs'),
        includes('infernalistDraftCommandText', 'validate-build-candidate-readiness.mjs'),
        includes('infernalistDraftCommandText', 'validate-route-candidate.mjs'),
        includes('infernalistDraftCommandText', 'register-build.mjs'),
        equals('infernalistDraftCommandCopyStatus', 'copied'),
        equals('infernalistDraftGuideReportCopyStatus', 'copied'),
        pageTextIncludes('Draft, Not Published'),
        pageTextIncludes('Placeholders'),
        pageTextIncludes('Guide Article'),
        pageTextIncludes('When This Can Be Published'),
        pageTextIncludes('Skill Overview'),
        pageTextIncludes('Set One Main Damage Minion Link First'),
        pageTextIncludes('Gear Overview'),
        pageTextIncludes('Gear Slot Priorities'),
        pageTextIncludes('Gear Thresholds'),
        pageTextIncludes('Stage Guide'),
        pageTextIncludes('Candidate Passive Tree'),
        pageTextIncludes('Candidate route, manual review pending'),
        pageTextIncludes('Staged Passive Candidate Routes'),
        pageTextIncludes('Preview Candidate Tree'),
        pageTextIncludes('Existing candidate files'),
        pageTextIncludes('minion-transition'),
        pageTextIncludes('Copyable Execution Plan'),
        pageTextIncludes('Crafting Plans'),
        pageTextIncludes('Guide Report'),
        pageTextIncludes('Draft report, not published'),
        pageTextIncludes('Minion selection guide'),
        pageTextIncludes('Copy Commands')
      ]
    },
    {
      id: 'passive-tree-endgame',
      path: '/tools/passive-tree.html?build=tactician-supporting-fire&stage=endgame',
      waitFor: 'treeNodeCount',
      asserts: [
        equals('treeMode', 'manifest-route'),
        atLeast('treeNodeCount', 100),
        equals('treeBuild', 'tactician-supporting-fire'),
        equals('treeStage', 'endgame'),
        equals('treeExportReady', 'true'),
        equals('treeExportMode', 'manifest-route'),
        equals('treeExportBuild', 'tactician-supporting-fire'),
        equals('treeExportStage', 'endgame'),
        numericEquals('treeExportNodeCount', 'treeNodeCount'),
        includes('treeShareUrl', 'build=tactician-supporting-fire'),
        includes('treeShareUrl', 'stage=endgame')
      ]
    },
    {
      id: 'passive-tree-custom-nodes',
      path: '/tools/passive-tree.html?nodes=6077,27296&title=runtime-smoke',
      waitFor: 'treeNodeCount',
      asserts: [
        equals('treeMode', 'custom-nodes'),
        equals('treeNodeCount', '2'),
        equals('treeStage', 'query-nodes'),
        equals('treeExportReady', 'true'),
        equals('treeExportMode', 'custom-nodes'),
        equals('treeExportStage', 'query-nodes'),
        equals('treeExportNodeList', '6077,27296'),
        includes('treeShareUrl', 'nodes=6077%2C27296')
      ]
    },
    {
      id: 'passive-tree-route-file',
      path: '/tools/passive-tree.html?route=data/seasons/s05/tree/infernalist-minions-campaign-early.candidate.json',
      waitFor: 'treeNodeCount',
      actions: [
        { type: 'waitForDataset', key: 'treeRouteFileCanSwitch', value: 'true' },
        { type: 'selectOption', selector: '#stageSelect', value: 'red-map-prep' },
        { type: 'waitForDataset', key: 'treeStage', value: 'red-map-prep' },
        { type: 'waitForDataset', key: 'treeNodeCount', value: '36' }
      ],
      asserts: [
        equals('treeMode', 'route-file'),
        equals('treeNodeCount', '36'),
        equals('treeBuild', 'infernalist-minions'),
        equals('treeStage', 'red-map-prep'),
        equals('treeRouteFileStageCount', '4'),
        equals('treeRouteFileCanSwitch', 'true'),
        includes('treeRouteFileStageIds', 'campaign-early'),
        includes('treeRouteFileStageIds', 'minion-transition'),
        includes('treeRouteFileStageIds', 'early-maps'),
        includes('treeRouteFileStageIds', 'red-map-prep'),
        includes('treeRouteFileSelectedFile', 'infernalist-minions-red-map-prep.candidate.json'),
        equals('treeRouteOrigin', 'hand-tuned-manual'),
        equals('treeRouteHandTuned', 'true'),
        equals('treeRouteReviewStatus', '待复核'),
        atLeast('treeRouteReviewCheckCount', 3),
        equals('treeExportReady', 'true'),
        equals('treeExportMode', 'route-file'),
        equals('treeExportBuild', 'infernalist-minions'),
        equals('treeExportStage', 'red-map-prep'),
        includes('treeExportNodeList', '39935'),
        includes('treeShareUrl', 'route=data%2Fseasons%2Fs05%2Ftree%2Finfernalist-minions-red-map-prep.candidate.json')
      ]
    },
    {
      id: 'passive-tree-route-file-red-map-prep',
      path: '/tools/passive-tree.html?route=data/seasons/s05/tree/infernalist-minions-red-map-prep.candidate.json',
      waitFor: 'treeNodeCount',
      asserts: [
        equals('treeMode', 'route-file'),
        equals('treeNodeCount', '36'),
        equals('treeBuild', 'infernalist-minions'),
        equals('treeStage', 'red-map-prep'),
        equals('treeRouteFileStageCount', '4'),
        equals('treeRouteFileCanSwitch', 'true'),
        includes('treeRouteFileSelectedFile', 'infernalist-minions-red-map-prep.candidate.json'),
        equals('treeRouteOrigin', 'hand-tuned-manual'),
        equals('treeRouteHandTuned', 'true'),
        equals('treeRouteReviewStatus', '待复核'),
        atLeast('treeRouteReviewCheckCount', 3),
        equals('treeExportReady', 'true'),
        equals('treeExportMode', 'route-file'),
        equals('treeExportBuild', 'infernalist-minions'),
        equals('treeExportStage', 'red-map-prep'),
        includes('treeExportNodeList', '39935'),
        includes('treeShareUrl', 'route=data%2Fseasons%2Fs05%2Ftree%2Finfernalist-minions-red-map-prep.candidate.json')
      ]
    },
    {
      id: 'version-history',
      path: '/tools/version-history.html',
      waitFor: 'versionHistoryReady',
      actions: [
        { type: 'click', selector: '#copyVersionCommandsBtn' },
        { type: 'waitForDataset', key: 'versionHistoryCommandCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('versionHistoryReady', 'true'),
        atLeast('versionHistoryCount', 1),
        atLeast('versionHistoryBuildCount', 1),
        atLeast('versionHistoryRouteCount', 1),
        atLeast('versionHistoryRouteReviewCount', 1),
        atLeast('versionHistoryCompletenessVersionCount', 1),
        atLeast('versionHistoryCompletenessTotal', 1),
        equals('versionHistoryCompletenessMissing', '0'),
        atLeast('versionHistoryCompletenessReady', 1),
        equals('versionHistoryCommandCurrent', 's05-tree-4.5'),
        equals('versionHistoryCommandTarget', 's05-tree-4.6'),
        equals('versionHistoryCommandCount', '4'),
        equals('versionHistoryCommandSeason', 's05'),
        equals('versionHistoryCommandLineCount', '12'),
        includes('versionHistoryCommandText', 'create-version.mjs'),
        includes('versionHistoryCommandText', 'update-data.mjs'),
        includes('versionHistoryCommandText', 'diff-tree.mjs'),
        includes('versionHistoryCommandText', 'generate-version-log.mjs'),
        includes('versionHistoryCommandText', 'switch-current.mjs'),
        includes('versionHistoryCommandText', '--write'),
        equals('versionHistoryCommandCopyStatus', 'copied'),
        atLeast('versionHistoryNinjaExampleCount', 2),
        numericEquals('versionHistoryNinjaExampleOk', 'versionHistoryNinjaExampleCount'),
        atLeast('versionHistoryNinjaExamplePobXmlCount', 1),
        equals('versionHistoryNinjaArchiveCount', '1'),
        equals('versionHistoryNinjaArchiveReadyCount', '1'),
        equals('versionHistoryNinjaArchiveMatchedCount', '1'),
        equals('versionHistoryNinjaArchiveNeedsReviewCount', '0'),
        equals('versionHistoryNinjaArchiveSourceUnknownCount', '0'),
        includes('versionHistoryNinjaArchiveFormats', 'json'),
        equals('versionHistoryGearThresholdStageCount', '5'),
        equals('versionHistoryGearThresholdRowCount', '20'),
        includes('versionHistoryGearThresholdSourceStatus', 'manual-guide-threshold'),
        equals('versionHistoryCraftPlanCount', '4'),
        equals('versionHistoryCraftStructuredCount', '4'),
        includes('versionHistoryCraftSourceStatus', 'manual-guide-crafting'),
        equals('versionHistoryMarketCandidateIndexSchema', '1'),
        equals('versionHistoryMarketCandidateCount', '0'),
        equals('versionHistoryMarketCandidateReadyCount', '0'),
        equals('versionHistoryMarketCandidateGemCount', '0'),
        equals('versionHistoryMarketCandidateHideoutCount', '0'),
        equals('versionHistoryBuildCandidateSchema', '1'),
        equals('versionHistoryBuildCandidateCount', '1'),
        equals('versionHistoryBuildCandidateAvailableCount', '1'),
        equals('versionHistoryBuildCandidateRegisteredCount', '0'),
        equals('versionHistoryBuildCandidateDraftCount', '1'),
        equals('versionHistoryBuildCandidateDraftFileCount', '1'),
        equals('versionHistoryBuildCandidateDraftPlaceholderCount', '0'),
        equals('versionHistoryBuildCandidateDraftMinionSelectionGroups', '3'),
        equals('versionHistoryBuildCandidateDraftMinionSelectionSkillRefs', '5'),
        equals('versionHistoryBuildCandidateDraftMinionSelectionSupportRefs', '7'),
        equals('versionHistoryBuildCandidateDraftMinionSelectionChooseWhen', '9'),
        equals('versionHistoryBuildCandidateDraftMinionSelectionRules', '3'),
        equals('versionHistoryBuildCandidateDraftGuideReportReadyCount', '1'),
        equals('versionHistoryBuildCandidateDraftModuleCount', '10'),
        equals('versionHistoryBuildCandidateDraftMissingModuleCount', '0'),
        equals('versionHistoryBuildCandidateDraftRouteStageCount', '4'),
        equals('versionHistoryBuildCandidateDraftRouteBoundCount', '0'),
        equals('versionHistoryBuildCandidateDraftRouteMissingCount', '4'),
        equals('versionHistoryBuildCandidateDraftRouteCandidateFileCount', '4'),
        equals('versionHistoryBuildCandidateDraftRouteCandidateMissingFileCount', '0'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateStages', 'campaign-early'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateStages', 'minion-transition'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateStages', 'early-maps'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateStages', 'red-map-prep'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateFiles', 'infernalist-minions-campaign-early.candidate.json'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateFiles', 'infernalist-minions-minion-transition.candidate.json'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateFiles', 'infernalist-minions-early-maps.candidate.json'),
        includes('versionHistoryBuildCandidateDraftRouteCandidateFiles', 'infernalist-minions-red-map-prep.candidate.json'),
        includes('versionHistoryBuildCandidateStatuses', 'draft'),
        includes('versionHistoryBuildCandidateSourceTypes', 'manual-platform-backlog'),
        pageTextIncludes('BD 草稿 1/1'),
        pageTextIncludes('草稿占位 0'),
        pageTextIncludes('草稿召唤物 3 组 / 规则 3'),
        pageTextIncludes('草稿报告 1 可导出'),
        pageTextIncludes('草稿缺口 0 / 10'),
        pageTextIncludes('草稿路线 0 / 4 已绑定'),
        pageTextIncludes('候选路线文件 4 / 4'),
        includes('versionHistorySkillCatalogSourceTypes', 'poe2db-snapshot-v1'),
        equals('versionHistorySkillCatalogEntryCount', '964'),
        equals('versionHistorySkillCatalogActiveCount', '407'),
        equals('versionHistorySkillCatalogSupportCount', '557'),
        equals('versionHistorySkillCatalogDetailCount', '0'),
        equals('versionHistorySkillCatalogVerifiedCount', '964'),
        equals('versionHistorySkillCatalogBoundaryStatuses', 'skill-data-not-live-price'),
        equals('versionHistoryGuideCompleteCount', '1'),
        equals('versionHistoryGuideMissingCount', '0'),
        equals('versionHistoryGuideReportReadyCount', '1'),
        equals('versionHistoryGuideSkillOverviewCards', '3'),
        equals('versionHistoryGuideSkillOverviewChecks', '9'),
        equals('versionHistoryGuideMinionSelectionGroups', '3'),
        equals('versionHistoryGuideMinionSelectionRules', '3'),
        equals('versionHistoryGuideGearOverviewCards', '4'),
        equals('versionHistoryGuideGearOverviewChecks', '16'),
        equals('versionHistoryGuideStagePlaybooks', '5'),
        equals('versionHistoryGuideExecutionStages', '5'),
        includes('versionHistoryGuideSourceStatus', 'manual-guide-article'),
        includes('versionHistoryGuideSourceStatus', 'manual-guide-skill-flow'),
        includes('versionHistoryGuideSourceStatus', 'manual-guide-gear-flow'),
        pageTextIncludes('技能目录 964'),
        pageTextIncludes('主动 407 / 辅助 557'),
        pageTextIncludes('攻略正文 1 完整 / 0 缺口'),
        pageTextIncludes('攻略报告 1 可导出'),
        pageTextIncludes('技能总览 3 卡 / 9 检查'),
        pageTextIncludes('装备总览 4 卡 / 16 检查'),
        pageTextIncludes('BD 候选 1 / 可接入 1'),
        pageTextIncludes('BD 候选：builds/candidates.json'),
        pageTextIncludes('版本操作命令'),
        pageTextIncludes('复制版本操作命令'),
        pageTextIncludes('已复制版本操作命令'),
        pageTextIncludes('node scripts/create-version.mjs --id s05-tree-4.6'),
        pageTextIncludes('node scripts/diff-tree.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6'),
        pageTextIncludes('node scripts/switch-current.mjs --id s05-tree-4.6 --write')
      ]
    },
    {
      id: 'data-update',
      path: '/tools/data-update.html',
      waitFor: 'dataUpdateReady',
      actions: [
        { type: 'click', selector: '#copyLocalCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateLocalCommandCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyRouteArchiveCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateRouteArchiveCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyMarketRawTemplateCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateMarketRawTemplateCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyNinjaArchiveCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateNinjaArchiveCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copySkillCatalogArchiveCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateSkillCatalogArchiveCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyBuildOnboardingCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateBuildOnboardingCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyBuildCandidateRouteScaffoldCommandsBtn' },
        { type: 'waitForDataset', key: 'dataUpdateBuildCandidateRouteScaffoldCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('dataUpdateReady', 'true'),
        equals('dataUpdateVersion', 's05-tree-4.5'),
        oneOf('dataUpdateVersionSource', ['saved-selection', 'versions-current', 'resolved-default']),
        equals('dataUpdateDataRoot', 'data/seasons/s05'),
        atLeast('dataUpdateLocalCommandLineCount', 30),
        includes('dataUpdateLocalCommandText', 'serve.mjs'),
        includes('dataUpdateLocalCommandText', 'create-version.mjs'),
        includes('dataUpdateLocalCommandText', 'validate-suite.mjs'),
        includes('dataUpdateLocalCommandText', 'scaffold-route.mjs'),
        includes('dataUpdateLocalCommandText', 'validate-route-candidate.mjs'),
        includes('dataUpdateLocalCommandText', 'validate-build-candidate-routes.mjs'),
        includes('dataUpdateLocalCommandText', 'validate-build-candidate-readiness.mjs'),
        includes('dataUpdateLocalCommandText', 'archive-ninja-import.mjs'),
        includes('dataUpdateLocalCommandText', '--write'),
        equals('dataUpdateLocalCommandCopyStatus', 'copied'),
        pageTextIncludes('复制本地命令'),
        pageTextIncludes('已复制本地命令'),
        atLeast('routeQualityTotal', 1),
        atLeast('routeQualityPending', 1),
        equals('dataUpdateRouteArchiveCandidateCount', '4'),
        equals('dataUpdateRouteArchiveCommandCount', '8'),
        includes('dataUpdateRouteArchiveCommandText', 'archive-route.mjs'),
        includes('dataUpdateRouteArchiveCommandText', '--write'),
        equals('dataUpdateRouteArchiveCopyStatus', 'copied'),
        includes('dataUpdateRouteArchiveStages', 'campaign-early'),
        pageTextIncludes('手调路线归档'),
        pageTextIncludes('archive-route.mjs'),
        pageTextIncludes('已复制路线归档命令'),
        equals('dataUpdateBuildGuideCompleteCount', '1'),
        equals('dataUpdateBuildGuideMissingCount', '0'),
        equals('dataUpdateBuildGuideReportReadyCount', '1'),
        equals('dataUpdateBuildGuideSkillOverviewCards', '3'),
        equals('dataUpdateBuildGuideSkillOverviewChecks', '9'),
        equals('dataUpdateBuildGuideMinionSelectionGroups', '3'),
        atLeast('dataUpdateBuildGuideMinionSelectionSkillRefs', 9),
        atLeast('dataUpdateBuildGuideMinionSelectionSupportRefs', 6),
        equals('dataUpdateBuildGuideMinionSelectionRules', '3'),
        equals('dataUpdateBuildGuideGearOverviewCards', '4'),
        equals('dataUpdateBuildGuideGearOverviewChecks', '16'),
        equals('dataUpdateBuildGuideStagePlaybooks', '5'),
        equals('dataUpdateBuildGuideExecutionStages', '5'),
        includes('dataUpdateBuildGuideSourceStatus', 'manual-guide-article'),
        includes('dataUpdateBuildGuideSourceStatus', 'manual-guide-skill-flow'),
        includes('dataUpdateBuildGuideSourceStatus', 'manual-guide-gear-flow'),
        pageTextIncludes('攻略报告'),
        pageTextIncludes('报告导出'),
        pageTextIncludes('guide-markdown-report'),
        equals('dataUpdateBuildOnboardingCommandCount', '11'),
        equals('dataUpdateBuildOnboardingSourceFile', 'builds/candidates.json'),
        equals('dataUpdateBuildOnboardingSourceType', 'manual-platform-backlog'),
        equals('dataUpdateBuildOnboardingSchema', '1'),
        equals('dataUpdateBuildOnboardingCandidateCount', '1'),
        equals('dataUpdateBuildOnboardingAvailableCount', '1'),
        equals('dataUpdateBuildOnboardingRegisteredCount', '0'),
        equals('dataUpdateBuildOnboardingDraftCount', '1'),
        equals('dataUpdateBuildOnboardingDraftFileFoundCount', '1'),
        equals('dataUpdateBuildOnboardingDraftGuideFoundCount', '1'),
        equals('dataUpdateBuildOnboardingDraftPlaceholderCount', '0'),
        equals('dataUpdateBuildOnboardingDraftMinionSelectionGroups', '3'),
        equals('dataUpdateBuildOnboardingDraftMinionSelectionSkillRefs', '5'),
        equals('dataUpdateBuildOnboardingDraftMinionSelectionSupportRefs', '7'),
        equals('dataUpdateBuildOnboardingDraftMinionSelectionChooseWhen', '9'),
        equals('dataUpdateBuildOnboardingDraftMinionSelectionRules', '3'),
        equals('dataUpdateBuildOnboardingDraftGuideReportReadyCount', '1'),
        equals('dataUpdateBuildOnboardingDraftModuleCount', '10'),
        equals('dataUpdateBuildOnboardingDraftMissingModuleCount', '0'),
        equals('dataUpdateBuildOnboardingDraftRouteStageCount', '4'),
        equals('dataUpdateBuildOnboardingDraftRouteBoundCount', '0'),
        equals('dataUpdateBuildOnboardingDraftRouteMissingCount', '4'),
        includes('dataUpdateBuildOnboardingDraftFileStatuses', 'found'),
        includes('dataUpdateBuildOnboardingDraftGuideStatuses', 'found'),
        equals('dataUpdateBuildReadinessMaterialReadyCount', '1'),
        equals('dataUpdateBuildReadinessReviewReadyCount', '1'),
        equals('dataUpdateBuildReadinessPublishReadyCount', '0'),
        equals('dataUpdateBuildReadinessManifestPublishedCount', '0'),
        equals('dataUpdateBuildReadinessRegisteredBuildCount', '0'),
        equals('dataUpdateBuildReadinessRouteCandidateFileCount', '4'),
        equals('dataUpdateBuildReadinessRouteCandidateFileFoundCount', '4'),
        equals('dataUpdateBuildReadinessRouteCandidateHandTunedCount', '4'),
        equals('dataUpdateBuildReadinessManifestRouteCount', '0'),
        includes('dataUpdateBuildReadinessBlockedBy', '未登记正式 BD'),
        includes('dataUpdateBuildReadinessBlockedBy', '未登记正式路线'),
        pageTextIncludes('发布审计'),
        pageTextIncludes('素材 ready'),
        pageTextIncludes('复核 ready'),
        pageTextIncludes('正式发布 blocked'),
        includes('dataUpdateBuildOnboardingCommandText', 'scaffold-build.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'register-build.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'validate-build-candidates.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'validate-build-candidate-routes.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'validate-build-candidate-readiness.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'validate-builds.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'validate-build-guides.mjs'),
        includes('dataUpdateBuildOnboardingCommandText', 'infernalist-minions'),
        includes('dataUpdateBuildOnboardingCommandText', '--from-candidate'),
        includes('dataUpdateBuildOnboardingCommandText', '--write'),
        includes('dataUpdateBuildOnboardingCandidateIds', 'infernalist-minions'),
        equals('dataUpdateBuildOnboardingCopyStatus', 'copied'),
        equals('dataUpdateBuildCandidateRouteScaffoldStageCount', '0'),
        equals('dataUpdateBuildCandidateRouteExistingCount', '4'),
        equals('dataUpdateBuildCandidateRouteMissingCandidateFileCount', '0'),
        equals('dataUpdateBuildCandidateRouteScaffoldCommandCount', '4'),
        includes('dataUpdateBuildCandidateRouteScaffoldBuildIds', 'infernalist-minions'),
        includes('dataUpdateBuildCandidateRouteExistingStages', 'campaign-early'),
        includes('dataUpdateBuildCandidateRouteExistingStages', 'minion-transition'),
        includes('dataUpdateBuildCandidateRouteExistingStages', 'early-maps'),
        includes('dataUpdateBuildCandidateRouteExistingStages', 'red-map-prep'),
        includes('dataUpdateBuildCandidateRouteExistingFiles', 'infernalist-minions-campaign-early.candidate.json'),
        includes('dataUpdateBuildCandidateRouteExistingFiles', 'infernalist-minions-minion-transition.candidate.json'),
        includes('dataUpdateBuildCandidateRouteExistingFiles', 'infernalist-minions-early-maps.candidate.json'),
        includes('dataUpdateBuildCandidateRouteExistingFiles', 'infernalist-minions-red-map-prep.candidate.json'),
        equals('dataUpdateBuildCandidateRouteScaffoldStages', ''),
        includes('dataUpdateBuildCandidateRouteScaffoldCommandText', 'validate-route-candidate.mjs'),
        includes('dataUpdateBuildCandidateRouteScaffoldCommandText', 'infernalist-minions'),
        includes('dataUpdateBuildCandidateRouteScaffoldCommandText', 'infernalist-minions-red-map-prep.candidate.json'),
        includes('dataUpdateBuildCandidateRouteScaffoldPreviewLinks', 'tools/passive-tree.html?route='),
        includes('dataUpdateBuildCandidateRouteScaffoldPreviewLinks', 'infernalist-minions-campaign-early.candidate.json'),
        includes('dataUpdateBuildCandidateRouteScaffoldPreviewLinks', 'infernalist-minions-red-map-prep.candidate.json'),
        equals('dataUpdateBuildCandidateRouteScaffoldCopyStatus', 'copied'),
        pageTextIncludes('新增 BD 命令'),
        pageTextIncludes('候选路线准备'),
        pageTextIncludes('预览候选天赋树'),
        pageTextIncludes('已复制候选路线命令'),
        pageTextIncludes('草稿：'),
        pageTextIncludes('页面'),
        pageTextIncludes('占位符 0'),
        pageTextIncludes('报告 可导出'),
        pageTextIncludes('缺口 0/10'),
        pageTextIncludes('路线 0/4 已绑定'),
        pageTextIncludes('召唤物选择 3 组、技能 5、辅助 7、规则 3'),
        pageTextIncludes('复制新增 BD 命令'),
        pageTextIncludes('已复制新增 BD 命令'),
        equals('dataUpdateBuildGearThresholdStageCount', '5'),
        equals('dataUpdateBuildGearThresholdRowCount', '20'),
        equals('dataUpdateBuildGearThresholdMissing', '0'),
        includes('dataUpdateBuildGearThresholdSourceStatus', 'manual-guide-threshold'),
        equals('dataUpdateBuildCraftPlanCount', '4'),
        equals('dataUpdateBuildCraftStructuredCount', '4'),
        equals('dataUpdateBuildCraftMissing', '0'),
        includes('dataUpdateBuildCraftSourceStatus', 'manual-guide-crafting'),
        equals('dataUpdateMarketGemAvgConfidence', '0.00'),
        equals('dataUpdateMarketGemMinBuyDepth', '0'),
        equals('dataUpdateMarketGemMinSellDepth', '0'),
        equals('dataUpdateMarketHideoutAvgConfidence', '0.00'),
        equals('dataUpdateMarketHideoutMinBuyDepth', '0'),
        equals('dataUpdateMarketHideoutMinSellDepth', '0'),
        equals('dataUpdateMarketExampleGemStatus', 'ok'),
        equals('dataUpdateMarketExampleGemAvgConfidence', '78.00'),
        equals('dataUpdateMarketExampleGemMinBuyDepth', '12'),
        equals('dataUpdateMarketExampleGemMinSellDepth', '9'),
        equals('dataUpdateMarketExampleHideoutStatus', 'ok'),
        equals('dataUpdateMarketExampleHideoutAvgConfidence', '74.00'),
        equals('dataUpdateMarketExampleHideoutMinBuyDepth', '10'),
        equals('dataUpdateMarketExampleHideoutMinSellDepth', '16'),
        equals('dataUpdateMarketRawGemStatus', 'ok'),
        equals('dataUpdateMarketRawGemEntryCount', '1'),
        equals('dataUpdateMarketRawGemMinBuyDepth', '12'),
        equals('dataUpdateMarketRawGemMinSellDepth', '9'),
        equals('dataUpdateMarketRawHideoutStatus', 'ok'),
        equals('dataUpdateMarketRawHideoutEntryCount', '1'),
        equals('dataUpdateMarketRawHideoutMinBuyDepth', '10'),
        equals('dataUpdateMarketRawHideoutMinSellDepth', '16'),
        equals('dataUpdateMarketRawTemplateCommandCount', '4'),
        includes('dataUpdateMarketRawTemplateCommandText', 'normalize-market-snapshot.mjs'),
        includes('dataUpdateMarketRawTemplateCommandText', 'raw-gem-flips-v1.example.json'),
        includes('dataUpdateMarketRawTemplateCommandText', '--write'),
        equals('dataUpdateMarketRawTemplateCopyStatus', 'copied'),
        equals('dataUpdateMarketCandidateIndexSchema', '1'),
        equals('dataUpdateMarketCandidateCount', '0'),
        equals('dataUpdateMarketCandidateReadyCount', '0'),
        equals('dataUpdateMarketCandidateGemCount', '0'),
        equals('dataUpdateMarketCandidateHideoutCount', '0'),
        equals('dataUpdateMarketCandidateArchiveCommandCount', '0'),
        equals('dataUpdateMarketCandidateArchiveCommandText', ''),
        equals('dataUpdateMarketCandidateArchiveCopyStatus', ''),
        equals('dataUpdateMarketCandidateArchiveReadyKinds', ''),
        equals('dataUpdateMarketCandidatePreviewCount', '0'),
        equals('dataUpdateMarketCandidatePreviewEntryCount', '0'),
        equals('dataUpdateMarketCandidatePreviewErrorCount', '0'),
        pageTextIncludes('原始快照模板'),
        pageTextIncludes('raw-gem-flips-v1.example.json'),
        pageTextIncludes('raw-hideout-flips-v1.example.json'),
        pageTextIncludes('写入候选'),
        pageTextIncludes('已复制 raw 模板命令'),
        pageTextIncludes('候选明细预览'),
        pageTextIncludes('当前没有可预览候选明细'),
        pageTextIncludes('候选归档命令'),
        pageTextIncludes('当前没有可归档候选'),
        equals('dataUpdateSkillCatalogSourceType', 'poe2db-snapshot-v1'),
        equals('dataUpdateSkillCatalogEntryCount', '964'),
        equals('dataUpdateSkillCatalogActiveCount', '407'),
        equals('dataUpdateSkillCatalogSupportCount', '557'),
        equals('dataUpdateSkillCatalogDetailCount', '0'),
        equals('dataUpdateSkillCatalogVerifiedCount', '964'),
        equals('dataUpdateSkillCatalogNeedsReviewCount', '0'),
        equals('dataUpdateSkillCatalogFromCount', '407'),
        equals('dataUpdateSkillCatalogRequirementCount', '0'),
        equals('dataUpdateSkillCatalogBoundaryStatus', 'skill-data-not-live-price'),
        equals('dataUpdateSkillCatalogArchiveCommandCount', '3'),
        includes('dataUpdateSkillCatalogArchiveCommandText', 'fetch-poe2db-skill-details.mjs'),
        includes('dataUpdateSkillCatalogArchiveCommandText', 'archive-skill-catalog.mjs'),
        includes('dataUpdateSkillCatalogArchiveCommandText', '/tmp/poe2db-skill-catalog-details.json'),
        includes('dataUpdateSkillCatalogArchiveCommandText', '--write'),
        includes('dataUpdateSkillCatalogArchiveCandidateKeys', 'poe2db-details-next'),
        equals('dataUpdateSkillCatalogArchiveCopyStatus', 'copied'),
        pageTextIncludes('当前技能质量'),
        pageTextIncludes('主动 407'),
        pageTextIncludes('辅助 557'),
        pageTextIncludes('复制技能归档命令'),
        pageTextIncludes('已复制技能归档命令'),
        equals('dataUpdateNinjaArchiveCount', '1'),
        equals('dataUpdateNinjaArchiveReadyCount', '1'),
        equals('dataUpdateNinjaArchiveMatchedCount', '1'),
        equals('dataUpdateNinjaArchiveNeedsReviewCount', '0'),
        equals('dataUpdateNinjaArchiveSourceUnknownCount', '0'),
        includes('dataUpdateNinjaArchiveFormats', 'json'),
        equals('dataUpdateNinjaArchiveCommandCount', '4'),
        includes('dataUpdateNinjaArchiveCommandText', 'archive-ninja-import.mjs'),
        includes('dataUpdateNinjaArchiveCommandText', 'parsed-import-with-analysis.example.json'),
        includes('dataUpdateNinjaArchiveCommandText', 'parsed-raw-pob-xml.example.json'),
        includes('dataUpdateNinjaArchiveCommandText', '--write'),
        includes('dataUpdateNinjaArchiveCandidateKeys', 'example-tactician'),
        includes('dataUpdateNinjaArchiveCandidateKeys', 'raw-pob-xml'),
        equals('dataUpdateNinjaArchiveCopyStatus', 'copied'),
        pageTextIncludes('候选归档命令'),
        pageTextIncludes('复制忍者归档命令'),
        pageTextIncludes('已复制忍者归档命令'),
        equals('dataUpdateNinjaSchemaStatus', 'ok'),
        atLeast('dataUpdateNinjaParserHintCount', 5),
        includes('dataUpdateNinjaParserHints', 'pob-xml'),
        includes('dataUpdateNinjaParserHints', 'pob-compressed-code'),
        atLeast('dataUpdateNinjaExampleCount', 2),
        numericEquals('dataUpdateNinjaExampleOk', 'dataUpdateNinjaExampleCount'),
        atLeast('dataUpdateNinjaExamplePobXmlCount', 1),
        oneOf('dataUpdateMarketGemFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown']),
        oneOf('dataUpdateMarketHideoutFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown'])
      ]
    },
    {
      id: 'route-review',
      path: '/tools/route-review.html',
      waitFor: 'routeReviewReady',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'routeReviewLang', value: 'en' },
        { type: 'selectOption', selector: '#routeFilter', value: 'mismatch' },
        { type: 'waitForDataset', key: 'routeReviewFilterStatus', value: 'mismatch' },
        { type: 'click', selector: '#copyRouteReviewCommandsBtn' },
        { type: 'waitForDataset', key: 'routeReviewCommandCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyRouteReviewReportBtn' },
        { type: 'waitForDataset', key: 'routeReviewReportCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('routeReviewReady', 'true'),
        equals('routeReviewLang', 'en'),
        equals('routeReviewVersion', 's05-tree-4.5'),
        equals('routeReviewTotal', '5'),
        equals('routeReviewPending', '5'),
        equals('routeReviewHandTuned', '0'),
        equals('routeReviewReplaceable', '4'),
        equals('routeReviewManualReview', '1'),
        equals('routeReviewReviewCount', '5'),
        equals('routeReviewReviewMissing', '0'),
        equals('routeReviewMismatchCount', '0'),
        equals('routeReviewNodeMismatch', '0'),
        equals('routeReviewMetaMismatch', '0'),
        equals('routeReviewPriorityCount', '5'),
        equals('routeReviewPriorityTopStage', 'red-maps'),
        includes('routeReviewPriorityStages', 'campaign-early'),
        includes('routeReviewPriorityReasons', 'Replaceable projected route'),
        equals('routeCandidateStageCount', '4'),
        equals('routeCandidateFileCount', '4'),
        equals('routeCandidateMissingCount', '0'),
        equals('routeCandidateHandTunedCount', '4'),
        equals('routeCandidateManualReviewCount', '4'),
        equals('routeCandidateNodeCount', '74'),
        includes('routeCandidateStages', 'infernalist-minions:campaign-early'),
        includes('routeCandidateStages', 'infernalist-minions:minion-transition'),
        includes('routeCandidateStages', 'infernalist-minions:early-maps'),
        includes('routeCandidateStages', 'infernalist-minions:red-map-prep'),
        includes('routeCandidateFiles', 'infernalist-minions-campaign-early.candidate.json'),
        includes('routeCandidateFiles', 'infernalist-minions-red-map-prep.candidate.json'),
        includes('routeCandidatePreviewLinks', 'passive-tree.html?route='),
        includes('routeCandidatePreviewLinks', 'infernalist-minions-campaign-early.candidate.json'),
        includes('routeCandidatePreviewLinks', 'infernalist-minions-red-map-prep.candidate.json'),
        includes('routeCandidateValidateCommands', 'validate-route-candidate.mjs'),
        includes('routeCandidateValidateCommands', '--build infernalist-minions'),
        equals('routeReviewCommandCount', '14'),
        equals('routeReviewCandidateCommandCount', '6'),
        equals('routeReviewArchiveCommandCount', '8'),
        includes('routeReviewCandidateCommandBuilds', 'infernalist-minions'),
        includes('routeReviewCommandText', 'validate-build-candidate-routes.mjs'),
        includes('routeReviewCommandText', 'validate-route-candidate.mjs'),
        includes('routeReviewCommandText', '--build infernalist-minions'),
        includes('routeReviewCommandText', 'archive-route.mjs'),
        includes('routeReviewCommandText', 'campaign-early'),
        includes('routeReviewCommandText', 'red-map-prep'),
        includes('routeReviewCommandText', '--write'),
        includes('routeReviewCommandStages', 'campaign-early'),
        equals('routeReviewCommandCopyStatus', 'copied'),
        equals('routeReviewReportReady', 'true'),
        equals('routeReviewReportFormat', 'markdown'),
        atLeast('routeReviewReportLineCount', 38),
        atLeast('routeReviewReportSectionCount', 5),
        includes('routeReviewReportFileName', 's05-tree-4.5'),
        atLeast('routeReviewReportPreviewChars', 1800),
        equals('routeReviewReportCandidateRows', '4'),
        equals('routeReviewReportCandidateFiles', '4'),
        equals('routeReviewReportCandidateMissing', '0'),
        includes('routeReviewReportPreview', 'passive-tree.html?build=tactician-supporting-fire'),
        includes('routeReviewReportPreview', 'passive-tree.html?route=data%2Fseasons%2Fs05%2Ftree%2Finfernalist-minions-campaign-early.candidate.json'),
        includes('routeReviewReportPreview', 'passive-tree.html?route=data%2Fseasons%2Fs05%2Ftree%2Finfernalist-minions-red-map-prep.candidate.json'),
        equals('routeReviewReportCopyStatus', 'copied'),
        equals('routeReviewFilterStatus', 'mismatch'),
        equals('routeReviewVisibleCount', '0'),
        pageTextIncludes('Route Review'),
        pageTextIncludes('Hand-Tuning Priority Queue'),
        pageTextIncludes('Unregistered Candidate Routes'),
        pageTextIncludes('Preview Candidate Tree'),
        pageTextIncludes('infernalist-minions-red-map-prep.candidate.json'),
        pageTextIncludes('Suggested action'),
        pageTextIncludes('Route Review Markdown'),
        pageTextIncludes('Route Review Commands'),
        includes('routeReviewReportPreview', 'Route Review Commands'),
        pageTextIncludes('Copied Markdown report'),
        pageTextIncludes('Copied route review commands'),
        pageTextIncludes('No routes match the current filters.')
      ]
    },
    {
      id: 'market-review',
      path: '/tools/market-review.html',
      waitFor: 'marketReviewReady',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'marketReviewLang', value: 'en' },
        { type: 'click', selector: '#copyMarketReviewCommandsBtn' },
        { type: 'waitForDataset', key: 'marketReviewCommandCopyStatus', value: 'copied' },
        { type: 'click', selector: '#copyMarketReviewReportBtn' },
        { type: 'waitForDataset', key: 'marketReviewReportCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('marketReviewReady', 'true'),
        equals('marketReviewLang', 'en'),
        equals('marketReviewUiLocalized', 'true'),
        equals('marketReviewVersion', 's05-tree-4.5'),
        equals('marketReviewActiveSnapshotCount', '2'),
        equals('marketReviewCandidateIndexSchema', '1'),
        equals('marketReviewCandidateCount', '0'),
        equals('marketReviewCandidateReadyCount', '0'),
        equals('marketReviewCandidateGemCount', '0'),
        equals('marketReviewCandidateHideoutCount', '0'),
        equals('marketReviewGemSourceType', 'sample-manual-seed'),
        equals('marketReviewHideoutSourceType', 'sample-manual-seed'),
        equals('marketReviewGemFreshnessStatus', 'sample-not-live'),
        equals('marketReviewHideoutFreshnessStatus', 'sample-not-live'),
        equals('marketReviewAvgConfidence', '0.00'),
        equals('marketReviewMinBuyDepth', '0'),
        equals('marketReviewMinSellDepth', '0'),
        equals('marketReviewCommandCount', '6'),
        equals('marketReviewArchiveCommandCount', '0'),
        includes('marketReviewCommandText', 'validate-market.mjs'),
        includes('marketReviewCommandText', 'normalize-market-snapshot.mjs'),
        includes('marketReviewCommandText', 'raw-gem-flips-v1.example.json'),
        includes('marketReviewCommandText', 'raw-hideout-flips-v1.example.json'),
        equals('marketReviewCommandCopyStatus', 'copied'),
        equals('marketReviewReportReady', 'true'),
        equals('marketReviewReportFormat', 'markdown'),
        atLeast('marketReviewReportLineCount', 24),
        equals('marketReviewReportSectionCount', '3'),
        includes('marketReviewReportPreview', 'Market Snapshot Review'),
        includes('marketReviewReportPreview', 'sample-manual-seed'),
        includes('marketReviewReportPreview', 'examples/*.example.json'),
        includes('marketReviewReportPreview', 'validate-market.mjs'),
        equals('marketReviewReportCopyStatus', 'copied'),
        pageTextIncludes('Market Snapshot Review'),
        pageTextIncludes('No candidate snapshots yet'),
        pageTextIncludes('sample-not-live'),
        pageTextIncludes('Market Review Commands'),
        pageTextIncludes('Copied market review commands'),
        pageTextIncludes('Copied Markdown report')
      ]
    },
    {
      id: 'skill-catalog',
      path: '/tools/skill-catalog.html',
      waitFor: 'skillCatalogEntryCount',
      asserts: [
        atLeast('skillCatalogEntryCount', 1),
        atLeast('skillCatalogActiveCount', 1),
        atLeast('skillCatalogSupportCount', 1),
        equals('skillCatalogDetailCount', '0'),
        equals('skillCatalogVersion', 's05-tree-4.5'),
        equals('skillCatalogDataRoot', 'data/seasons/s05'),
        equals('skillCatalogFromCount', '407'),
        equals('skillCatalogRequirementCount', '557'),
        equals('skillCatalogQualityFilter', 'all'),
        equals('skillCatalogLang', 'zhCN'),
        equals('skillCatalogUiLocalized', 'true'),
        pageTextIncludes('From 来源'),
        pageTextIncludes('需求信息'),
        pageTextIncludes('s05-tree-4.5'),
        pageTextIncludes('407 / 964'),
        pageTextIncludes('557 / 964')
      ]
    },
    {
      id: 'skill-catalog-quality-filter',
      path: '/tools/skill-catalog.html',
      waitFor: 'skillCatalogEntryCount',
      actions: [
        { type: 'selectOption', selector: '#qualityFilter', value: 'has-from' },
        { type: 'waitForDataset', key: 'skillCatalogVisibleCount', value: '407' },
        { type: 'selectOption', selector: '#qualityFilter', value: 'missing-detail' },
        { type: 'waitForDataset', key: 'skillCatalogVisibleCount', value: '964' }
      ],
      asserts: [
        equals('skillCatalogQualityFilter', 'missing-detail'),
        equals('skillCatalogVisibleCount', '964'),
        equals('skillCatalogFromCount', '407'),
        equals('skillCatalogRequirementCount', '557'),
        pageTextIncludes('虚空钟灵')
      ]
    },
    {
      id: 'skill-catalog-language',
      path: '/tools/skill-catalog.html',
      waitFor: 'skillCatalogEntryCount',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'skillCatalogLang', value: 'en' }
      ],
      asserts: [
        equals('skillCatalogLang', 'en'),
        equals('skillCatalogUiLocalized', 'true'),
        atLeast('skillCatalogEntryCount', 1),
        pageTextIncludes('Active Skill and Support Gem Catalog'),
        pageTextIncludes('Usage Boundaries')
      ]
    },
    {
      id: 'gem-flip',
      path: '/tools/gem-flip.html',
      waitFor: 'marketEntryCount',
      asserts: [
        atLeast('marketEntryCount', 1),
        atLeast('marketVisibleEntryCount', 1),
        equals('marketFilteredOutCount', '0'),
        equals('marketProfitOnly', 'false'),
        equals('marketMinLiquidity', '0'),
        equals('marketMaxRisk', '100'),
        equals('marketEvidenceOnly', 'false'),
        equals('marketBreakEvenAvailable', 'true'),
        equals('marketSafetyMarginAvailable', 'true'),
        equals('marketEvidenceAvgConfidence', '0.00'),
        equals('marketEvidenceMinBuyDepth', '0'),
        equals('marketEvidenceMinSellDepth', '0'),
        equals('marketQualityAvgConfidence', '0.00'),
        equals('marketQualityMinBuyDepth', '0'),
        equals('marketQualityMinSellDepth', '0'),
        equals('marketCandidateIndexSchema', '1'),
        equals('marketCandidateCount', '0'),
        equals('marketCandidateReadyCount', '0'),
        equals('marketCandidateCurrentKind', 'gemFlips'),
        equals('marketCandidateCurrentKindCount', '0'),
        equals('marketCandidateCurrentKindReadyCount', '0'),
        equals('marketDecisionAction', 'sample-hold'),
        atLeast('marketDecisionCapital', 1),
        atLeast('marketDecisionNetProfit', 1),
        atLeast('marketDecisionRisk', 1),
        equals('marketBudgetPlanReady', 'true'),
        equals('marketBudgetPlanCapital', '100.00'),
        equals('marketBudgetPlanTopId', 'supporting-fire-21'),
        equals('marketBudgetPlanUnits', '5'),
        equals('marketBudgetPlanSpend', '90.00'),
        equals('marketBudgetPlanNetProfit', '57.20'),
        equals('marketBudgetPlanAction', 'sample-plan-only'),
        equals('marketRankChangeMode', 'score'),
        equals('marketRankChangeDefaultTopId', 'supporting-fire-21'),
        equals('marketRankChangeCurrentTopId', 'supporting-fire-21'),
        equals('marketRankChangeFilteredOut', '0'),
        equals('marketRankChangeChanged', 'false'),
        atLeast('marketRankChangeReasonCount', 1),
        equals('marketLang', 'zhCN'),
        equals('marketUiLocalized', 'true'),
        oneOf('marketFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown'])
      ]
    },
    {
      id: 'gem-flip-language',
      path: '/tools/gem-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'marketLang', value: 'en' }
      ],
      asserts: [
        equals('marketLang', 'en'),
        equals('marketUiLocalized', 'true'),
        atLeast('marketEntryCount', 1),
        pageTextIncludes('Skill Flipping'),
        pageTextIncludes('Market Review'),
        pageTextIncludes('Break-even Sell'),
        pageTextIncludes('Budget Execution Plan'),
        pageTextIncludes('Current Basis'),
        pageTextIncludes('Sample data is not tradable advice'),
        pageTextIncludes('Candidate Snapshot Queue')
      ]
    },
    {
      id: 'gem-flip-budget-input',
      path: '/tools/gem-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'fill', selector: '#budgetCapitalInput', value: '180' },
        { type: 'waitForDataset', key: 'marketBudgetPlanCapital', value: '180.00' },
        { type: 'click', selector: '#copyBudgetUrlBtn' },
        { type: 'waitForDataset', key: 'marketBudgetPlanCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('marketBudgetPlanReady', 'true'),
        equals('marketBudgetPlanCapital', '180.00'),
        equals('marketBudgetPlanTopId', 'supporting-fire-21'),
        equals('marketBudgetPlanUnits', '10'),
        equals('marketBudgetPlanSpend', '180.00'),
        equals('marketBudgetPlanNetProfit', '114.40'),
        equals('marketBudgetPlanAction', 'sample-plan-only'),
        includes('marketBudgetPlanShareUrl', 'capital=180'),
        equals('marketBudgetPlanCopyStatus', 'copied'),
        pageTextIncludes('已复制当前预算链接'),
        pageTextIncludes('180.0 ex'),
        pageTextIncludes('10')
      ]
    },
    {
      id: 'gem-flip-budget-query',
      path: '/tools/gem-flip.html?capital=54',
      waitFor: 'marketEntryCount',
      asserts: [
        equals('marketBudgetPlanReady', 'true'),
        equals('marketBudgetPlanCapital', '54.00'),
        equals('marketBudgetPlanTopId', 'supporting-fire-21'),
        equals('marketBudgetPlanUnits', '3'),
        equals('marketBudgetPlanSpend', '54.00'),
        equals('marketBudgetPlanNetProfit', '34.32'),
        equals('marketBudgetPlanAction', 'sample-plan-only'),
        includes('marketBudgetPlanShareUrl', 'capital=54'),
        pageTextIncludes('54.0 ex')
      ]
    },
    {
      id: 'gem-flip-risk-filter',
      path: '/tools/gem-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'selectOption', selector: '#liquidityFilter', value: '70' },
        { type: 'selectOption', selector: '#riskFilter', value: '50' },
        { type: 'waitForDataset', key: 'marketVisibleEntryCount', value: '1' }
      ],
      asserts: [
        equals('marketVisibleEntryCount', '1'),
        equals('marketFilteredOutCount', '5'),
        equals('marketRankChangeFilteredOut', '5'),
        atLeast('marketRankChangeReasonCount', 1),
        equals('marketMinLiquidity', '70'),
        equals('marketMaxRisk', '50')
      ]
    },
    {
      id: 'hideout-flip',
      path: '/tools/hideout-flip.html',
      waitFor: 'marketEntryCount',
      asserts: [
        atLeast('marketEntryCount', 1),
        atLeast('marketVisibleEntryCount', 1),
        equals('marketFilteredOutCount', '0'),
        equals('marketProfitOnly', 'false'),
        equals('marketMinLiquidity', '0'),
        equals('marketMaxRisk', '100'),
        equals('marketEvidenceOnly', 'false'),
        equals('marketBreakEvenAvailable', 'true'),
        equals('marketSafetyMarginAvailable', 'true'),
        equals('marketEvidenceAvgConfidence', '0.00'),
        equals('marketEvidenceMinBuyDepth', '0'),
        equals('marketEvidenceMinSellDepth', '0'),
        equals('marketQualityAvgConfidence', '0.00'),
        equals('marketQualityMinBuyDepth', '0'),
        equals('marketQualityMinSellDepth', '0'),
        equals('marketCandidateIndexSchema', '1'),
        equals('marketCandidateCount', '0'),
        equals('marketCandidateReadyCount', '0'),
        equals('marketCandidateCurrentKind', 'hideoutFlips'),
        equals('marketCandidateCurrentKindCount', '0'),
        equals('marketCandidateCurrentKindReadyCount', '0'),
        equals('marketDecisionAction', 'sample-hold'),
        atLeast('marketDecisionGoldCost', 1),
        atLeast('marketDecisionCashCost', 1),
        atLeast('marketDecisionNetProfit', 1),
        atLeast('marketDecisionRisk', 1),
        equals('marketGoldBudgetPlanReady', 'true'),
        equals('marketGoldBudgetPlanGold', '100000'),
        equals('marketGoldBudgetPlanCash', '50.00'),
        equals('marketGoldBudgetPlanTopId', 'waystone-tier-15'),
        equals('marketGoldBudgetPlanUnits', '8'),
        equals('marketGoldBudgetPlanGoldSpend', '96000'),
        equals('marketGoldBudgetPlanCashSpend', '16.00'),
        equals('marketGoldBudgetPlanNetProfit', '50.24'),
        equals('marketGoldBudgetPlanAction', 'sample-plan-only'),
        equals('marketRankChangeMode', 'score'),
        equals('marketRankChangeDefaultTopId', 'waystone-tier-15'),
        equals('marketRankChangeCurrentTopId', 'waystone-tier-15'),
        equals('marketRankChangeFilteredOut', '0'),
        equals('marketRankChangeChanged', 'false'),
        atLeast('marketRankChangeReasonCount', 1),
        equals('marketLang', 'zhCN'),
        equals('marketUiLocalized', 'true'),
        oneOf('marketFreshnessStatus', ['sample-not-live', 'fresh', 'stale', 'unknown'])
      ]
    },
    {
      id: 'hideout-flip-language',
      path: '/tools/hideout-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'marketLang', value: 'en' }
      ],
      asserts: [
        equals('marketLang', 'en'),
        equals('marketUiLocalized', 'true'),
        atLeast('marketEntryCount', 1),
        pageTextIncludes('Hideout Gold Flipping'),
        pageTextIncludes('Market Review'),
        pageTextIncludes('Profit per 10k Gold'),
        pageTextIncludes('Gold Budget Plan'),
        pageTextIncludes('Current Basis'),
        pageTextIncludes('Sample data is not tradable advice'),
        pageTextIncludes('Candidate Snapshot Queue')
      ]
    },
    {
      id: 'hideout-flip-budget-input',
      path: '/tools/hideout-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'fill', selector: '#budgetGoldInput', value: '240000' },
        { type: 'fill', selector: '#budgetCashInput', value: '80' },
        { type: 'waitForDataset', key: 'marketGoldBudgetPlanGold', value: '240000' },
        { type: 'click', selector: '#copyBudgetUrlBtn' },
        { type: 'waitForDataset', key: 'marketGoldBudgetPlanCopyStatus', value: 'copied' }
      ],
      asserts: [
        equals('marketGoldBudgetPlanReady', 'true'),
        equals('marketGoldBudgetPlanGold', '240000'),
        equals('marketGoldBudgetPlanCash', '80.00'),
        equals('marketGoldBudgetPlanTopId', 'waystone-tier-15'),
        equals('marketGoldBudgetPlanUnits', '20'),
        equals('marketGoldBudgetPlanGoldSpend', '240000'),
        equals('marketGoldBudgetPlanCashSpend', '40.00'),
        equals('marketGoldBudgetPlanNetProfit', '125.60'),
        equals('marketGoldBudgetPlanAction', 'sample-plan-only'),
        includes('marketGoldBudgetPlanShareUrl', 'gold=240000'),
        includes('marketGoldBudgetPlanShareUrl', 'cash=80'),
        equals('marketGoldBudgetPlanCopyStatus', 'copied'),
        pageTextIncludes('已复制当前预算链接'),
        pageTextIncludes('80.0 ex')
      ]
    },
    {
      id: 'hideout-flip-budget-query',
      path: '/tools/hideout-flip.html?gold=60000&cash=6',
      waitFor: 'marketEntryCount',
      asserts: [
        equals('marketGoldBudgetPlanReady', 'true'),
        equals('marketGoldBudgetPlanGold', '60000'),
        equals('marketGoldBudgetPlanCash', '6.00'),
        equals('marketGoldBudgetPlanTopId', 'waystone-tier-15'),
        equals('marketGoldBudgetPlanUnits', '3'),
        equals('marketGoldBudgetPlanGoldSpend', '36000'),
        equals('marketGoldBudgetPlanCashSpend', '6.00'),
        equals('marketGoldBudgetPlanNetProfit', '18.84'),
        equals('marketGoldBudgetPlanAction', 'sample-plan-only'),
        includes('marketGoldBudgetPlanShareUrl', 'gold=60000'),
        includes('marketGoldBudgetPlanShareUrl', 'cash=6'),
        pageTextIncludes('6.0 ex')
      ]
    },
    {
      id: 'hideout-flip-risk-filter',
      path: '/tools/hideout-flip.html',
      waitFor: 'marketEntryCount',
      actions: [
        { type: 'selectOption', selector: '#liquidityFilter', value: '70' },
        { type: 'selectOption', selector: '#riskFilter', value: '50' },
        { type: 'waitForDataset', key: 'marketVisibleEntryCount', value: '2' }
      ],
      asserts: [
        equals('marketVisibleEntryCount', '2'),
        equals('marketFilteredOutCount', '4'),
        equals('marketRankChangeFilteredOut', '4'),
        atLeast('marketRankChangeReasonCount', 1),
        equals('marketMinLiquidity', '70'),
        equals('marketMaxRisk', '50')
      ]
    },
    {
      id: 'ninja-import',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        {
          type: 'fill',
          selector: '#input',
          value: JSON.stringify({
            version: 's05-tree-4.5',
            character: { name: 'DemoTactician', class: 'Mercenary', ascendancy: 'Tactician', level: 70 },
            skillGroups: [
              { active: { name: 'Supporting Fire', level: 20 }, supports: [{ name: 'Meat Shield' }, { name: 'Last Gasp' }] }
            ],
            items: [{ slot: 'Weapon', name: 'Trenchtimbre', explicitMods: ['+25 to maximum Life'] }],
            passives: [6077, 27296, 26945, 2847, 49593]
          })
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'parsedPassiveTreeNodeCount', value: '5' }
      ],
      asserts: [
        atLeast('compareBuildCount', 1),
        includes('compareBuildId', 'tactician-supporting-fire'),
        equals('ninjaLang', 'zhCN'),
        equals('ninjaUiLocalized', 'true'),
        equals('parsedPassiveTreeNodeCount', '5'),
        equals('ninjaProfileViewReady', 'true'),
        pageTextIncludes('角色配置视图'),
        pageTextIncludes('装备界面'),
        pageTextIncludes('技能界面'),
        pageTextIncludes('天赋界面'),
        pageTextIncludes('宝石界面'),
        pageTextIncludes('DemoTactician'),
        equals('ninjaVersionCompatibilityStatus', 'matched'),
        equals('ninjaVersionCompatibilityWarnings', '0'),
        equals('ninjaAssignedVersion', 's05-tree-4.5'),
        equals('ninjaComparedVersion', 's05-tree-4.5'),
        equals('ninjaExplicitVersion', 's05-tree-4.5'),
        atLeast('ninjaPobSkillGroupsDetected', 1),
        equals('ninjaFormatProfileInputFormat', 'json'),
        includes('ninjaFormatProfileSkillGroupPath', 'skillGroups'),
        includes('ninjaFormatProfileItemPath', 'items'),
        includes('ninjaFormatProfilePassivePath', 'passives'),
        includes('ninjaFormatProfileParserHints', 'pob-skill-groups'),
        includes('ninjaFormatProfileParserHints', 'gear-container')
      ]
    },
    {
      id: 'ninja-import-language',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        {
          type: 'fill',
          selector: '#input',
          value: JSON.stringify({
            version: 's05-tree-4.5',
            character: { name: 'DemoTactician', class: 'Mercenary', ascendancy: 'Tactician', level: 70 },
            skillGroups: [
              { active: { name: 'Supporting Fire', level: 20 }, supports: [{ name: 'Meat Shield' }, { name: 'Last Gasp' }] }
            ],
            items: [{ slot: 'Weapon', name: 'Trenchtimbre', explicitMods: ['+25 to maximum Life'] }],
            passives: [6077, 27296, 26945, 2847, 49593]
          })
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'parsedPassiveTreeNodeCount', value: '5' },
        { type: 'click', selector: '[data-lang="en"]' },
        { type: 'waitForDataset', key: 'ninjaLang', value: 'en' }
      ],
      asserts: [
        equals('ninjaLang', 'en'),
        equals('ninjaUiLocalized', 'true'),
        atLeast('compareBuildCount', 1),
        equals('parsedPassiveTreeNodeCount', '5'),
        pageTextIncludes('Ninja Config Parser'),
        pageTextIncludes('Character Config View'),
        pageTextIncludes('Equipment'),
        pageTextIncludes('Skills'),
        pageTextIncludes('Passives'),
        pageTextIncludes('Gems')
      ]
    },
    {
      id: 'ninja-import-pob-code',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        { type: 'selectOption', selector: '#sourceType', value: 'pob-code' },
        {
          type: 'fill',
          selector: '#input',
          value: 'pob://eJx1kkFrwkAQhf_KstCTsdiYqPGoxbbQQCFtL8XDJhl16GY37G5EEf97Z2OsUO0tmfnevHnDHvgWjEWt-JTbQdx3BqAf3cc84BaEbevZwP_WGsIy__ylT1CxEUYUDgyfHrgSFVDnTedzXcIjVNoTUlhL1RRMAUqYPdWEpc9SqGJPjXfSY4FCUUPCFiSfJg9H8v9GKZ-MbmqSfx24FLnv8aypa20cqjVboAFSraE6Id0C14S32FLLmQaOwWVTn8Y6UIWH7El2RfkZ7EWtmjb5X27pyfNuKSpi2MJo5SSqW8vNJRgs_t8pBeFYtkGQ5Q2vZcDRnSdaqZ1XCFTsWSjPd0PeDWXaOKzyNj7sakkndqkuvZL3hsxp9uqPzfSKCSlZt3nmj25J0pvEnqnEDqumYlmNBh1vw3a2M62dvVjOtALrp31IaW54hvEdQ1UYelVQslRvoQJFSWuAkrfBanoodBFPjwbjcRCOw2QUhKMkioNwEo2DKImT4fL4AxSm5Ps'
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'ninjaFormatProfileInputFormat', value: 'pob-code' }
      ],
      asserts: [
        equals('ninjaFormatProfileInputFormat', 'pob-code'),
        equals('parsedPassiveTreeNodeCount', '5'),
        equals('ninjaVersionCompatibilityStatus', 'matched'),
        equals('ninjaAssignedVersion', 's05-tree-4.5'),
        atLeast('ninjaPobSkillGroupsDetected', 1),
        includes('ninjaSourceEvidenceSkills', 'skillGroups'),
        includes('ninjaFormatProfileSkillGroupPath', 'skillGroups'),
        includes('ninjaFormatProfilePassivePath', 'passives'),
        includes('ninjaFormatProfileParserHints', 'pob-compressed-code'),
        atLeast('ninjaSkillCatalogSkillMatched', 1),
        atLeast('ninjaSkillCatalogSupportMatched', 1),
        equals('ninjaPassiveStageReadinessStages', '5'),
        atLeast('ninjaPassiveStageReadinessMatched', 1),
        includes('ninjaPassiveStageReadinessSourceStatus', 'manifest-route'),
        includes('ninjaBestPassiveStageTreeHref', 'stage=campaign-early'),
        includes('ninjaBestPassiveStageMissingHref', 'nodes='),
        atLeast('ninjaBestPassiveStageMissingCount', 1),
        oneOf('ninjaProgressionBottleneck', ['passives', 'gear']),
        equals('ninjaMinionSelectionRows', '3'),
        atLeast('ninjaMinionSelectionSkillExpected', 9),
        includes('ninjaMinionSelectionSourceStatus', 'manual-guide-minion-selection')
      ]
    },
    {
      id: 'ninja-import-pob2-code-profile-view',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        { type: 'selectOption', selector: '#sourceType', value: 'auto' },
        {
          type: 'fill',
          selector: '#input',
          value: 'eJyllN1P2zAQwN_9V5wi8URZPtpCqVLQKO2oNAajsNfJJNfWwrGL4xTy3--cDwgIaUx7su98vp_vy_HpcyZhhyYXWk288EvgAapEp0KtJ97d7fxg5J2esPia283V6qwQ0p1EJwwgriSQuENJNwO6mUie5z94hhPvUqsHD3ieoEqnHTU3VnAJX2nJrQeWmzXaXy0_-B16fuX81iACT6zY4XKLCQG8k9jtQKROAEsGnXtDD5ROMaezcHA87EWHw6OoF4X9_mGvPzwOwl4_Gh2HzRsXzkdAqNh3oIq4fBBS5i3TCUu0DbeRGnajoETxe4mksqZA0n7DDBSFWT_4Qkupn2CukyL3IHc3HLZWV9pryUs0XpvCiDL4WHApbFkLb_377wFTqXOEqc7uuYXFosNYFtutNrYyqM9r1O2TfqGFHdjfWbNnTAqLH2Kas39H-FUaP5lNNJy6Ta9gkWA3nZX-akXa_0znTGKGylJzvi9ZG2dr8FHxPhur3_ZSu82r5ltYzNrec_uX1nNC23Y33JD_MdCK7JxnilvqfvhWcJMKrtiZTkuarEwXhs123I3GGMLB6JDNFJp1CcuNQJmOYXB0xO6UeCyooOdjyDe6kOmB0vbA0LiiYRX1u4tsDKOQ_awjG0MUsP1BAFZDxp9FVpCRWCHb7w_3nHIuDMIN5jTaXCUY-85PJ4boNYYazy75Gu-l1im7QL4r4QylZdMNNxkspbY5IVkU7Lm6z2lwH8h7oum7KoFvt1JgCgvlYFaWXdqbWSU_VZknXidBHgiyq_4BV56uET3h9TSqitf4bHZUsth__yP-ARSzvAs'
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'ninjaProfileViewReady', value: 'true' },
        { type: 'click', selector: '[data-profile-tab="gems"]' },
        { type: 'waitForDataset', key: 'ninjaProfileActiveTab', value: 'gems' }
      ],
      asserts: [
        equals('ninjaFormatProfileInputFormat', 'pob-code'),
        includes('ninjaFormatProfileParserHints', 'pob-compressed-code'),
        includes('ninjaFormatProfileParserHints', 'pob-xml'),
        equals('ninjaProfileViewReady', 'true'),
        equals('ninjaProfileEquipmentCount', '2'),
        equals('ninjaProfileSkillGroupCount', '2'),
        equals('ninjaProfileActiveGemCount', '2'),
        equals('ninjaProfileSupportGemCount', '3'),
        equals('ninjaProfilePassiveCount', '5'),
        equals('parsedPassiveTreeNodeCount', '5'),
        equals('ninjaProfileActiveTab', 'gems'),
        pageTextIncludes('角色配置视图'),
        pageTextIncludes('装备界面'),
        pageTextIncludes('技能界面'),
        pageTextIncludes('天赋界面'),
        pageTextIncludes('宝石界面'),
        pageTextIncludes('虚空钟灵'),
        pageTextIncludes('近战 I')
      ]
    },
    {
      id: 'ninja-import-pob-xml',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        { type: 'selectOption', selector: '#sourceType', value: 'pob-code' },
        {
          type: 'fill',
          selector: '#input',
          value: 'pob://eJyFU8tOwzAQvPMVK99LSmlagpIeAIEq0VIRBFw3yUItnDiyXVD_Hm8ehdADp33M7ng8TuINuu3D29VOqkJW71Cgw2cyVuoqEXYcjpwhGk1PQwGW0HI3HYdiETcbkG_RYO7IrLGkRGx09lqqGyq1gFyhtW17RSanCs1eAFqfFdc_2JNfl7nESoCiT1KJiMYiWMRP_lxg7JPSmvJEnPlDOQNZcAEs7KCUBS7itS7ItqGZmo3nc-Y6NCbzSTQbdmbRNBx2LqbDpWkURufcCTr-gGX4wBK9pg-plO2lcpGS6-R2VSe5a4DCjO-Z7upaG8eu30pDHr6jEirvSnvhvzhY3l4Wv5EW8N5mijzgzI5Y6ZBoRegg3UpSxTEJgz32D889Wgd3aOtjFoZa5IgjaC7dR-9Gn3onl47K3jrOD85x0bv2iEa6_SX4SCep06aENVGh6OTaaGsz_RUHPN9uDexW2jX6E_FCWOsK_Hcj_dCyGWBx3UqX8eMOf4jFN2MbCCk'
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'ninjaFormatProfileInputFormat', value: 'pob-code' }
      ],
      asserts: [
        equals('ninjaFormatProfileInputFormat', 'pob-code'),
        equals('parsedPassiveTreeNodeCount', '5'),
        equals('ninjaVersionCompatibilityStatus', 'matched'),
        equals('ninjaAssignedVersion', 's05-tree-4.5'),
        atLeast('ninjaPobSkillGroupsDetected', 1),
        includes('ninjaSourceEvidenceSkills', 'skillGroups'),
        includes('ninjaFormatProfileSkillGroupPath', 'skillGroups'),
        includes('ninjaFormatProfileItemPath', 'items'),
        includes('ninjaFormatProfilePassivePath', 'passives'),
        includes('ninjaFormatProfileParserHints', 'pob-compressed-code'),
        includes('ninjaFormatProfileParserHints', 'pob-xml'),
        atLeast('ninjaSkillCatalogSkillMatched', 1),
        atLeast('ninjaSkillCatalogSupportMatched', 1),
        equals('ninjaPassiveStageReadinessStages', '5'),
        atLeast('ninjaPassiveStageReadinessMatched', 1),
        includes('ninjaPassiveStageReadinessSourceStatus', 'manifest-route'),
        includes('ninjaBestPassiveStageTreeHref', 'stage=campaign-early'),
        includes('ninjaBestPassiveStageMissingHref', 'nodes='),
        atLeast('ninjaBestPassiveStageMissingCount', 1),
        oneOf('ninjaProgressionBottleneck', ['passives', 'gear'])
      ]
    },
    {
      id: 'ninja-import-raw-pob-xml',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        { type: 'selectOption', selector: '#sourceType', value: 'pob-xml' },
        {
          type: 'fill',
          selector: '#input',
          value: '<PathOfBuilding dataVersion="s05-tree-4.5" season="S05"><Build characterName="RawPobXmlDemo" className="Mercenary" ascendClassName="Tactician" level="90"/><Tree activeSpec="1"><Spec id="1" treeVersion="4.5"><Nodes><Node id="6077"/><Node id="27296"/><Node id="26945"/><Node id="2847"/><Node id="49593"/></Nodes></Spec></Tree><Skills activeSkillSet="1"><SkillSet id="1"><Skill label="Supporting Fire"><Gem nameSpec="Supporting Fire" skillId="SupportingFire" enabled="true"/><Gem nameSpec="Meat Shield" skillId="SupportMeatShield" enabled="true"/><Gem nameSpec="Last Gasp" skillId="SupportLastGasp" enabled="true"/></Skill></SkillSet></Skills><Items activeItemSet="1"><Item id="1">Rarity: Rare\nStorm Needle\nCrossbow\n+2 to Level of all Minion Skills\nMinions deal 41% increased Damage</Item><ItemSet id="1"><Slot name="Weapon 1" itemId="1"/></ItemSet></Items></PathOfBuilding>'
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'ninjaFormatProfileInputFormat', value: 'pob-xml' }
      ],
      asserts: [
        equals('ninjaFormatProfileInputFormat', 'pob-xml'),
        equals('parsedPassiveTreeNodeCount', '5'),
        equals('ninjaVersionCompatibilityStatus', 'matched'),
        equals('ninjaAssignedVersion', 's05-tree-4.5'),
        atLeast('ninjaPobSkillGroupsDetected', 1),
        includes('ninjaFormatProfileSkillGroupPath', 'skillGroups'),
        includes('ninjaFormatProfileItemPath', 'items'),
        includes('ninjaFormatProfilePassivePath', 'passives'),
        includes('ninjaFormatProfileParserHints', 'pob-xml'),
        atLeast('ninjaSkillCatalogSkillMatched', 1),
        atLeast('ninjaSkillCatalogSupportMatched', 1),
        atLeast('ninjaGearModCount', 2),
        atLeast('ninjaGearStatRollCount', 2),
        atLeast('ninjaGearSlotRollSummaryCount', 2),
        atLeast('ninjaGearSlotThresholdRows', 1),
        atLeast('ninjaGearSlotThresholdPassed', 2),
        atLeast('ninjaGearSlotThresholdMissing', 1),
        equals('ninjaGearStageReadinessStages', '5'),
        equals('ninjaGearStageReadinessRows', '20'),
        atLeast('ninjaGearStageReadinessPassed', 1),
        atLeast('ninjaGearStageReadinessMissing', 1),
        equals('ninjaPassiveStageReadinessStages', '5'),
        atLeast('ninjaPassiveStageReadinessMatched', 1),
        includes('ninjaPassiveStageReadinessSourceStatus', 'manifest-route'),
        includes('ninjaBestPassiveStageTreeHref', 'stage=campaign-early'),
        includes('ninjaBestPassiveStageMissingHref', 'nodes='),
        atLeast('ninjaBestPassiveStageMissingCount', 1),
        oneOf('ninjaProgressionBottleneck', ['passives', 'gear']),
        includes('ninjaProgressionSourceStatus', 'parser-stage-heuristic')
      ]
    },
    {
      id: 'ninja-import-version-mismatch',
      path: '/tools/ninja-import.html',
      waitFor: 'compareBuildCount',
      actions: [
        {
          type: 'fill',
          selector: '#input',
          value: JSON.stringify({
            version: 's04-tree-4.4',
            season: 'S04',
            poe2dbVersion: '4.4',
            character: { name: 'MismatchDemo', class: 'Mercenary', ascendancy: 'Tactician', level: 70 },
            skills: [{ name: 'Supporting Fire' }],
            passives: [6077]
          })
        },
        { type: 'click', selector: '#parseBtn' },
        { type: 'waitForDataset', key: 'ninjaVersionCompatibilityStatus', value: 'needs-review' }
      ],
      asserts: [
        equals('ninjaVersionCompatibilityStatus', 'needs-review'),
        atLeast('ninjaVersionCompatibilityWarnings', 1),
        equals('ninjaAssignedVersion', 's04-tree-4.4'),
        equals('ninjaComparedVersion', 's05-tree-4.5'),
        equals('ninjaExplicitVersion', 's04-tree-4.4'),
        equals('ninjaExportSeason', 'S04'),
        equals('ninjaExportPoe2dbVersion', '4.4'),
        atLeast('ninjaFormatProfileRiskCount', 1)
      ]
    }
  ];
}

async function runActions(page, actions, timeoutMs) {
  for (const action of actions || []) {
    if (action.type === 'click') {
      await page.click(action.selector, { timeout: timeoutMs });
    } else if (action.type === 'fill') {
      await page.fill(action.selector, action.value, { timeout: timeoutMs });
    } else if (action.type === 'selectOption') {
      await page.selectOption(action.selector, action.value, { timeout: timeoutMs });
    } else if (action.type === 'waitForDataset') {
      await page.waitForFunction(
        ({ key, value }) => value === undefined
          ? Boolean(document.body.dataset[key])
          : document.body.dataset[key] === value,
        { key: action.key, value: action.value },
        { timeout: timeoutMs }
      );
    } else {
      throw new Error(`Unsupported runtime action: ${action.type}`);
    }
  }
}

async function validateRuntimePage(browser, baseUrl, check, timeoutMs) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const url = joinUrl(baseUrl, check.path);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction((key) => Boolean(document.body.dataset[key]) && document.body.dataset[key] !== 'false', check.waitFor, { timeout: timeoutMs });
    await runActions(page, check.actions, timeoutMs);
    const dataset = await page.evaluate(() => ({ ...document.body.dataset }));
    const pageText = await page.evaluate(() => document.body.innerText);
    const failures = [];
    for (const assert of check.asserts || []) {
      const failure = assert(dataset, pageText);
      if (failure) failures.push(failure);
    }
    if (consoleErrors.length) failures.push(...consoleErrors.map((item) => `console error: ${item}`));
    return {
      id: check.id,
      url,
      status: failures.length ? 'failed' : 'ok',
      dataset,
      failures
    };
  } catch (error) {
    return {
      id: check.id,
      url,
      status: 'failed',
      failures: [error.message, ...consoleErrors.map((item) => `console error: ${item}`)]
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const playwright = await loadPlaywright(args.playwright);
  const browserPath = await resolveBrowser(args.browser);
  const launchOptions = { headless: true };
  if (browserPath) launchOptions.executablePath = browserPath;
  const browser = await playwright.chromium.launch(launchOptions);

  try {
    const results = [];
    for (const check of runtimeChecks()) {
      results.push(await validateRuntimePage(browser, args.baseUrl, check, args.timeoutMs));
    }
    const failed = results.filter((result) => result.status !== 'ok');
    console.log(JSON.stringify({
      baseUrl: args.baseUrl,
      browser: browserPath || 'playwright-default',
      pageCount: results.length,
      failed: failed.length,
      results
    }, null, 2));
    if (failed.length) process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
