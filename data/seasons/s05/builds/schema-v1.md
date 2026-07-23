# Build Guide Data Schema V1

This schema describes build guide JSON files registered from
`data/seasons/s05/manifest.json` under `builds`.

## Required Top-Level Fields

- `id`: build id. It must match the manifest build entry id.
- `season`: season label, for example `S05`.
- `versionId`: tool data version, for example `s05-tree-4.5`.
- `title`: localized `zhCN`, `zhTW`, and `en` title.
- `class.base`: localized base class.
- `class.ascendancy`: localized ascendancy.
- `source`: source notes and optional external build links.
- `overview`: localized homepage comparison fields. It includes difficulty,
  budget, best-fit player notes, strengths, and current risks or gaps.
- `guideArticle`: localized long-form guide entry. This is the default detail
  page reading surface before passive-tree buttons, and it should explain what
  to start, when to transition, how to separate skills from supports, how gear
  progresses, and when crafting is worth doing.
- `evidenceSummary`: localized evidence and review queue for the guide. It must
  explain which parts are backed by local version data or PoE2DB, which parts
  are manual plans, and what the next review action is.
- `guideStrategy`: required guide-writing decision data. It keeps the written
  guide useful even when the passive tree is a separate tool.
- `routes`: guide and passive tree route hints.
- `tags`: non-empty string array for homepage cards.

## Guide Sections

- `guideArticle.title` and `guideArticle.intro`: localized heading and opening
  copy for the primary build-guide article.
- `guideArticle.sections`: ordered localized article cards. Each section has
  `id`, localized `title`, localized `body`, and localized `checks`. These are
  prose guide decisions, not passive-tree data and not live market data.
- `evidenceSummary.title` and `evidenceSummary.intro`: localized heading and
  summary text shown on the guide page.
- `evidenceSummary.checks`: evidence rows. Each row has `id`, localized
  `status`, localized `evidence`, localized `limitation`, localized
  `nextAction`, and `severity` of `ok`, `warning`, or `pending`.
- `guideStrategy.coreLoop`: title plus ordered steps describing how the build
  actually plays once it is online.
- `guideStrategy.powerSignals`: checkpoints that tell the player the build is
  getting stronger. Each item has `id`, `title`, `good`, and `check`.
- `guideStrategy.failureDiagnosis`: symptom-based troubleshooting table. Each
  row has `symptom`, `likelyCause`, `fix`, and `priority`.
- `guideStrategy.decisionRules`: grouped rules for transition timing, purchase
  order, crafting timing, or other build-specific choices. Each group has an
  `id`, `title`, and non-empty `rules` array.
- `stages`: leveling stages. Each stage must have an id, title, summary,
  priorities, playbook, and optional `treeStage` link.
- `stages[*].routeReview`: required when the stage has `treeStage`. It records
  whether the stage route is hand-tuned, projected, or needs manual review.
- `skills.active`: active skill or minion skill definitions. These are not
  support gems.
- `skills.supports`: support gem dictionary keyed by support id.
- `skills.supportProfiles`: reusable support sets for minion groups.
- `skills.recommendedLinks`: concrete skill-to-support link plans.
- `skills.supportSelectionRules`: guide-level rules for socket priority,
  support distribution, and compatibility caveats.
- `skills.minionSelectionGuide`: required guide-level minion choice guide for
  minion or summon builds. It explains which active minion skills fill main
  damage, frontline, and utility jobs, which support gems should be linked
  first, when to choose each group, and what to cut first when spirit or sockets
  are tight.
- `skills.supportDecisionMatrix`: minion role matrix for choosing supports
  without mixing active minion skills and support gems. Each row names the
  target minion skills, first supports, optional later supports, conditions to
  use them, and conditions to cut them.
- `skillAcquisition`: staged skill pickup plan. PoE2DB detail fields may be
  referenced as evidence, but they are not the same thing as an exact character
  leveling route unless the field explicitly says so.
