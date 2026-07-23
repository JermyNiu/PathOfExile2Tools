#!/usr/bin/env node

const defaultBaseUrl = 'http://127.0.0.1:8766';

function parseArgs(argv) {
  const args = {
    baseUrl: defaultBaseUrl,
    timeoutMs: 8000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
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
    '  node scripts/validate-pages.mjs [--base-url http://127.0.0.1:8766] [--timeout-ms 8000]',
    '',
    'Checks that the core local HTML pages are reachable through the dev server.',
    'Start the server first, for example: node scripts/serve.mjs'
  ].join('\n');
}

function pageChecks() {
  return [
    {
      id: 'home',
      path: '/',
      mustContain: [
        'POE2 Tools',
        'levelingBuildList',
        'levelingCandidateSummary',
        'collectBuildCandidateSummary',
        'renderBuildCandidateSummary',
        'homeBuildCandidateSchema',
        'homeBuildCandidateSourceFile',
        'homeBuildCandidateCount',
        'homeBuildCandidateAvailableCount',
        'homeBuildCandidateDraftCount',
        'homeBuildCandidateDraftFileCount',
        'homeBuildCandidateRouteStageCount',
        'homeBuildCandidateRouteFileCount',
        'homeBuildCandidateRouteMissingFileCount',
        'homeBuildCandidateStatuses',
        'builds/index.html',
        'version-history.html',
        'route-review.html',
        'market-review.html',
        '路线复核工作台',
        '市场复核工作台',
        'homeGemMarketSummary',
        'homeSkillCatalogSummary',
        'renderHomeSkillCatalogSummary',
        'homeSkillCatalogSourceType',
        'homeSkillCatalogEntryCount',
        'homeSkillCatalogActiveCount',
        'homeSkillCatalogSupportCount',
        'homeSkillCatalogDetailCount',
        'homeSkillCatalogVerifiedCount',
        'homeSkillCatalogBoundaryStatus',
        'skill-data-not-live-price',
        'homeHideoutMarketSummary',
        'homeGemMarketSourceType',
        'homeGemMarketEntryCount',
        'homeGemMarketQualityEvidenceCoverage',
        'homeGemMarketQualityAvgConfidence',
        'homeGemMarketQualityMinBuyDepth',
        'homeGemMarketQualityMinSellDepth',
        'homeGemMarketQualityHasFilters',
        'homeGemMarketFreshnessStatus',
        'homeGemMarketDecisionTopId',
        'homeGemMarketDecisionCapital',
        'homeGemMarketDecisionNetProfit',
        'homeGemMarketDecisionAction',
        'homeGemMarketBudgetPlanReady',
        'homeGemMarketBudgetPlanCapital',
        'homeGemMarketBudgetPlanTopId',
        'homeGemMarketBudgetPlanUnits',
        'homeGemMarketBudgetPlanSpend',
        'homeGemMarketBudgetPlanNetProfit',
        'homeGemMarketBudgetPlanAction',
        'homeGemMarketCandidateIndexSchema',
        'homeGemMarketCandidateCount',
        'homeGemMarketCandidateReadyCount',
        'homeGemMarketCandidateCurrentKind',
        'homeGemMarketCandidateCurrentKindCount',
        'homeGemMarketCandidateCurrentKindReadyCount',
        'homeGemMarketCandidateStatuses',
        'homeHideoutMarketSourceType',
        'homeHideoutMarketEntryCount',
        'homeHideoutMarketQualityEvidenceCoverage',
        'homeHideoutMarketQualityAvgConfidence',
        'homeHideoutMarketQualityMinBuyDepth',
        'homeHideoutMarketQualityMinSellDepth',
        'homeHideoutMarketQualityHasFilters',
        'homeHideoutMarketFreshnessStatus',
        'homeHideoutMarketDecisionTopId',
        'homeHideoutMarketDecisionGoldCost',
        'homeHideoutMarketDecisionCashCost',
        'homeHideoutMarketDecisionNetProfit',
        'homeHideoutMarketDecisionAction',
        'homeHideoutMarketBudgetPlanReady',
        'homeHideoutMarketBudgetPlanGold',
        'homeHideoutMarketBudgetPlanCash',
        'homeHideoutMarketBudgetPlanTopId',
        'homeHideoutMarketBudgetPlanUnits',
        'homeHideoutMarketBudgetPlanGoldSpend',
        'homeHideoutMarketBudgetPlanCashSpend',
        'homeHideoutMarketBudgetPlanNetProfit',
        'homeHideoutMarketBudgetPlanAction',
        'homeHideoutMarketCandidateIndexSchema',
        'homeHideoutMarketCandidateCount',
        'homeHideoutMarketCandidateReadyCount',
        'homeHideoutMarketCandidateCurrentKind',
        'homeHideoutMarketCandidateCurrentKindCount',
        'homeHideoutMarketCandidateCurrentKindReadyCount',
        'homeHideoutMarketCandidateStatuses',
        'homeNinjaSummary',
        'homeNinjaSchemaStatus',
        'homeNinjaParserHintCount',
        'homeNinjaParserHints',
        'homeNinjaExampleCount',
        'homeNinjaExampleOk',
        'homeNinjaExamplePobXmlCount',
        'collectHomeNinjaArchives',
        'homeNinjaArchiveCount',
        'homeNinjaArchiveReadyCount',
        'homeNinjaArchiveMatchedCount',
        'homeNinjaArchiveNeedsReviewCount',
        'homeNinjaArchiveSourceUnknownCount',
        'homeNinjaArchiveFormats',
        '当前归档',
        '版本匹配',
        'parserHintsFromSchema',
        'validateNinjaExample',
        'parsed-raw-pob-xml.example.json',
        'versionRouteQuality',
        'versionRouteReview',
        'homeReady',
        'homeRouteQualityTotal',
        'homeRouteQualityPending',
        'homeRouteQualityHandTuned',
        'homeRouteQualityManualReview',
        'homeRouteReviewCount',
        'homeRouteReviewMissing',
        'homeBuildGearThresholdStageCount',
        'homeBuildGearThresholdRowCount',
        'homeBuildGearThresholdSourceStatus',
        'homeBuildCraftPlanCount',
        'homeBuildCraftStructuredCount',
        'homeBuildCraftSourceStatus',
        'guideWritingStats',
        'guideReportReady',
        'guideReportHref',
        'countLocalizedChecks',
        'homeBuildGuideCompleteCount',
        'homeBuildGuideMissingCount',
        'homeBuildGuideReportReadyCount',
        'homeBuildGuideSkillOverviewCards',
        'homeBuildGuideSkillOverviewChecks',
        'homeBuildGuideMinionSelectionGroups',
        'homeBuildGuideMinionSelectionRules',
        'manual-guide-minion-selection',
        'homeBuildGuideGearOverviewCards',
        'homeBuildGuideGearOverviewChecks',
        'homeBuildGuideStagePlaybooks',
        'homeBuildGuideExecutionStages',
        'homeBuildGuideSourceStatus',
        'manual-guide-article',
        '攻略正文',
        '攻略报告',
        '可导出',
        'guide-markdown-report',
        '技能总览',
        '装备总览',
        '阶段攻略',
        'craftPlanStats',
        'gearThresholdStats',
        '装备门槛',
        '制作方案',
        'marketCandidateStats',
        'gemBudgetPlan',
        'hideoutBudgetPlan',
        '默认预算',
        '批次数量',
        '批次净利',
        '预算边界',
        '候选队列',
        '候选路线文件',
        'homeBuildCandidateHandTunedRouteCount',
        'homeBuildCandidateManifestRouteCount',
        'homeBuildCandidateMaterialReadyCount',
        'homeBuildCandidateReviewReadyCount',
        'homeBuildCandidateManifestPublishedCount',
        'homeBuildCandidatePublishReadyCount',
        'homeBuildCandidateBlockedBy',
        '手调候选',
        '正式路线',
        '素材就绪',
        '复核就绪',
        '可发布',
        '等待正式登记',
        'sample-manual-seed'
      ]
    },
    {
      id: 'build-list',
      path: '/builds/index.html',
      mustContain: ['开荒 BD 列表', '查看战术家攻略', '独立天赋树工具', 'tactician-supporting-fire.html', '../tools/passive-tree.html', 'buildList', 'buildListStats', 'buildListFilters', 'buildSearch', 'classFilter', 'statusFilter', 'routeFilter', 'guideFilter', 'buildListFilterSummary', 'buildListCount', 'buildListVisibleCount', 'buildListFilterSearch', 'buildListFilterClass', 'buildListFilterStatus', 'buildListFilterRoute', 'buildListFilterGuide', 'filteredBuildItems', 'renderFilteredBuilds', 'matchesRouteFilter', 'matchesGuideFilter', '正文完整', '正文有缺口', '报告可导出', '报告待补', 'report-ready', 'report-missing', 'buildCandidateList', 'collectBuildCandidates', 'renderBuildCandidates', 'renderCandidateCard', 'buildListCandidateSchema', 'buildListCandidateSourceFile', 'buildListCandidateSourceType', 'buildListCandidateCount', 'buildListCandidateAvailableCount', 'buildListCandidateDraftCount', 'buildListCandidateDraftFileCount', 'buildListCandidateRouteStageCount', 'buildListCandidateRouteFileCount', 'buildListCandidateRouteMissingFileCount', 'buildListCandidateStatuses', '候选 BD 队列', '候选路线文件', '缺失路线', '不参与上方正式 BD 筛选', '预览候选天赋', 'buildListRouteCount', 'buildListPendingRoutes', 'buildListStrategyCount', 'guideWritingStats', 'guideReportReady', 'guideReportHref', 'buildListGuideReportReadyCount', 'countLocalizedChecks', 'buildListGuideCompleteCount', 'buildListGuideMissingCount', 'buildListGuideSkillOverviewCards', 'buildListGuideSkillOverviewChecks', 'buildListGuideMinionSelectionGroups', 'buildListGuideMinionSelectionRules', 'manual-guide-minion-selection', 'buildListGuideGearOverviewCards', 'buildListGuideGearOverviewChecks', 'buildListGuideStagePlaybooks', 'buildListGuideExecutionStages', 'buildListGuideSourceStatus', 'manual-guide-article', '攻略正文', '攻略报告', '报告导出', '可导出', '待补', 'guide-markdown-report', '攻略完整', '攻略缺口', '技能总览', '召唤选择', '装备总览', '阶段攻略', 'buildListGearThresholdStageCount', 'buildListGearThresholdRowCount', 'buildListGearThresholdSourceStatus', 'buildListCraftPlanCount', 'buildListCraftStructuredCount', 'buildListCraftSourceStatus', 'craftPlanStats', 'gearThresholdStats', '装备门槛', '制作方案', 'guideStrategy', 'tactician-supporting-fire', 'infernalist-minions']
    },
    {
      id: 'version-history',
      path: '/tools/version-history.html',
      mustContain: ['版本历史', 'route-review.html', '路线复核', 'versionHistoryReady', 'versionHistoryCount', 'versionHistoryRouteCount', 'versionHistoryRouteReviewCount', 'versionHistoryRouteReviewMissing', 'currentFiles', 'routeQuality', 'routeReview', '版本数据矩阵', 'versionCompletenessRows', 'versionHistoryCompletenessTotal', 'versionHistoryCompletenessMissing', '版本操作命令', 'versionCommandList', 'copyVersionCommandsBtn', 'copyVersionCommands', 'copyText', 'setCommandCopyButton', 'versionCommandCopyStatus', 'versionHistoryCommandText', 'versionHistoryCommandLineCount', 'versionHistoryCommandCopyStatus', '复制版本操作命令', '已复制版本操作命令', 'renderVersionCommands', 'inferNextVersion', 'versionHistoryCommandCurrent', 'versionHistoryCommandTarget', 'versionHistoryCommandCount', 'versionHistoryCommandSeason', '创建下一版草稿', '比较天赋树并生成版本日志', '切换 current', 'create-version.mjs', 'update-data.mjs', 'diff-tree.mjs', 'generate-version-log.mjs', 'switch-current.mjs', 'versionHistoryNinjaExampleCount', 'versionHistoryNinjaExampleOk', 'versionHistoryNinjaExamplePobXmlCount', 'collectNinjaArchives', 'versionHistoryNinjaArchiveCount', 'versionHistoryNinjaArchiveReadyCount', 'versionHistoryNinjaArchiveMatchedCount', 'versionHistoryNinjaArchiveNeedsReviewCount', 'versionHistoryNinjaArchiveSourceUnknownCount', 'versionHistoryNinjaArchiveFormats', '忍者归档', 'collectBuildGearThresholds', 'collectBuildCraftPlans', 'collectBuildGuideWriting', 'countLocalizedChecks', 'versionHistoryGuideCompleteCount', 'versionHistoryGuideMissingCount', 'versionHistoryGuideReportReadyCount', 'versionHistoryGuideSkillOverviewCards', 'versionHistoryGuideSkillOverviewChecks', 'versionHistoryGuideMinionSelectionGroups', 'versionHistoryGuideMinionSelectionRules', 'versionHistoryGuideGearOverviewCards', 'versionHistoryGuideGearOverviewChecks', 'versionHistoryGuideStagePlaybooks', 'versionHistoryGuideExecutionStages', 'versionHistoryGuideSourceStatus', 'manual-guide-article', 'manual-guide-minion-selection', '攻略正文', '攻略报告', '可导出', '技能总览', '召唤选择', '装备总览', '阶段攻略', 'collectBuildCandidates', 'builds/candidates.json', 'versionHistoryBuildCandidateSchema', 'versionHistoryBuildCandidateCount', 'versionHistoryBuildCandidateAvailableCount', 'versionHistoryBuildCandidateRegisteredCount', 'versionHistoryBuildCandidateStatuses', 'versionHistoryBuildCandidateSourceTypes', 'BD 候选', '可接入', 'collectSkillCatalog', 'skills catalog quality', 'versionHistorySkillCatalogSourceTypes', 'versionHistorySkillCatalogEntryCount', 'versionHistorySkillCatalogActiveCount', 'versionHistorySkillCatalogSupportCount', 'versionHistorySkillCatalogDetailCount', 'versionHistorySkillCatalogVerifiedCount', 'versionHistorySkillCatalogBoundaryStatuses', '技能目录', '技能详情', 'skill-data-not-live-price', 'collectMarketCandidates', 'market/candidates/index.json', 'versionHistoryMarketCandidateIndexSchema', 'versionHistoryMarketCandidateCount', 'versionHistoryMarketCandidateReadyCount', 'versionHistoryMarketCandidateGemCount', 'versionHistoryMarketCandidateHideoutCount', 'versionHistoryMarketCandidateStatuses', '候选快照', 'gearStatThresholds', 'craftingPlan', 'versionHistoryGearThresholdStageCount', 'versionHistoryGearThresholdRowCount', 'versionHistoryGearThresholdSourceStatus', 'versionHistoryCraftPlanCount', 'versionHistoryCraftStructuredCount', 'versionHistoryCraftSourceStatus', '装备门槛', '制作方案', 'validateNinjaExample', 'parsed-raw-pob-xml.example.json', 'data/versions.json']
    },
    {
      id: 'version-history-build-draft-quality',
      path: '/tools/version-history.html',
      mustContain: ['buildDraftPlaceholderPaths', 'draftMinionSelectionStats', 'draftGuideReportStats', 'draftRouteBindingStats', 'draftRouteCandidateStats', 'routeCandidates', 'versionHistoryBuildCandidateDraftCount', 'versionHistoryBuildCandidateDraftFileCount', 'versionHistoryBuildCandidateDraftPlaceholderCount', 'versionHistoryBuildCandidateDraftMinionSelectionGroups', 'versionHistoryBuildCandidateDraftMinionSelectionSkillRefs', 'versionHistoryBuildCandidateDraftMinionSelectionSupportRefs', 'versionHistoryBuildCandidateDraftMinionSelectionChooseWhen', 'versionHistoryBuildCandidateDraftMinionSelectionRules', 'versionHistoryBuildCandidateDraftGuideReportReadyCount', 'versionHistoryBuildCandidateDraftModuleCount', 'versionHistoryBuildCandidateDraftMissingModuleCount', 'versionHistoryBuildCandidateDraftRouteStageCount', 'versionHistoryBuildCandidateDraftRouteBoundCount', 'versionHistoryBuildCandidateDraftRouteMissingCount', 'versionHistoryBuildCandidateDraftRouteCandidateFileCount', 'versionHistoryBuildCandidateDraftRouteCandidateMissingFileCount', 'versionHistoryBuildCandidateDraftRouteCandidateStages', 'versionHistoryBuildCandidateDraftRouteCandidateFiles', 'BD 草稿', '草稿占位', '草稿召唤物', '草稿报告', '草稿缺口', '草稿路线', '候选路线文件']
    },
    {
      id: 'route-review',
      path: '/tools/route-review.html',
      mustContain: ['路线复核', 'Route Review', 'data-lang="zhCN"', 'data-lang="zhTW"', 'data-lang="en"', 'routeReviewLang', 'data-i18n="pageTitle"', 'data-i18n-aria="languageSelect"', 'applyStaticI18n', 'currentLang', '当前版本路线', 'Current Version Routes', 'routeReviewStats', 'routeReviewRows', 'routeReviewSummary', 'routePriorityQueue', 'renderPriorityQueue', 'priorityRows', 'routePriorityReason', 'routeReviewPriorityCount', 'routeReviewPriorityTopStage', 'routeReviewPriorityStages', 'routeReviewPriorityReasons', '手调优先队列', 'Hand-Tuning Priority Queue', 'candidateTitle', '未登记候选路线', 'Unregistered Candidate Routes', 'routeCandidateStats', 'routeCandidateRows', 'candidateRouteFile', 'candidateRoutePreviewHref', 'candidateRouteValidateCommand', 'candidateRouteReviewCommands', 'collectCandidateRoutes', 'renderCandidateRoutes', 'routeCandidateStageCount', 'routeCandidateFileCount', 'routeCandidateMissingCount', 'routeCandidateHandTunedCount', 'routeCandidateManualReviewCount', 'routeCandidateNodeCount', 'routeCandidatePreviewLinks', 'routeCandidateValidateCommands', '预览候选天赋树', 'Preview Candidate Tree', '.candidate.json', 'validate-route-candidate.mjs', 'validate-build-candidate-routes.mjs', 'routeReviewReportBlock', 'copyRouteReviewReportBtn', 'downloadRouteReviewReportBtn', 'buildRouteReviewMarkdown', 'updateRouteReviewReportDataset', 'routeReviewReportReady', 'routeReviewReportFormat', 'routeReviewReportLineCount', 'routeReviewReportSectionCount', 'routeReviewReportFileName', 'routeReviewReportPreviewChars', 'routeReviewReportPreview', 'routeReviewReportCandidateRows', 'routeReviewReportCandidateFiles', 'routeReviewReportCandidateMissing', 'routeReviewReportCopyStatus', 'markdownLink', 'manifestRoutePreviewHref', '路线复核报告 Markdown', 'Route Review Markdown', '复制 Markdown 报告', 'Copy Markdown Report', '已复制 Markdown 报告', 'Copied Markdown report', 'routeReviewCommandBlock', 'copyRouteReviewCommandsBtn', 'copyText', 'routeArchiveCommand', 'collectRouteRows', 'renderStats', 'renderRows', 'renderCommands', 'routeMatchesFilter', 'routeReviewReady', 'routeReviewTotal', 'routeReviewPending', 'routeReviewReplaceable', 'routeReviewManualReview', 'routeReviewReviewCount', 'routeReviewReviewMissing', 'routeReviewMismatchCount', 'routeReviewCommandText', 'routeReviewCommandCount', 'routeReviewCandidateCommandCount', 'routeReviewArchiveCommandCount', 'routeReviewCandidateCommandBuilds', 'routeReviewCommandCopyStatus', '路线复核命令', 'Route Review Commands', '复制路线复核命令', 'Copy Route Review Commands', '已复制路线复核命令', 'Copied route review commands', 'replaceable-until-hand-tuned', 'manual-review-required', 'projected-from-endgame-order', 'passive-tree.html?build=', 'archive-route.mjs']
    },
    {
      id: 'market-review',
      path: '/tools/market-review.html',
      mustContain: ['市场快照复核', 'Market Snapshot Review', 'data-lang="zhCN"', 'data-lang="zhTW"', 'data-lang="en"', 'data-i18n="pageTitle"', 'data-i18n-aria="languageSelect"', 'currentLang', 'applyStaticI18n', 'marketReviewLang', 'marketReviewUiLocalized', 'marketReviewStats', 'activeSnapshotRows', 'candidateRows', 'marketReviewCommandBlock', 'copyMarketReviewCommandsBtn', 'marketReviewCommandCopyStatus', 'market-review-report', 'marketReviewReportBlock', 'copyMarketReviewReportBtn', 'downloadMarketReviewReportBtn', 'buildMarketReviewMarkdown', 'marketReviewReady', 'marketReviewCandidateIndexSchema', 'marketReviewCandidateCount', 'marketReviewCandidateReadyCount', 'marketReviewCommandText', 'marketReviewCommandCount', 'marketReviewArchiveCommandCount', 'marketReviewReportReady', 'marketReviewReportPreview', 'sample-not-live', 'sample-manual-seed', 'examples/*.example.json', 'normalize-market-snapshot.mjs', 'archive-market-snapshot.mjs', 'validate-market.mjs', 'market/candidates/index.json', 'real-snapshot-v1', 'Copied market review commands', 'Copied Markdown report']
    },
    {
      id: 'data-update',
      path: '/tools/data-update.html',
      mustContain: ['数据更新', 'version-history.html', 'route-review.html', 'market-review.html', '路线复核', '市场复核', 'serve.mjs', '--strict-port', 'validate-all.mjs', 'validate-runtime-pages.mjs', 'validate-suite.mjs', '--serve', 'copyLocalCommandsBtn', 'localCommandText', 'localCommandCopyStatus', 'registerLocalCommands', 'dataUpdateLocalCommandText', 'dataUpdateLocalCommandLineCount', 'dataUpdateLocalCommandCopyStatus', '复制本地命令', '已复制本地命令', 'create-version.mjs', 'diff-tree.mjs', 'generate-version-log.mjs', 'switch-current.mjs', 'validate-skills.mjs', 'fetch-poe2db-skills.mjs', 'fetch-poe2db-skill-details.mjs', 'archive-skill-catalog.mjs', '技能资料接入', 'skillFiles', 'skillCatalogQuality', 'skillCatalogQualityLine', 'skillCatalogArchiveCommands', 'skillCatalogArchiveCommand', 'skillCatalogArchiveLine', 'copySkillCatalogArchiveCommandsBtn', 'dataUpdateSkillCatalogArchiveCommandText', 'dataUpdateSkillCatalogArchiveCopyStatus', 'dataUpdateSkillCatalogArchiveCommandCount', 'dataUpdateSkillCatalogArchiveCandidateKeys', '复制技能归档命令', 'dataUpdateSkillCatalogSourceType', 'dataUpdateSkillCatalogEntryCount', 'dataUpdateSkillCatalogActiveCount', 'dataUpdateSkillCatalogSupportCount', 'dataUpdateSkillCatalogDetailCount', 'dataUpdateSkillCatalogVerifiedCount', 'dataUpdateSkillCatalogNeedsReviewCount', 'dataUpdateSkillCatalogFromCount', 'dataUpdateSkillCatalogRequirementCount', 'dataUpdateSkillCatalogBoundaryStatus', '当前技能质量', 'skill-data-not-live-price', 'normalize-market-snapshot.mjs', '默认 dry-run', 'archive-market-snapshot.mjs', 'market/candidates', 'market/candidates/index.json', 'marketCandidateQuality', 'marketCandidatePreview', 'collectMarketCandidatePreviews', 'renderMarketCandidatePreview', 'marketCandidateEntryScore', 'marketCandidateEntryLine', 'dataUpdateMarketCandidatePreviewCount', 'dataUpdateMarketCandidatePreviewEntryCount', 'dataUpdateMarketCandidatePreviewErrorCount', '候选明细预览', 'marketCandidateArchiveCommands', 'marketCandidateArchiveCommand', 'marketCandidateArchiveLine', 'copyMarketCandidateArchiveCommandsBtn', 'dataUpdateMarketCandidateArchiveCommandText', 'dataUpdateMarketCandidateArchiveCopyStatus', 'dataUpdateMarketCandidateArchiveCommandCount', 'dataUpdateMarketCandidateArchiveReadyKinds', 'validateMarketCandidateIndex', 'dataUpdateMarketCandidateIndexSchema', 'dataUpdateMarketCandidateCount', 'dataUpdateMarketCandidateReadyCount', 'dataUpdateMarketCandidateGemCount', 'dataUpdateMarketCandidateHideoutCount', 'dataUpdateMarketCandidateStatuses', '候选归档命令', '复制候选归档命令', 'validationStatus=ok', 'examples/*.example.json', '归档脚本默认拒绝', 'marketRawSnapshotTemplates', 'marketRawTemplateCommand', 'marketRawTemplateLine', 'copyMarketRawTemplateCommandsBtn', 'dataUpdateMarketRawTemplateCommandText', 'dataUpdateMarketRawTemplateCopyStatus', 'copyDatasetCommandText', 'setCommandCopyButton', 'rawTemplateEntriesForPreview', 'raw-gem-flips-v1.example.json', 'raw-hideout-flips-v1.example.json', 'dataUpdateMarketRawGemStatus', 'dataUpdateMarketRawHideoutStatus', 'dataUpdateMarketRawTemplateCommandCount', '复制 raw 模板命令', '原始快照模板', 'archive-route.mjs', 'routeArchiveCommands', 'routeArchiveCommand', 'routeArchiveLine', 'copyRouteArchiveCommandsBtn', 'dataUpdateRouteArchiveCandidateCount', 'dataUpdateRouteArchiveCommandText', 'dataUpdateRouteArchiveCopyStatus', 'dataUpdateRouteArchiveCommandCount', 'dataUpdateRouteArchiveStages', '复制路线归档命令', '手调路线归档', 'hand-tuned-manual', 'archive-ninja-import.mjs', 'ninjaArchiveQuality', 'ninjaArchiveCommands', 'ninjaArchiveCommand', 'ninjaArchiveCommandLine', 'copyNinjaArchiveCommandsBtn', 'dataUpdateNinjaArchiveCommandText', 'dataUpdateNinjaArchiveCopyStatus', 'dataUpdateNinjaArchiveCommandCount', 'dataUpdateNinjaArchiveCandidateKeys', '复制忍者归档命令', 'collectNinjaArchives', 'ninjaArchiveLine', 'dataUpdateNinjaArchiveCount', 'dataUpdateNinjaArchiveReadyCount', 'dataUpdateNinjaArchiveMatchedCount', 'dataUpdateNinjaArchiveNeedsReviewCount', 'dataUpdateNinjaArchiveSourceUnknownCount', 'dataUpdateNinjaArchiveFormats', '当前归档质量', 'ninjaContract', 'ninjaExamples', 'parsed-raw-pob-xml.example.json', 'parserHintsFromSchema', 'validateNinjaExample', 'dataUpdateReady', 'dataUpdateNinjaParserHints', 'dataUpdateNinjaExampleCount', 'dataUpdateNinjaExamplePobXmlCount', 'marketQuality', 'marketExampleQuality', 'real-gem-flips-v1.example.json', 'real-hideout-flips-v1.example.json', 'dataUpdateVersion', 'dataUpdateVersionSource', 'dataUpdateDataRoot', '版本来源', 'scaffold-build.mjs', 'scaffold-route.mjs', 'validate-route-candidate.mjs', 'validate-build-candidate-routes.mjs', 'validate-build-candidate-readiness.mjs', 'register-build.mjs', 'validate-build-candidates.mjs', 'validate-build-guides.mjs', 'dry-run 检查 BD 脚手架', '路线脚手架', '预览 manifest entry', '候选路线批量校验', 'candidateRouteFileStats', 'buildCandidateReadiness', 'publishReadiness', 'dataUpdateBuildReadinessMaterialReadyCount', 'dataUpdateBuildReadinessReviewReadyCount', 'dataUpdateBuildReadinessPublishReadyCount', 'dataUpdateBuildReadinessManifestPublishedCount', 'dataUpdateBuildReadinessRegisteredBuildCount', 'dataUpdateBuildReadinessRouteCandidateFileCount', 'dataUpdateBuildReadinessRouteCandidateFileFoundCount', 'dataUpdateBuildReadinessRouteCandidateHandTunedCount', 'dataUpdateBuildReadinessManifestRouteCount', 'dataUpdateBuildReadinessBlockedBy', 'dataUpdateBuildReadinessWarnings', '发布审计', '素材', '复核', '正式发布', '阻塞', '未登记正式 BD', '未登记正式路线', 'buildGuideWritingStats', 'guideWritingStats', 'guideReportReady', 'guide-markdown-report', 'buildOnboardingCommands', 'collectBuildOnboardingCandidates', 'normalizeBuildCandidate', 'buildOnboardingCommand', 'buildOnboardingLine', 'copyBuildOnboardingCommandsBtn', 'dataUpdateBuildOnboardingCommandText', 'dataUpdateBuildOnboardingCopyStatus', 'dataUpdateBuildOnboardingCommandCount', 'dataUpdateBuildOnboardingCandidateIds', 'dataUpdateBuildOnboardingSourceFile', 'dataUpdateBuildOnboardingSourceType', 'dataUpdateBuildOnboardingSchema', 'dataUpdateBuildOnboardingCandidateCount', 'dataUpdateBuildOnboardingAvailableCount', '复制新增 BD 命令', 'builds/candidates.json', 'infernalist-minions', 'dataUpdateBuildGuideCompleteCount', 'dataUpdateBuildGuideMissingCount', 'dataUpdateBuildGuideReportReadyCount', 'dataUpdateBuildGuideSkillOverviewCards', 'dataUpdateBuildGuideSkillOverviewChecks', 'dataUpdateBuildGuideGearOverviewCards', 'dataUpdateBuildGuideGearOverviewChecks', 'dataUpdateBuildGuideStagePlaybooks', 'dataUpdateBuildGuideExecutionStages', 'dataUpdateBuildGuideSourceStatus', '攻略正文/报告质量', '攻略报告', '报告导出', '可导出', 'manual-guide-article', 'manual-guide-skill-flow', 'manual-guide-gear-flow', 'dataUpdateBuildGearThresholdStageCount', 'dataUpdateBuildGearThresholdRowCount', 'dataUpdateBuildGearThresholdMissing', 'dataUpdateBuildGearThresholdSourceStatus', 'dataUpdateBuildCraftPlanCount', 'dataUpdateBuildCraftStructuredCount', 'dataUpdateBuildCraftMissing', 'dataUpdateBuildCraftSourceStatus', 'craftPlanStats', 'gearThresholdStats', '装备门槛', '制作方案', 'dataUpdateMarketGemEvidenceCoverage', 'dataUpdateMarketGemAvgConfidence', 'dataUpdateMarketGemMinBuyDepth', 'dataUpdateMarketGemMinSellDepth', 'dataUpdateMarketGemFreshnessStatus', 'dataUpdateMarketHideoutEvidenceCoverage', 'dataUpdateMarketHideoutAvgConfidence', 'dataUpdateMarketHideoutMinBuyDepth', 'dataUpdateMarketHideoutMinSellDepth', 'dataUpdateMarketExampleGemStatus', 'dataUpdateMarketExampleHideoutStatus', 'routeQualityStats', '需人工复核', 'routeQualityHandTuned']
    },
    {
      id: 'data-update-build-candidate-source-command',
      path: '/tools/data-update.html',
      mustContain: ['--from-candidate']
    },
    {
      id: 'data-update-build-draft-quality',
      path: '/tools/data-update.html',
      mustContain: ['buildDraftPlaceholderPaths', 'draftMinionSelectionStats', 'draftGuideReportStats', 'draftRouteBindingStats', 'dataUpdateBuildOnboardingDraftCount', 'dataUpdateBuildOnboardingDraftFileFoundCount', 'dataUpdateBuildOnboardingDraftGuideFoundCount', 'dataUpdateBuildOnboardingDraftPlaceholderCount', 'dataUpdateBuildOnboardingDraftGuideStatuses', 'dataUpdateBuildOnboardingDraftMinionSelectionGroups', 'dataUpdateBuildOnboardingDraftMinionSelectionSkillRefs', 'dataUpdateBuildOnboardingDraftMinionSelectionSupportRefs', 'dataUpdateBuildOnboardingDraftMinionSelectionChooseWhen', 'dataUpdateBuildOnboardingDraftMinionSelectionRules', 'dataUpdateBuildOnboardingDraftGuideReportReadyCount', 'dataUpdateBuildOnboardingDraftModuleCount', 'dataUpdateBuildOnboardingDraftMissingModuleCount', 'dataUpdateBuildOnboardingDraftRouteStageCount', 'dataUpdateBuildOnboardingDraftRouteBoundCount', 'dataUpdateBuildOnboardingDraftRouteMissingCount', '草稿：', '页面', '占位符', '召唤物选择', '报告', '缺口', '路线']
    },
    {
      id: 'data-update-build-candidate-route-scaffold',
      path: '/tools/data-update.html',
      mustContain: ['scaffold-route.mjs', 'validate-route-candidate.mjs', '候选路线准备', 'buildCandidateRouteScaffoldCommands', 'buildCandidateRouteScaffoldCommand', 'buildCandidateRouteScaffoldLine', 'collectBuildCandidateRouteScaffolds', 'collectBuildCandidateExistingRoutes', 'buildCandidateExistingRouteLine', 'buildCandidateExistingRoutePreviewHref', 'copyBuildCandidateRouteScaffoldCommandsBtn', 'dataUpdateBuildCandidateRouteScaffoldStageCount', 'dataUpdateBuildCandidateRouteExistingCount', 'dataUpdateBuildCandidateRouteMissingCandidateFileCount', 'dataUpdateBuildCandidateRouteScaffoldCommandCount', 'dataUpdateBuildCandidateRouteScaffoldStages', 'dataUpdateBuildCandidateRouteScaffoldBuildIds', 'dataUpdateBuildCandidateRouteExistingStages', 'dataUpdateBuildCandidateRouteExistingFiles', 'dataUpdateBuildCandidateRouteScaffoldCommandText', 'dataUpdateBuildCandidateRouteScaffoldPreviewLinks', 'dataUpdateBuildCandidateRouteScaffoldCopyStatus', '复制候选路线命令', '已复制候选路线命令', '--nodes <node-ids>', 'validate-route-candidate.mjs', '预览候选天赋树', '已有候选文件', '写出候选文件后再出现预览入口', 'manual-review-required']
    },
    {
      id: 'data-update-guide-minion-selection',
      path: '/tools/data-update.html',
      mustContain: ['dataUpdateBuildGuideMinionSelectionGroups', 'dataUpdateBuildGuideMinionSelectionSkillRefs', 'dataUpdateBuildGuideMinionSelectionSupportRefs', 'dataUpdateBuildGuideMinionSelectionRules', 'manual-guide-minion-selection', '召唤选择']
    },
    {
      id: 'infernalist-draft-guide',
      path: '/builds/infernalist-minions.html',
      mustContain: ['魔巫召唤开荒草稿', 'Draft, Not Published', 'infernalistDraftReady', 'infernalistDraftGuideBoundary', 'unpublished-draft', 'infernalistDraftPlaceholderCount', 'infernalistDraftRegistered', 'infernalistDraftMissingModuleCount', 'infernalistDraftCommandText', 'infernalistDraftCommandCopyStatus', 'placeholderTerms', 'placeholderPaths', 'moduleRows', 'guideArticleStats', 'guideArticleGrid', 'infernalistDraftGuideArticleReady', 'infernalistDraftGuideArticleSections', 'infernalistDraftGuideArticleChecks', 'skillOverviewStats', 'skillOverviewGrid', 'infernalistDraftSkillOverviewReady', 'infernalistDraftSkillOverviewCards', 'infernalistDraftSkillOverviewChecks', 'gearDraftStats', 'gearOverviewGrid', 'gearPriorityRows', 'earlyGearPriorityGrid', 'gearThresholdGrid', 'infernalistDraftGearReady', 'infernalistDraftGearOverviewCards', 'infernalistDraftGearOverviewChecks', 'infernalistDraftGearPriorityRows', 'infernalistDraftEarlyGearPriorityRows', 'infernalistDraftGearThresholdStages', 'infernalistDraftGearThresholdRows', 'infernalistDraftGearStagePlanRows', 'stageDraftStats', 'stageGuideGrid', 'executionPlanRows', 'infernalistDraftStageReady', 'infernalistDraftStageCount', 'infernalistDraftStagePlaybooks', 'infernalistDraftStageChecks', 'infernalistDraftStageMistakes', 'infernalistDraftExecutionRows', 'data-stage-passive-candidate', 'stagePassiveCandidate', 'infernalistDraftStagePassiveButtonCount', 'infernalistDraftStagePassiveButtonStages', 'infernalistDraftStagePassiveButtonLinks', 'Candidate Passive Tree', '候选天赋', 'Candidate route, manual review pending', 'routeCandidateRows', 'routeCandidateStats', 'routeCandidateGrid', 'routeCandidateStats', 'infernalistDraftRouteCandidateStageCount', 'infernalistDraftRouteCandidateFileCount', 'infernalistDraftRouteCandidateMissingCount', 'infernalistDraftRouteCandidateFiles', 'infernalistDraftRouteCandidateMissingStages', 'infernalistDraftRouteCandidatePreviewLinks', 'infernalistDraftRouteCandidateValidateCommands', 'infernalistDraftRouteCandidateScaffoldCommands', 'validate-route-candidate.mjs', 'scaffold-route.mjs', '阶段天赋候选路线', 'Staged Passive Candidate Routes', 'Preview Candidate Tree', 'Crafting Plans', 'craftingDraftStats', 'craftingPlanGrid', 'infernalistDraftCraftingReady', 'infernalistDraftCraftPlanCount', 'infernalistDraftCraftStructuredCount', 'infernalistDraftCraftPriorityModCount', 'infernalistDraftCraftMaterialCount', 'infernalistDraftCraftStepCount', 'infernalistDraftCraftSuccessCheckCount', 'infernalistDraftCraftFallbackCount', 'infernalistDraftCraftSourceStatus', 'guideReportStats', 'buildGuideReport', 'guideReportBlock', 'copyGuideReportBtn', 'downloadGuideReportBtn', 'infernalistDraftGuideReportReady', 'infernalistDraftGuideReportFormat', 'infernalistDraftGuideReportLineCount', 'infernalistDraftGuideReportSectionCount', 'infernalistDraftGuideReportPreviewChars', 'infernalistDraftGuideReportFileName', 'infernalistDraftGuideReportCopyStatus', 'infernalistDraftGuideReportDownloadStatus', 'minionSelectionStats', 'infernalistDraftMinionSelectionReady', 'infernalistDraftMinionSelectionGroups', 'infernalistDraftMinionSelectionSkillRefs', 'infernalistDraftMinionSelectionSupportRefs', 'infernalistDraftMinionSelectionRules', '攻略正文', 'Guide Article', '技能总览', 'Skill Overview', '装备总览', 'Gear Overview', '装备槽位优先级', 'Gear Slot Priorities', '阶段攻略', 'Stage Guide', '照抄执行路线', 'Copyable Execution Plan', '制作方案', '攻略报告', 'Guide Report', 'Draft report, not published', '召唤物选择指南', 'Minion selection guide', 'copyCommandsBtn', 'data-lang="zhCN"', 'data-lang="zhTW"', 'data-lang="en"', 'validate-build-candidates.mjs', 'validate-build-candidate-readiness.mjs', 'register-build.mjs']
    },
    {
      id: 'tactician-guide',
      path: '/builds/tactician-supporting-fire.html',
      mustContain: [
        '战术家',
        '阅读全文',
        '阶段天赋',
        '终局天赋工具',
        'guide-compact',
        'view-mode',
        'compact-note',
        'advanced-panel',
        'readGuideViewBtn',
        'fullGuideViewBtn',
        'guideViewStatus',
        'compactGuideNote',
        'data-guide-view-mode',
        'setGuideViewMode',
        'guideViewMode',
        'guideAdvancedPanelCount',
        'guideAdvancedPanelsVisible',
        '阅读版',
        '完整数据',
        '默认只展示',
        '装备阶段检查',
        '制作细节',
        'guide-overview',
        'guideStats',
        'guide-article',
        'guideArticleGrid',
        'guideArticleIntro',
        'guideArticleStatus',
        'guideArticleSections',
        'guideArticleCheckCount',
        'guideArticleLang',
        'guideArticleSourceStatus',
        'guide-markdown-report',
        'guideMarkdownReportBlock',
        'copyGuideMarkdownBtn',
        'downloadGuideMarkdownBtn',
        'buildGuideMarkdownReport',
        'updateGuideMarkdownReport',
        'guideMarkdownReady',
        'guideMarkdownFormat',
        'guideMarkdownLineCount',
        'guideMarkdownSectionCount',
        'guideMarkdownFileName',
        'guideMarkdownPreviewChars',
        'guideMarkdownCopyStatus',
        '复制攻略 Markdown',
        'Copy Guide Markdown',
        '已复制攻略 Markdown',
        'Copied guide Markdown',
        'guideLangSwitch',
        'data-guide-lang',
        'guidePageLang',
        '页面语言选择',
        'manual-guide-article',
        '开荒正文速读',
        '起什么职业',
        '什么时候转型',
        'evidence-summary',
        'evidenceSummaryGrid',
        'guideEvidenceSummaryCount',
        'guideEvidencePendingCount',
        'guideEvidenceProjectedRoutes',
        'guideEvidenceMarketStatus',
        'stage-tree',
        'guide-strategy',
        'guideStrategyGrid',
        'guideStrategyCoreSteps',
        'guideStrategyPowerSignals',
        'guideStrategyFailureRows',
        'guideStrategyDecisionRules',
        'execution-plan',
        'executionPlanRows',
        'executionPlanCount',
        'executionPlanBuyFirstCount',
        'executionPlanStopLineCount',
        'executionPlanFallbackCount',
        'executionPlanNextGateCount',
        'stage-data-coverage',
        'stageDataCoverageRows',
        'stageDataCoverageStageCount',
        'stageDataCoverageRouteCount',
        'stageDataCoverageGearStageCount',
        'stageDataCoverageThresholdStageCount',
        'stageDataCoverageCraftStageCount',
        'stageDataCoverageFullyCoveredCount',
        'leveling-stages',
        'skill-progression',
        'skill-acquisition',
        'skillAcquisitionStatus',
        'skillAcquisitionEvidenceHead',
        'skillAcquisitionEvidenceRows',
        'skill-source-matrix',
        'skillSourceMatrixRows',
        'skillSourceMatrixDetailCount',
        'skillSourceMatrixRequirementCount',
        'skillSourceMatrixFromCount',
        'skillOverviewGrid',
        'skillOverviewCardCount',
        'skillOverviewCheckCount',
        'skillOverviewLang',
        'skillOverviewSourceStatus',
        'manual-guide-skill-flow',
        '这套技能到底怎么玩',
        '先分清技能本体和辅助宝石',
        'gear-priorities',
        'gearOverviewGrid',
        'gearOverviewCardCount',
        'gearOverviewCheckCount',
        'gearOverviewSourceStatus',
        'manual-guide-gear-flow',
        '装备先解决短板，再追毕业件',
        '多数部位先买半成品',
        'early-gear-priority',
        'gear-stat-thresholds',
        'gearStatThresholdRows',
        'gearStatThresholdStageCount',
        'gearStatThresholdRowCount',
        'gearStatThresholdSourceStatus',
        '攻略手工阈值',
        'crafting-plan',
        'craftingPlanStructuredCount',
        'craftingPlanPriorityModCount',
        'craftingPlanMaterialCount',
        'craftingPlanSuccessCheckCount',
        'craftingPlanFallbackCount',
        '成功判定',
        '失败退路',
        'gearAvoidCount',
        'skillAcquisitionCount',
        'skillAcquisitionConfirmCount',
        'skillAcquisitionSourceUseCount',
        'skillAcquisitionFallbackCount',
        'skillAcquisitionEvidenceRows',
        'skillAcquisitionEvidenceLang',
        'earlyGearPriorityCount',
        'earlyGearPriorityItemCount',
        '阶段天赋',
        'data-stage-route',
        'route-note',
        'levelingStageRows',
        'stageTreeLinks',
        'stagePlaybookCheckCount',
        'stagePlaybookMistakeCount',
        'levelingStageRouteReviewCount',
        'data-route-review',
        'supportSelectionRulesTitle',
        'supportSelectionRuleCount',
        'minionSelectionGuide',
        'minionSelectionGroupCount',
        'minionSelectionSkillRefs',
        'minionSelectionSupportRefs',
        'minionSelectionChooseWhenCount',
        'minionSelectionSourceStatus',
        'data-minion-selection',
        'supportDecisionMatrixTitle',
        'supportDecisionMatrixCount',
        'supportDecisionMatrixSkillRefs',
        'supportDecisionMatrixSupportRefs',
        'skillTroubleshootingTitle',
        'skillTroubleshootingCount',
        'skillTroubleshootingCheckCount',
        'skillTroubleshootingAddRefs',
        'skillTroubleshootingCutRefs',
        'data-skill-troubleshooting',
        '技能问题诊断',
        'linkRuleCount',
        'guideSkillCatalogSourceType',
        'guideSkillCatalogNeedsReviewCount',
        'guideSkillCatalogDetailCount',
        'guideSkillOfficialAliasCount',
        'guideSupportEvidenceMatched',
        'guideSupportEvidenceTotal',
        'skillAcquisitionDetailCount',
        'skillAcquisitionFromCount',
        'skillAcquisitionRequirementCount',
        'skillAcquisitionSnapshotStatus',
        'skillAcquisitionEvidenceCoverage',
        'skillAcquisitionBoundaryStatus',
        'skillAcquisitionEvidenceNoteCount',
        'snapshot-evidence-not-vendor-act',
        '编年史来源与需求',
        'Open skill catalog'
      ]
    },
    {
      id: 'passive-tree-endgame',
      path: '/tools/passive-tree.html?build=tactician-supporting-fire&stage=endgame',
      mustContain: ['POE2 Tools - Passive Tree Viewer', 'pageTitle', 'nodesBadge', 'languageSelect', 'routeMeta', 'routeExportBlock', 'copyNodesBtn', 'copyShareUrlBtn', 'downloadRouteBtn', 'routeExportPayload', 'renderRouteExport', 'treeExportReady', 'treeExportNodeList', 'treeShareUrl', 'treeRouteOrigin', 'treeRouteReviewStatus', 'custom-nodes', 'query-nodes', 'route-file', 'safeRouteFile', 'loadRouteFileData', 'candidateRoutesForRouteFile', 'routeFileFromCandidate', 'treeRouteFileStageCount', 'treeRouteFileStageIds', 'treeRouteFileSelectedFile', 'treeRouteFileCanSwitch', 'minion-transition', 'red-map-prep']
    },
    {
      id: 'passive-tree-custom-nodes',
      path: '/tools/passive-tree.html?nodes=6077,27296&title=smoke',
      mustContain: ['POE2 Tools - Passive Tree Viewer', 'parseNodeIds', 'custom-nodes', 'query-nodes', 'routeExportBlock', 'copyNodesBtn', 'treeExportMode', 'treeExportStage', 'route-file']
    },
    {
      id: 'gem-flip',
      path: '/tools/gem-flip.html',
      mustContain: ['技能倒卖', 'market-review.html', 'marketReview', 'Market Review', 'snapshotStatus', '保本卖价', '安全边际', '市场证据', 'profitFilter', 'liquidityFilter', 'riskFilter', 'evidenceFilter', 'marketVisibleEntryCount', 'marketFilteredOutCount', 'marketEvidenceAvailable', 'marketEvidenceEntryCount', 'marketEvidenceAvgConfidence', 'marketEvidenceMinBuyDepth', 'marketEvidenceMinSellDepth', 'marketBreakEvenAvailable', 'marketSafetyMarginAvailable', 'marketDecision', 'decisionTop', 'decisionCapital', 'decisionRisk', 'decisionAction', 'marketDecisionTopId', 'marketDecisionCapital', 'marketDecisionNetProfit', 'marketDecisionRisk', 'marketDecisionAction', 'budgetPlan', 'budgetPlanTop', 'budgetPlanCapital', 'budgetPlanExpected', 'budgetPlanAction', 'budgetCapitalInput', 'copyBudgetUrlBtn', 'budgetCopyStatus', 'copyBudgetUrl', 'marketBudgetPlanCopyStatus', 'readBudgetCapital', 'applyBudgetQuery', 'syncBudgetQuery', 'marketBudgetPlanShareUrl', 'renderBudgetPlan', 'marketBudgetPlanReady', 'marketBudgetPlanCapital', 'marketBudgetPlanTopId', 'marketBudgetPlanUnits', 'marketBudgetPlanSpend', 'marketBudgetPlanNetProfit', 'marketBudgetPlanAction', '预算执行计划', 'Budget Execution Plan', 'Simulated capital', 'Copy Budget Link', 'marketRankChange', 'rankChangeMode', 'rankChangeDefault', 'rankChangeFilters', 'rankChangeWhy', 'marketRankChangeMode', 'marketRankChangeDefaultTopId', 'marketRankChangeCurrentTopId', 'marketRankChangeFilteredOut', 'marketRankChangeChanged', 'marketRankChangeReasonCount', 'marketQuality', 'dataQualityStatus', 'marketQualityStatus', 'marketQualityEvidenceCoverage', 'marketQualityAvgConfidence', 'marketQualityMinBuyDepth', 'marketQualityMinSellDepth', 'marketQualityHasFilters', 'marketFreshnessStatus', 'marketCandidateQueue', 'candidateQueueStatus', 'renderCandidateQueue', 'marketCandidateIndexSchema', 'marketCandidateCount', 'marketCandidateReadyCount', 'marketCandidateCurrentKind', 'marketCandidateCurrentKindCount', 'marketCandidateCurrentKindReadyCount', 'marketCandidateStatuses', '候选快照队列', 'Candidate Snapshot Queue', 'marketLang', 'marketUiLocalized', 'data-i18n="pageHeading"', 'data-i18n-option="activeKind"', 'Skill Flipping', 'Break-even Sell']
    },
    {
      id: 'skill-catalog',
      path: '/tools/skill-catalog.html',
      mustContain: ['技能资料', 'skillCatalogVersion', 'skillCatalogDataRoot', 'metaVersion', 'metaVersionId', 'skillCatalogEntryCount', 'skillCatalogGemTierCount', 'skillCatalogDetailCount', 'skillCatalogFromCount', 'skillCatalogRequirementCount', 'skillCatalogQualityFilter', 'metaFromCount', 'metaRequirementCount', 'fromSource', 'requirementData', 'From 来源', '需求信息', 'From source', 'Requirement data', 'skillCatalogLang', 'skillCatalogUiLocalized', 'data-i18n=\"pageHeading\"', 'data-i18n-option=\"activeKind\"', 'kindFilter', 'verificationFilter', 'qualityFilter', 'has-detail', 'has-from', 'has-requirement', 'missing-detail', '资料质量', 'Data Quality', 'manual-seed-needs-poe2db', 'Gem tier', 'Detail source', 'Usage Boundaries']
    },
    {
      id: 'hideout-flip',
      path: '/tools/hideout-flip.html',
      mustContain: ['藏身处金币倒卖', 'market-review.html', 'marketReview', 'Market Review', 'snapshotStatus', '保本卖价', '安全边际', '市场证据', 'profitFilter', 'liquidityFilter', 'riskFilter', 'evidenceFilter', 'marketVisibleEntryCount', 'marketFilteredOutCount', 'marketEvidenceAvailable', 'marketEvidenceEntryCount', 'marketEvidenceAvgConfidence', 'marketEvidenceMinBuyDepth', 'marketEvidenceMinSellDepth', 'marketBreakEvenAvailable', 'marketSafetyMarginAvailable', 'marketDecision', 'decisionTop', 'decisionCapital', 'decisionRisk', 'decisionAction', 'marketDecisionTopId', 'marketDecisionGoldCost', 'marketDecisionCashCost', 'marketDecisionNetProfit', 'marketDecisionRisk', 'marketDecisionAction', 'goldBudgetPlan', 'budgetPlanTop', 'budgetPlanCapital', 'budgetPlanExpected', 'budgetPlanAction', 'budgetGoldInput', 'budgetCashInput', 'copyBudgetUrlBtn', 'budgetCopyStatus', 'copyBudgetUrl', 'marketGoldBudgetPlanCopyStatus', 'readBudgetInputs', 'applyBudgetQuery', 'syncBudgetQuery', 'marketGoldBudgetPlanShareUrl', 'renderBudgetPlan', 'marketGoldBudgetPlanReady', 'marketGoldBudgetPlanGold', 'marketGoldBudgetPlanCash', 'marketGoldBudgetPlanTopId', 'marketGoldBudgetPlanUnits', 'marketGoldBudgetPlanGoldSpend', 'marketGoldBudgetPlanCashSpend', 'marketGoldBudgetPlanNetProfit', 'marketGoldBudgetPlanAction', '金币预算计划', 'Gold Budget Plan', 'Simulated gold', 'Simulated currency', 'Copy Budget Link', 'marketRankChange', 'rankChangeMode', 'rankChangeDefault', 'rankChangeFilters', 'rankChangeWhy', 'marketRankChangeMode', 'marketRankChangeDefaultTopId', 'marketRankChangeCurrentTopId', 'marketRankChangeFilteredOut', 'marketRankChangeChanged', 'marketRankChangeReasonCount', 'marketQuality', 'dataQualityStatus', 'marketQualityStatus', 'marketQualityEvidenceCoverage', 'marketQualityAvgConfidence', 'marketQualityMinBuyDepth', 'marketQualityMinSellDepth', 'marketQualityHasFilters', 'marketFreshnessStatus', 'marketCandidateQueue', 'candidateQueueStatus', 'renderCandidateQueue', 'marketCandidateIndexSchema', 'marketCandidateCount', 'marketCandidateReadyCount', 'marketCandidateCurrentKind', 'marketCandidateCurrentKindCount', 'marketCandidateCurrentKindReadyCount', 'marketCandidateStatuses', '候选快照队列', 'Candidate Snapshot Queue', 'marketLang', 'marketUiLocalized', 'data-i18n="pageHeading"', 'data-i18n-option="currencyKind"', 'Hideout Gold Flipping', 'Profit per 10k Gold']
    },
    {
      id: 'ninja-import',
      path: '/tools/ninja-import.html',
      mustContain: ['忍者网配置解析', 'profileView', 'profileTabs', 'profileEquipmentGrid', 'profileSkillGroups', 'profilePassiveStats', 'profileGemGroups', 'renderProfileView', 'groupedSkillsForProfile', 'ninjaProfileViewReady', 'ninjaProfileEquipmentCount', 'ninjaProfileSkillGroupCount', 'ninjaProfileActiveGemCount', 'ninjaProfileSupportGemCount', 'ninjaProfilePassiveCount', '角色配置视图', '装备界面', '技能界面', '天赋界面', '宝石界面', 'Character Config View', 'parseBtn', 'compareBuild', 'parsedPassiveTreeHref', 'openMissingPassives', 'missingPassiveTreeHref', 'extractPassiveIdsFromText', 'collectPobSkillGroups', 'pob-code', 'pob-xml', 'parsePobXmlText', 'tryParsePobCode', 'pob-compressed-code', 'sourceEvidence', 'formatProfile', 'versionCompatibility', 'ninjaVersionCompatibilityStatus', 'ninjaVersionCompatibilityWarnings', 'ninjaComparedVersion', 'ninjaExportPoe2dbVersion', 'ninjaSourceEvidenceSkills', 'ninjaPobSkillGroupsDetected', 'ninjaFormatProfileInputFormat', 'ninjaFormatProfileSkillGroupPath', 'ninjaFormatProfileItemPath', 'ninjaFormatProfilePassivePath', 'ninjaFormatProfileRiskCount', 'catalogSkillMatch', 'ninjaSkillCatalogSourceType', 'ninjaSkillCatalogAliasMatched', 'ninjaBuildAliasMatchEnabled', 'ninjaBuildAliasMatched', 'ninjaGearCategoryMatched', 'ninjaGearCategoryExpected', 'ninjaGearSlotMatched', 'ninjaGearSlotExpected', 'ninjaGearSlotAverageScore', 'ninjaGearSlotGaps', 'gearModCount', 'gearStatRollCount', 'gearSlotRolls', 'gearSlotThresholds', 'gearThresholdDefaults', 'slotThresholdRows', 'parser-default-threshold', 'gearStageReadiness', 'analyzeGearStageReadiness', 'manual-guide-threshold', 'ninjaGearStageReadinessStages', 'ninjaGearStageReadinessRows', 'ninjaGearStageReadinessPassed', 'ninjaGearStageReadinessBestStage', 'ninjaGearStageReadinessSourceStatus', 'analyzePassiveStageReadiness', 'analyzeBuildProgression', 'stageTreeUrl', 'openBestPassiveStage', 'openBestStageMissingPassives', 'passiveStageReadiness', 'progressionSuggestion', 'ninjaPassiveStageReadinessStages', 'ninjaPassiveStageReadinessBestStage', 'ninjaPassiveStageReadinessSourceStatus', 'ninjaBestPassiveStageTreeHref', 'ninjaBestPassiveStageMissingHref', 'ninjaBestPassiveStageMissingCount', 'ninjaProgressionPassiveBestStage', 'ninjaProgressionGearBestStage', 'ninjaProgressionBottleneck', 'ninjaProgressionReviewStage', 'ninjaProgressionSourceStatus', 'ninjaGearModCount', 'ninjaGearStatRollCount', 'ninjaGearSlotRollSummaryCount', 'ninjaGearSlotThresholdRows', 'ninjaGearSlotThresholdPassed', 'ninjaGearSlotThresholdWeak', 'ninjaGearSlotThresholdMissing', 'supportMatrixSkillMatch', 'ninjaSupportDecisionRows', 'ninjaSupportDecisionSkillMatched', 'ninjaSupportDecisionFirstMatched', 'ninjaSupportDecisionContextRows', 'analyzeSkillTroubleshooting', 'skillTroubleshooting', 'ninjaSkillTroubleshootingRows', 'ninjaSkillTroubleshootingTriggered', 'ninjaSkillTroubleshootingMissingAdd', 'ninjaSkillTroubleshootingPresentCut', 'ninjaSkillTroubleshootingSourceStatus', 'build-guide-troubleshooting', '技能问题诊断', 'Skill troubleshooting', 'analyzeGearTroubleshooting', 'gearTroubleshooting', 'ninjaGearTroubleshootingRows', 'ninjaGearTroubleshootingTriggered', 'ninjaGearTroubleshootingGaps', 'ninjaGearTroubleshootingActions', 'ninjaGearTroubleshootingStopLines', 'ninjaGearTroubleshootingSourceStatus', 'build-guide-gear-troubleshooting', '装备卡关诊断', 'Gear troubleshooting', 'ninjaLang', 'ninjaUiLocalized', 'data-i18n-aria="languageSelect"', 'Ninja Config Parser', 'Assigned version']
    },
    {
      id: 'ninja-import-minion-selection-guide',
      path: '/tools/ninja-import.html',
      mustContain: ['analyzeMinionSelectionGuide', 'minionSelectionGuide', 'ninjaMinionSelectionRows', 'ninjaMinionSelectionPresentRows', 'ninjaMinionSelectionNeedsReview', 'ninjaMinionSelectionSkillMatched', 'ninjaMinionSelectionSkillExpected', 'ninjaMinionSelectionFirstMatched', 'ninjaMinionSelectionFirstExpected', 'ninjaMinionSelectionContextRows', 'ninjaMinionSelectionMainDamagePresent', 'ninjaMinionSelectionExtraPresentRows', 'ninjaMinionSelectionSourceStatus', 'manual-guide-minion-selection', '召唤物选择指南', 'Minion selection guide']
    }
  ];
}

function joinUrl(baseUrl, pagePath) {
  return new URL(pagePath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function fetchPage(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { statusCode: response.status, ok: response.ok, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function validatePage(baseUrl, check, timeoutMs) {
  const url = joinUrl(baseUrl, check.path);
  try {
    const response = await fetchPage(url, timeoutMs);
    const failures = [];
    if (!response.ok) failures.push(`HTTP ${response.statusCode}`);
    for (const needle of check.mustContain || []) {
      if (!response.text.includes(needle)) failures.push(`missing text: ${needle}`);
    }
    return {
      id: check.id,
      url,
      status: failures.length ? 'failed' : 'ok',
      statusCode: response.statusCode,
      bytes: Buffer.byteLength(response.text),
      failures
    };
  } catch (error) {
    return {
      id: check.id,
      url,
      status: 'failed',
      failures: [error.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error.message]
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const results = [];
  for (const check of pageChecks()) {
    results.push(await validatePage(args.baseUrl, check, args.timeoutMs));
  }
  const failed = results.filter((result) => result.status !== 'ok');
  console.log(JSON.stringify({
    baseUrl: args.baseUrl,
    pageCount: results.length,
    failed: failed.length,
    results
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
