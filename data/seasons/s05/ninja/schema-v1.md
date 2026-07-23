# Local Ninja Import Schema V1

This schema describes the JSON exported by `tools/ninja-import.html` after a
poe.ninja, PoB, or player-export input is parsed locally. It is the archive
shape for files stored under `data/seasons/s05/ninja/`.

## Required Fields

- `parserVersion`: must be `local-ninja-import-v1`.
- `schemaVersion`: must be `1`.
- `parsedAt`: ISO timestamp for when the browser parser produced the result.
- `format`: `json`, `base64-json`, `pob-code`, `pob-xml`, `text`, or
  `none`.
- `selectedToolVersion`: version selected in the tool UI while importing.
- `explicitVersion`: version found in the imported data, or `null`.
- `assignedVersion`: explicit version if present, otherwise selected tool
  version.
- `versionSource`: `export` or `selected-tool-version`.
- `versionCompatibility`: object describing whether the imported configuration
  can safely be compared against the currently selected tool version:
  - `status`: `matched`, `needs-review`, or `source-version-unknown`.
  - `selectedToolVersion`: version selected in the parser.
  - `comparedVersion`: version whose manifest/build data was used for BD
    comparison.
  - `selectedSeason`, `selectedPoe2dbVersion`, `selectedDataRoot`: current tool
    version metadata.
  - `explicitVersion` and `explicitVersionPath`: version ID found in the import,
    or `null` when absent.
  - `exportSeason` and `exportSeasonPath`: season/league field found in the
    import, or `null`.
  - `exportPoe2dbVersion` and `exportPoe2dbVersionPath`: passive tree data
    version found in the import, or `null`.
  - `warnings`: machine-readable warning strings such as
    `export-version-mismatch:*`, `season-mismatch:*`,
    `poe2db-version-mismatch:*`, `export-version-not-registered:*`, or
    `export-version-missing`.
- `character`: object with `name`, `class`, `ascendancy`, and `level`.
- `counts`: counts for `skills`, `supports`, `items`, and `passives`.
- `skills`: array of `{ name, context }` entries for active skills.
- `supports`: array of `{ name, context }` entries for support gems.
- `items`: array of `{ name, context }` entries for equipment. Parsed entries
  may also include `mods` and `statRolls`:
  - `mods`: normalized item modifier lines from JSON mod arrays or PoB XML item
    text.
  - `statRolls`: numeric rolls extracted from those modifier lines, each with
    `value`, `unit`, and source `text`.
- `passiveIds`: allocated passive node IDs as numbers.
- `formatProfile`: machine-readable parser profile for future poe.ninja/PoB
  compatibility work:
  - `inputFormat`: `json`, `base64-json`, `pob-code`, `pob-xml`, `text`, or
    `none`.
  - `topLevelKeys`: top-level keys seen in the import, capped by the parser.
  - `explicitVersionPath`, `characterPath`, `skillGroupPath`,
    `skillSourcePath`, `supportSourcePath`, `itemSourcePath`, and
    `passiveSourcePath`: detected source paths, or `null`.
  - `skillGroupCount`: number of PoB-style skill groups detected.
  - `recognizedCounts`: counts for skills, supports, items, and passives before
    archive truncation.
  - `parserHints`: coarse hints from the registered set:
    `pob-skill-groups`, `pob-compressed-code`, `pob-xml`,
    `text-passive-patterns`, and `gear-container`.
  - `risks`: format risks such as `missing-explicit-version`,
    `items-from-recursive-scan`, or `no-passives-detected`.

## Optional BD Analysis

`analysis` is optional but recommended after the parser has a selected build
context. It stores:

- `comparedBuildId`
- `comparedBuildTitle`
- `skills.matched`, `skills.expected`, `skills.missing`
- `supports.matched`, `supports.expected`, `supports.missing`
- `items.matched`, `items.expected`, `items.missing`
- `passives.matched`, `passives.expected`
- Optional `passives.matchedIds` and `passives.missingIds` arrays. The parser
  uses `missingIds` to open a temporary passive tree for nodes present in the
  compared build's endgame tree but absent from the imported character.
- Optional `passiveStages` object, when the selected build has staged passive
  routes in `manifest.tree.routes`. It compares imported passive IDs against
  every route stage, not only the endgame route:
  - `passiveStages.stageCount`, `matched`, `expected`, and `missing`.
  - `passiveStages.bestStageId`, `bestStageTitle`, and `bestStageScore`.
  - `passiveStages.sourceStatus`, currently `manifest-route`.
  - `passiveStages.stages[]`, with `stageId`, `treeStage`, `title`, `origin`,
    `handTuned`, `expected`, `matched`, `missing`, `matchedIds`,
    capped `missingIds`, `score`, and `source`.