- `skillProgression`: staged skill swaps and support priorities.
- `gearPriorities`: early, middle, and endgame gear stat priorities by slot.
- `earlyGearStatPriority`: front-loaded stat priority groups for the first
  gearing decisions.
- `gearStagePlan`: stage-by-stage gear checklist.
- `gearStatThresholds`: stage-by-stage manual guide thresholds. Each group
  references a known `stageId`, marks a `sourceStatus`, and contains threshold
  rows with stat name, minimum usable line, upgrade target, priority, and
  rationale. These rows are guide decision aids, not live market valuation.
- `craftingPlan`: crafting or purchase plans with stop rules. Each plan should
  keep manual guide crafting separate from live prices by setting
  `sourceStatus`, `purchaseFirst`, `priorityMods`, `materials`,
  `successChecks`, and `fallback`. These fields describe the decision process:
  what to buy first, what mods matter, what low-cost actions are allowed, when
  the item is good enough to use, and when to stop or retreat.
- `transitionChecks`: groups for "can transition", "do not force transition",
  and stuck-state handling.

## Stage Coverage

Each registered stage should be usable as an independent guide checkpoint.
For the first Tactician guide, every stage is expected to have:

- a `treeStage` route registered in the season manifest;
- one `gearStagePlan` entry;
- one `gearStatThresholds` group;
- one `skillProgression` entry.

`skillAcquisition` and `craftingPlan` may be stage-specific rather than present
on every stage, but their `stageId` values must still reference known stages.
The guide page renders this as the stage data coverage table so missing
structured data is visible before a build is treated as complete.

## Passive Tree Link Rules

If a stage declares `treeStage`, the matching route must be registered in the
season manifest. The validator checks node count, origin, override policy, and
`handTuned` against that manifest route so guide buttons cannot silently point
to stale or missing trees.

Projected early and midgame routes must stay marked as not hand-tuned until the
stage route is manually reviewed. Do not describe `projected-from-endgame-order`
as a verified leveling route.

The guide evidence summary must repeat that distinction when projected routes
are used. It should also keep sample market data and manual skill-acquisition
plans separate from verified source data.

## Skill and Support Rules

Active minion skills and support gems must stay separate:

- Active minions belong in `skills.active`.
- Support gems belong in `skills.supports`.
- Concrete links belong in `skills.recommendedLinks`.
- Minion choice logic belongs in `skills.minionSelectionGuide`.
- Role-based support choices belong in `skills.supportDecisionMatrix`.

`skills.minionSelectionGuide` is the player-facing answer to "which minions do I
actually run?" Each group must have:

- `id`: stable group id, such as `main-damage`, `frontline`, or `utility`.
- localized `title` and `job`.
- `skillIds`: active minion skill ids from `skills.active`, not support ids.
- `chooseWhen`: localized list of conditions for using that minion group.
- `firstSupports`: support gem ids from `skills.supports`, not active skills.
- localized `cutFirst`: what to remove first when spirit, sockets, or links are
  limited.

`skills.minionSelectionGuide.rules` should contain short localized rules for
keeping a main damage minion online, adding a frontline minion when survival is
weak, and treating utility minions as optional. Do not place active minion
skills in `firstSupports`, and do not place support gems in `skillIds`.
`scripts/validate-builds.mjs` enforces these references against `skills.active`
and `skills.supports`.

If a support row references PoE2DB data, keep the evidence status explicit. A
partial catalog match is useful for review, but it is not proof that every
listed support is compatible with every listed minion.

## Validation

Validate all manifest-registered builds:

```sh
node scripts/validate-builds.mjs --season s05
```

Skill and support ids used by builds should also exist in the versioned skill
catalog:

```sh
node scripts/validate-skills.mjs --season s05
```

Validate one candidate build before registering or linking it:

```sh
node scripts/validate-builds.mjs --season s05 --id tactician-supporting-fire --file builds/tactician-supporting-fire.json
```