- Optional `progression` object, when both passive stage readiness and gear
  stage readiness are available. It is a parser heuristic that compares the
  best passive-stage score with the best gear-stage score:
  - `progression.sourceStatus`, currently `parser-stage-heuristic`.
  - `passiveBestStageId`, `passiveBestStageTitle`,
    `passiveBestStageScore`.
  - `gearBestStageId`, `gearBestStageTitle`, `gearBestStageScore`.
  - `bottleneck`: `passives` or `gear`.
  - `reviewStageId`, `reviewStageTitle`, and human-readable `note`.
- Optional `catalog` object, when the selected version has
  `manifest.skills.catalog`:
  - `catalog.sourceType`
  - `catalog.skills.matched`, `catalog.skills.imported`,
    `catalog.skills.unknown`
  - `catalog.supports.matched`, `catalog.supports.imported`,
    `catalog.supports.unknown`
  - `catalog.pendingVerification`, the number of matched imported skill/support
    catalog entries that are still not marked `verified`.
- Optional `gear` object, when the parser can compare imported equipment text
  against the selected BD gear priorities:
  - `gear.matched`, `gear.expected`
  - `gear.matchedCategories`, gear stat categories expected by the BD and found
    in the imported equipment text.
  - `gear.missingCategories`, expected categories not found in the imported
    equipment text.
  - `gear.detectedCategories`, all categories detected from imported item
    names, slots, explicit mods, implicit mods, crafted mods, requirements, or
    raw text.
  - `gear.riskItems`, imported item names where no useful category could be
    detected.
  - `gear.modCount` and `gear.statRollCount`, totals from imported equipment
    modifier lines and numeric rolls.
  - `gear.slotRollSummaryCount` and `gear.slots[].rollSummaries`, optional
    per-slot numeric summaries derived from imported modifier rolls. These are
    parser evidence for later threshold scoring, not market valuation.
  - `gear.slotThresholdRows`, `gear.slotThresholdPassed`,
    `gear.slotThresholdWeak`, and `gear.slotThresholdMissing`, optional totals
    from parser-default per-slot threshold checks. These are heuristic build
    comparison signals, not verified market valuation or final gear quality.
  - `gear.slots[].thresholdRows`, optional per-slot rows with `category`,
    `status` (`passed`, `weak`, or `missing`), `threshold`, `unit`, `value`,
    `itemName`, `text`, and `source`. Current generated rows use
    `source: parser-default-threshold`.
  - `gear.stageReadiness`, optional comparison against the selected BD's
    `gearStatThresholds`. It contains `stageCount`, `rowCount`, aggregate
    `passed`/`weak`/`missing` counts, `bestStageId`, `bestStageTitle`,
    `bestStageScore`, `sourceStatus`, and `stages[]`. Each stage row stores the
    manual threshold text plus parser evidence (`value`, `itemName`, `text`) and
    `source: manual-guide-threshold` when generated from the guide. This is a
    configuration health check, not live pricing or final gear valuation.
- Optional `supportDecision` object, when the compared BD has
  `skills.supportDecisionMatrix`:
  - `supportDecision.rowCount`
  - `supportDecision.skillMatched`, `supportDecision.skillExpected`
  - `supportDecision.firstSupportMatched`,
    `supportDecision.firstSupportExpected`
  - `supportDecision.globalFirstSupportMatched`, support names that appear in
    the import even when the parser cannot prove they are linked under the
    expected minion skill.
  - `supportDecision.contextualRows`, matrix rows where support gems have a
    skill/link context from the import.
  - `supportDecision.rows[]`, with localized `title`, row-level skill/support
    ratios, `hasContextualSupports`, missing localized skill/support names, and
    localized `reviewNote`.

## Validation

Validate all manifest-registered archives:

```sh
node scripts/validate-ninja.mjs --season s05
node scripts/validate-ninja.mjs --season s05 --examples
```

Validate one exported result before registering it:

```sh
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-raw-pob-xml.example.json --key raw-pob-xml
```

Archive a validated result into `ninja/imports/` and register it in the season
manifest:

```sh
node scripts/archive-ninja-import.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example-tactician
node scripts/archive-ninja-import.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example-tactician --write
```
