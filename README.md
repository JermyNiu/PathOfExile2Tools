# POE2 Tools

This folder is the starting point for a local Path of Exile 2 tool suite.

## Current Entry

- `index.html`: local POE2 tools home page.
- `builds/index.html`: version-aware league starter build list page with guide completeness filters and direct links to each build's Markdown guide report.
- `builds/tactician-supporting-fire.html`: S05 Tactician Supporting Fire guide page with staged data hydration and a copy/download Markdown guide report.
- `tools/passive-tree.html`: shared passive tree viewer; build pages link to it with build/stage query parameters.
- `tools/data-update.html`: local data update status and command page; follows the shared selected version, falls back to `versions.current`, and summarizes current guide-writing, skill, market, ninja, route, gear, and crafting data quality.
- `tools/route-review.html`: version-aware passive route review cockpit with page-level language switching for checking manifest routes, build-stage review notes, route JSON meta consistency, hand-tuned archive commands, and Markdown review reports.
- `tools/market-review.html`: version-aware market snapshot review cockpit for active market snapshot quality, candidate queue status, archive commands, and Markdown review reports.
- `tools/ninja-import.html`: local poe.ninja/player export parser prototype with build comparison output.
- `tools/skill-catalog.html`: versioned active skill and support gem catalog with PoE2DB evidence, data-quality filters, From/requirement coverage, and page-level language switching.
- `tools/gem-flip.html`: sample-backed level 21 skill flipping ranking page.
- `tools/hideout-flip.html`: sample-backed hideout gold arbitrage ranking page.
- `tools/version-history.html`: version history, manifest completeness including BD candidate backlog, route quality, and safe next-version command cockpit.
- `assets/version-context.js`: shared browser helper for reading `data/versions.json`, formatting version labels, and saving the selected version.
- `scripts/update-data.mjs`: safe local data update script; dry-run by default.
- `scripts/scaffold-build.mjs`: creates a dry-run or written candidate build JSON from the BD guide template.
- `scripts/register-build.mjs`: validates a candidate build JSON and dry-runs or writes its manifest entry.
- `scripts/validate-build-candidates.mjs`: validates the versioned future-BD candidate backlog before scaffolding or registering a new build.
- `scripts/validate-build-candidate-routes.mjs`: batch-validates route candidate files explicitly listed in the future-BD candidate backlog without registering them.
- `scripts/validate-build-candidate-readiness.mjs`: audits candidate material, guide page, staged route coverage, and publication blockers without writing manifest entries.
- `data/seasons/s05/builds/candidates.json`: versioned backlog for future BD guide candidates used by the data update page to generate scaffold and registration commands.
- `scripts/serve.mjs`: local static web server for opening the tool suite without relying on `file://`.
- `scripts/validate-all.mjs`: runs the common local data validation gate.
- `scripts/validate-build-guides.mjs`: reports and gates guide-writing completeness plus guide report page readiness for registered build JSON files.
- `scripts/validate-pages.mjs`: checks that core HTML pages are reachable through the local HTTP server.
- `scripts/validate-runtime-pages.mjs`: opens core pages in Chrome/Chromium and checks browser-side hydrated dataset fields.
- `scripts/validate-suite.mjs`: runs data, static page, and runtime page checks as one final local gate.
- `scripts/validate-versions.mjs`: validates `data/versions.json` and linked season manifests.
- `scripts/validate-builds.mjs`: validates build data files registered in a season manifest.
- `scripts/validate-market.mjs`: validates market snapshot files registered in a season manifest.
- `scripts/normalize-market-snapshot.mjs`: normalizes raw market entries into a validated `real-snapshot-v1` candidate.
- `scripts/validate-ninja.mjs`: validates parsed ninja/player import JSON registered in a season manifest.
- `data/versions.json`: current source and version metadata.
- `data/README.md`: data layout and versioning rules.
- `data/templates/build-guide-template.json`: starter template for a new league starter BD data file.
- `data/seasons/s05/builds/tactician-supporting-fire.json`: versioned data for the first build guide.
- `data/seasons/s05/tree/tactician-supporting-fire-endgame.json`: versioned route data for the 122-point passive tree.
- `assets/poe2-tree-4.4.svg`: original PoB passive tree SVG preview used as the tree base.
- `assets/poe2-tree-4.4-highlight.svg`: baked-highlight fallback SVG from an earlier iteration.

## Current Page

The current home page is the shell for the local POE2 tool suite. It links to
the first implemented build page and records the planned modules:

- league starter builds with staged passive trees, gear choices, and crafting
- hideout gold arbitrage display and ranking
- level 21 skill flipping ranking
- poe.ninja/player export analysis

The home page keeps version selection and data update access in the top-right
controls. Language selection belongs to detail pages such as passive tree pages
or parsed build result pages.

Market module previews on the home page include the same default budget-plan
summary as the detail tools: skill flipping uses 100 exalted, and hideout gold
flipping uses 100,000 gold plus 50 exalted. These previews preserve the
`sample-plan-only` boundary while the active market data is still sample-backed.

The home page loads version choices from `data/versions.json` and stores the
selected version in `localStorage` under `poe2-tools:selected-version`. Detail
tools that need a version context, such as the ninja import and market ranking
pages, read the same saved version and fall back to `versions.current`.
The data update page reads the same selected version, then exposes
`dataUpdateVersion`, `dataUpdateVersionSource`, and `dataUpdateDataRoot` for
runtime checks. This keeps update status, route protection, skill snapshots,
market snapshots, and ninja archive pointers aligned with the version currently
being inspected.

Leveling build cards are rendered from each registered build JSON. The home page
has a compact module preview, while `builds/index.html` is the version-aware
league starter list. Cards use `overview` for difficulty, budget, best-fit
player notes, strengths, current risks, and staged tree coverage. New builds
must also fill `evidenceSummary` and `guideStrategy`. `evidenceSummary` records
which parts are backed by local version data or PoE2DB, which parts are manual
plans or projected routes, and what needs review next. `guideStrategy` records
the written guide's core loop, power checkpoints, failure diagnosis, and
decision rules. This keeps the guide body primary and the passive tree as a
linked tool.

Guide-writing quality is checked on every build surface, not only on the final
guide page. A build counts as complete when it has `guideArticle`, guide
strategy, execution stages, stage playbooks, `skills.overview`, and
`skills.minionSelectionGuide`, and `gearOverview`. The same
`manual-guide-article`, `manual-guide-skill-flow`,
`manual-guide-minion-selection`, `manual-guide-gear-flow`, and
`manual-guide-strategy` source-status convention is reflected on the home page,
`builds/index.html`, `tools/data-update.html`, and
`tools/version-history.html`. When adding a new league starter, those four
surfaces should agree on complete/missing counts, guide article source status,
guide report readiness, skill overview cards/checks, minion selection groups,
skill refs, support refs, rules, gear overview cards/checks, stage playbooks,
and execution stages. For minion builds, `skills.minionSelectionGuide` is the
player-facing choice guide: `skillIds` must refer to active minion skills and
`firstSupports` must refer to support gems, so the guide never mixes the two
types in one list.

`builds/index.html` also surfaces whether a registered build can export a
structured guide report. Cards show the report-ready badge and include an
`攻略报告` / guide report link that jumps straight to the build page's
`#guide-markdown-report` panel, so the build list remains the navigation layer
and the full guide page remains the source of the written report. The home page,
data update page, and version history page expose the same report-ready count so
multi-version quality checks can catch a build that has guide text but no report
entry point. The build list's guide filter includes `报告可导出` and `报告待补`
states so report wiring gaps can be found without opening each build card.

The Tactician guide page also renders a structured Markdown report from the
hydrated build JSON. The report follows the current page language, covers guide
article sections, stage routes, execution plan, skills, gear priorities,
crafting, and evidence boundaries, then exposes copy/download actions. Runtime
checks click the copy button and verify the report datasets so the guide can be
reused in task notes, version logs, or later guide editing without scraping the
visible DOM.

The ninja import page reads the selected version manifest, populates its compared
build selector from the registered build list, and compares parsed imports
against the chosen build's skills, support gems, gear keywords, and endgame
passive route. It accepts JSON, base64 JSON, zlib-deflated `pob://`/PoB code
payloads that decode to JSON, and conservative text probing. Exported parser JSON
includes the optional `analysis` block when a comparison is available.

Season data now lives under `data/seasons/<season-id>`. New patches should add a
new version record and data folder instead of overwriting historical build,
tree, ninja, or market data.

The version history page now renders the same multi-version workflow as safe
local commands: create the next draft version, update source data, diff passive
tree files, generate a version log, run validation, and switch `current` only
after the draft is ready. It exposes `versionHistoryCommandCurrent`,
`versionHistoryCommandTarget`, `versionHistoryCommandSeason`, and
`versionHistoryCommandCount` so runtime checks can confirm the command cockpit
matches the selected current version.

The version matrix also checks the versioned BD candidate backlog from
`manifest.buildCandidates`, reports how many planned candidates are still
available to scaffold, and keeps that count separate from published
`manifest.builds`.

The home page also summarizes the same BD candidate publication readiness at a
glance. Its leveling module candidate row now distinguishes staged candidate
route files, hand-tuned candidate status, formal manifest route registration,
material readiness, review readiness, and final publish readiness. A draft like
`infernalist-minions` can therefore show as material-ready and review-ready
while still remaining publish-blocked because it is not registered in
`manifest.builds` or `manifest.tree.routes`.

The shared passive tree viewer keeps the passive tree SVG inlined, but loads
selected routes from `data/seasons/<season>/tree/*.json`. Open it through the
local HTTP server so `fetch` can read those JSON files. It calls the SVG's own
`tree_load` and `tree_highlight` functions to highlight the selected build. The
viewer also reads the current version manifest to populate a stage selector for
the active build, so a guide can pass an initial `build` and `stage` while the
user can switch stages without leaving the tree page.

The route review page sits between the guide and data update flow. It lists the
selected version's manifest routes, their build-stage review notes, route JSON
node counts, and route `meta` consistency, then ranks pending routes in a
hand-tuning priority queue before generating `archive-route.mjs` dry-run and
`--write` commands only for replaceable projected routes. Its page chrome,
filters, table labels, empty states, command copy status, priority queue, and
origin labels switch between Simplified Chinese, Traditional Chinese, and
English. It also renders a full-version Markdown review report with copy and
download actions; table filters do not trim that report, so it can be pasted
into tasks, PRs, or version notes as a complete hand-tuning backlog snapshot.
This keeps projected leveling snapshots visible while making the hand-tuning
backlog explicit and ordered.

The market review page plays the same role for market data. It reads the active
`manifest.market` files and `market/candidates/index.json`, shows evidence
coverage, average confidence, listing depth, freshness, candidate readiness, and
then generates validation, normalization, and archive commands. Empty candidate
queues are valid and displayed explicitly. The page-level UI and Markdown report
support Simplified Chinese, Traditional Chinese, and English. The report keeps
`sample-manual-seed` and `examples/*.example.json` marked as non-live data, so
future real snapshots can be reviewed without turning fixtures into trade
advice.

The same viewer also accepts a temporary node list through the `nodes` query
parameter, for example
`tools/passive-tree.html?nodes=6077,27296&title=test`. This mode builds the node
table from the active version's local PoE2DB raw data and is intended for future
ninja import or ad hoc route previews.

The viewer exposes route export actions for both manifest routes and temporary
node lists: copy the raw node id list, copy a shareable URL, or download a small
JSON payload containing build/stage, origin, hand-tuned flag, node count, node
ids, source label, and share URL.

The right-side node details support English, Simplified Chinese, and Traditional
Chinese. Localized node names and stats are sourced from PoE2DB passive tree data
for version `4.5`.

The skill catalog page also supports English, Simplified Chinese, and
Traditional Chinese at page level. Its title, navigation, filters, summary
cards, table headers, usage boundaries, empty state, and pending detail copy all
switch with the selected language. Besides kind, verification, and search
filters, it has a data-quality filter for entries with detail pages, From
source evidence, requirement data, or missing details. The summary cards expose
detail page coverage, From/source coverage, and requirement coverage so data
gaps are visible without opening the update page. Runtime checks assert that
switching to English shows `Active Skill and Support Gem Catalog` and `Usage
Boundaries`, and that the quality filter can isolate From-covered entries and
missing-detail entries.

The gem flipping and hideout gold flipping pages also use page-level language
switching. Their titles, navigation, filters, snapshot metadata, quality cards,
summary cards, table headers, empty states, evidence labels, and scoring rules
switch between Simplified Chinese, Traditional Chinese, and English. Runtime
checks assert the English states with `Skill Flipping`, `Break-even Sell`,
`Hideout Gold Flipping`, and `Profit per 10k Gold`.

The skill flipping page also includes a default 100 exalted budget plan. It
uses the currently top-ranked visible gem, estimates how many copies the budget
can buy, expected spend, remaining capital, and batch net profit. Sample market
data still reports `sample-plan-only`; it proves the planning algorithm, not a
live trade recommendation. The capital field is editable on the page, so the
same ranking can be simulated with a smaller or larger bankroll without changing
the market snapshot file. Non-default capital is also mirrored into the URL as
`capital`, allowing a specific budget simulation to be shared or refreshed.
The page also exposes a copy button for the current budget URL.

The hideout gold flipping page mirrors this with a default 100,000 gold plus
50 exalted budget plan. It estimates exchange count, gold spend, currency spend,
remaining budget, and batch net profit for the current top-ranked visible item.
Sample seed rows still show `sample-plan-only`; real snapshots must add market
evidence, purchase limits, and supply depth before the result can guide trades.
Both the gold and currency budgets are editable, and the page recomputes the
exchange count against both limits. Non-default budgets are mirrored into the
URL as `gold` and `cash`, so a gold-flipping plan can be reopened with the same
simulation inputs. The page also exposes a copy button for that budget URL.

The ninja import page keeps language switching on the parser page itself. It
updates the page title, language selector accessibility label, import placeholder,
controls, result labels, parsed build comparison labels, and passive-tree action
text. Runtime checks parse the built-in sample, switch to English, and assert
`Ninja Config Parser`, `Assigned version`, `Build Comparison`, and
`Open Missing Passive Nodes`.

## Local Server

From this folder:

```sh
node scripts/serve.mjs
```

Then open:

```text
http://127.0.0.1:8766/
```

If port `8766` is already busy, `serve.mjs` automatically falls back to a random
free port and prints the actual `baseUrl`. Use `--strict-port` when a fixed port
is required:

```sh
node scripts/serve.mjs --port 8766 --strict-port
```

## Data Updates

Open the update page from the top-right control on the home page, or directly:

```text
http://127.0.0.1:8766/tools/data-update.html
```

Dry-run the local update script before writing files:

```sh
node scripts/update-data.mjs --season S05 --poe2db-version 4.5 --pobb-svg-version 4.4
```

Create a draft folder for a future tree/data version without changing
`current`:

```sh
node scripts/create-version.mjs --id s05-tree-4.6 --season S05 --poe2db-version 4.6 --pobb-svg-version 4.6 --data-root data/seasons/s05-tree-4.6
node scripts/create-version.mjs --id s05-tree-4.6 --season S05 --poe2db-version 4.6 --pobb-svg-version 4.6 --data-root data/seasons/s05-tree-4.6 --write
```

Write downloaded source files only after checking the dry-run output:

```sh
node scripts/update-data.mjs --season S05 --poe2db-version 4.5 --pobb-svg-version 4.4 --write
node scripts/update-data.mjs --data-root data/seasons/s05-tree-4.6 --season S05 --poe2db-version 4.6 --pobb-svg-version 4.6 --write
```

Existing source files are not overwritten unless `--force` is passed.

Compare passive tree raw data before deciding which routes need review:

```sh
node scripts/diff-tree.mjs --from-file data/seasons/s05/tree/raw/4.5/data_cn.json --to-file data/seasons/s05/tree/raw/4.5/data_cn.json --season s05
node scripts/diff-tree.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6 --lang zhCN --season s05
```

Check and switch the default version only after the draft version has its source
data and validation results:

```sh
node scripts/generate-version-log.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6 --season s05
node scripts/generate-version-log.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6 --season s05 --write
node scripts/switch-current.mjs --id s05-tree-4.6
node scripts/switch-current.mjs --id s05-tree-4.6 --write
```

Run the common local validation gate after data, route, script, or manifest
changes. This also smoke-tests `scaffold-build.mjs`, `scaffold-route.mjs`,
`validate-route-candidate.mjs`, `validate-build-candidate-routes.mjs`,
`validate-build-candidate-readiness.mjs`, and
`register-build.mjs`, and smoke-tests `normalize-market-snapshot.mjs` without
writing candidate files or mutating `market/candidates/index.json`:

```sh
node scripts/validate-all.mjs --season s05
```

Run the page smoke test while the local HTTP server is running:

```sh
node scripts/validate-pages.mjs --base-url http://127.0.0.1:8766
```

Run the browser-side hydration smoke test while the same local server is running:

```sh
node scripts/validate-runtime-pages.mjs --base-url http://127.0.0.1:8766
```

Run the full local gate before handing off a broader change:

```sh
node scripts/validate-suite.mjs --season s05 --serve
```

Use `--base-url http://127.0.0.1:8766` instead when you want to validate against
an already running local server.

Validate version history after adding or changing a season/version record:

```sh
node scripts/validate-versions.mjs
node scripts/validate-versions.mjs --id s05-tree-4.5
```

The version history page includes a data completeness matrix. It fetch-checks
each version's manifest, raw passive-tree data, SVG assets, skill catalog,
market snapshots, ninja sample, build files, and route files before a version is
considered ready for historical lookup. It also reads each version's skill
catalog and records source type, active/support counts, detail coverage, verified
coverage, and the boundary that skill data is not live pricing. The same matrix
also reads each registered build JSON and reports guide-writing completeness,
skill overview cards/checks, gear overview cards/checks, stage playbooks, and
execution stages, so historical versions can reveal whether a BD is a full guide
or only a registered data shell.

Validate registered build data after changing guide metadata, stages, or skill
links:

```sh
node scripts/validate-build-candidates.mjs --season s05
node scripts/validate-build-candidate-routes.mjs --season s05
node scripts/validate-build-candidate-routes.mjs --season s05 --build infernalist-minions
node scripts/validate-build-candidate-readiness.mjs --season s05
node scripts/validate-build-candidate-readiness.mjs --season s05 --build infernalist-minions
node scripts/scaffold-build.mjs --season s05 --id infernalist-minions --from-candidate
node scripts/scaffold-build.mjs --season s05 --id infernalist-minions --from-candidate --write
node scripts/register-build.mjs --season s05 --id infernalist-minions --data builds/infernalist-minions.json --guide ../../../builds/infernalist-minions.html
node scripts/register-build.mjs --season s05 --id infernalist-minions --data builds/infernalist-minions.json --guide ../../../builds/infernalist-minions.html --write
node scripts/validate-builds.mjs --season s05
node scripts/validate-build-guides.mjs --season s05
node scripts/validate-builds.mjs --season s05 --id tactician-supporting-fire --file builds/tactician-supporting-fire.json
node scripts/validate-build-guides.mjs --season s05 --id tactician-supporting-fire
```

Use `data/seasons/<season>/builds/candidates.json` to keep planned league
starter BD work versioned. Use `data/templates/build-guide-template.json` when
drafting one of those candidates. Run `scripts/validate-build-candidates.mjs`
first to check the candidate backlog shape and whether planned entries are
already registered. Run `scripts/validate-build-candidate-routes.mjs` after a
candidate entry lists `routeCandidates`; it only validates existing `.candidate.json`
files recorded in the backlog and does not create missing stage files or publish
the build. Run `scripts/validate-build-candidate-readiness.mjs` before any
registration dry-run; it reports `materialReady`, `reviewReady`,
`publishReady`, and `publishBlockedBy` so candidate-route preview files are not
confused with formal `manifest.builds` or `manifest.tree.routes` publication.
`scripts/scaffold-build.mjs` safely copies the template into
the target season's `builds/` folder and fills the id, season, version, title,
base class, and ascendancy fields. Use `--from-candidate` to read title and
class metadata directly from the candidate backlog. It is dry-run by default and does not edit
`manifest.json` or create an HTML page. Candidate entries marked `draft` must
have their JSON file on disk, but they are still not published until registered.
The current `infernalist-minions` draft has 4/4 staged passive candidate files
listed in `builds/candidates.json`: campaign early, minion transition, early
maps, and red-map prep. They are all `hand-tuned-candidate` files for preview
and route review only. They are not registered in `manifest.tree.routes`, and
the build is not registered in `manifest.builds`.
The data update and version history pages scan draft JSON files for template
placeholders and expose the remaining placeholder count, so a draft can be
tracked without being confused with a finished guide.
After replacing every placeholder, use
`scripts/register-build.mjs` to validate the candidate and preview the manifest
entry; only pass `--write` after the dry-run output is correct. The guide
checker is an authoring and publishing gate: it reports `complete` for guide
writing, `guideReportReady` for the HTML report entry, and `publishReady` only
when both are true. It fails registered builds that have passive trees or tables
but are missing the primary article, strategy, execution plan, stage playbooks,
skill overview, gear overview, or guide report page entry.

Build skill acquisition sections should distinguish manual leveling strategy
from source evidence. Each stage records what to take, what not to force,
pre-switch confirmations, how PoE2DB evidence should be used, and fallback
actions when the transition feels bad.

After adding or changing a league starter build, check these guide-writing UI
surfaces as well:

- `index.html`: the opening module card should show guide text completeness,
  skill overview, gear overview, and stage/execution coverage.
- `builds/index.html`: the build list card and filter summary should show the
  same guide text completeness counts for the currently visible builds, plus
  report-ready availability and a link to `#guide-markdown-report` when the
  guide report is implemented. The guide filter should also support report-ready
  and report-missing states.
- `tools/data-update.html`: the BD data section should show guide-writing stats
  and guide report readiness alongside route, gear threshold, and crafting
  quality.
- `tools/version-history.html`: the version matrix should include guide-writing
  quality and report-ready counts for each version, not only whether the build
  JSON file can be read.

Validate registered passive-tree route files after route or manifest changes:

```sh
node scripts/validate-routes.mjs --season s05
node scripts/validate-routes.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file tree/tactician-supporting-fire-campaign-early.json
node scripts/validate-build-candidate-routes.mjs --season s05
node scripts/validate-build-candidate-routes.mjs --season s05 --build infernalist-minions
node scripts/scaffold-route.mjs --season s05 --build infernalist-minions --stage campaign-early --nodes 6077,27296 --out /tmp/infernalist-campaign-early-route.json
node scripts/scaffold-route.mjs --season s05 --build infernalist-minions --stage campaign-early --nodes 6077,27296 --out /tmp/infernalist-campaign-early-route.json --write
node scripts/validate-route-candidate.mjs --season s05 --build infernalist-minions --stage campaign-early --file /tmp/infernalist-campaign-early-route.json
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json --write
```

`scaffold-route.mjs` is for unpublished or unregistered route candidates. It
uses explicit node IDs and the current season's PoE2DB raw tree data to generate
a three-language hand-tuned candidate JSON. It is dry-run by default and does
not edit `manifest.json`, build JSON, or publish a build; replace sample node
IDs with a reviewed stage route before writing a candidate file.
Run `validate-route-candidate.mjs` on the written candidate before archiving or
registering it; this checks the candidate metadata, stage ownership, locale
ordering, and whether every node id exists in the current season's raw tree data.

`archive-route.mjs` is dry-run by default. It expects a reviewed hand-tuned
route candidate with `meta.origin=hand-tuned-manual`,
`meta.overridePolicy=manual-review-required`, and `meta.handTuned=true`; with
`--write`, it replaces the registered route file and syncs manifest plus build
stage route-review metadata.

Validate the versioned skill/support catalog and build guide references before
turning skill unlock or support compatibility notes into confirmed guide data:

```sh
node scripts/validate-skills.mjs --season s05
node scripts/fetch-poe2db-skills.mjs --season s05
node scripts/fetch-poe2db-skills.mjs --season s05 --out /tmp/poe2db-skill-catalog.json --write --force
node scripts/validate-skills.mjs --season s05 --file /tmp/poe2db-skill-catalog.json
node scripts/fetch-poe2db-skill-details.mjs --season s05
node scripts/fetch-poe2db-skill-details.mjs --season s05 --out /tmp/poe2db-skill-catalog-details.json --write --force
node scripts/validate-skills.mjs --season s05 --file /tmp/poe2db-skill-catalog-details.json
node scripts/archive-skill-catalog.mjs --season s05 --file /tmp/poe2db-skill-catalog.json --key 2026-07-22-poe2db
node scripts/archive-skill-catalog.mjs --season s05 --file /tmp/poe2db-skill-catalog.json --key 2026-07-22-poe2db --write
```

After updating the skill catalog, check these UI surfaces as well:

- `tools/skill-catalog.html`: quality filters and coverage cards should show
  detail, From/source, and requirement coverage for the selected version.
- `tools/data-update.html`: the skill data section should show current catalog
  source, active/support counts, verified/pending counts, From/source coverage,
  requirement coverage, and the `skill-data-not-live-price` boundary.
- `tools/version-history.html`: the version matrix should include skill catalog
  quality in its completeness checks, not only the catalog file pointer.

Validate registered market snapshot files after changing market data or manifest
market entries:

```sh
node scripts/validate-market.mjs --season s05
```

Market pages may show sample seed data while ranking logic is being developed.
Files marked `source.type=sample-manual-seed` are not market advice. A real
market file must use `source.type=real-snapshot-v1` and pass the stricter
snapshot evidence checks documented in
`data/seasons/s05/market/snapshot-real-v1.md`.

The gem and hideout flip pages already expose reusable quality filters for
positive profit, minimum liquidity, maximum risk, and required market evidence.
These filters currently operate on sample seeds for UI validation, and the same
controls will apply to real snapshots after manifest market entries point to
`real-snapshot-v1` files.

Validate one candidate market snapshot before wiring it into the season
manifest:

```sh
node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json --key 2026-07-22-gems --provider manual-fixture --league S05
node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json --key 2026-07-22-gems --provider manual-fixture --league S05 --write
node scripts/validate-market.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json
node scripts/validate-market.mjs --season s05 --kind hideoutFlips --file market/examples/real-hideout-flips-v1.example.json
node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file market/candidates/gemFlips-2026-07-22-gems.json --key 2026-07-22-gems
node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file market/candidates/gemFlips-2026-07-22-gems.json --key 2026-07-22-gems --write
```

`market/examples/*.example.json` 只用于契约校验和本地演示，不可直接归档
为当前市场行情；归档脚本默认会拒绝 fixture/example 文件。

Validate parsed ninja/player import samples after changing parser output shape:

```sh
node scripts/validate-ninja.mjs --season s05
node scripts/validate-ninja.mjs --season s05 --examples
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-raw-pob-xml.example.json --key raw-pob-xml
node scripts/archive-ninja-import.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example-tactician
node scripts/archive-ninja-import.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example-tactician --write
```

Build source:

- PoB build: `https://pobb.in/WeXbUcAmS0bL`
- Passive tree data: `https://poe2db.tw/us/passive-skill-tree/`
- Passive tree JSON:
  - `https://poe2db.tw/data/passive-skill-tree/4.5/data_us.json?5`
  - `https://poe2db.tw/data/passive-skill-tree/4.5/data_cn.json?5`
  - `https://poe2db.tw/data/passive-skill-tree/4.5/data_tw.json?5`
- Tree SVG source: `https://pobb.in/assets/4.4.svg`

## Verified

- Local HTTP server open works.
- Route data is loaded from `data/seasons/s05/tree/tactician-supporting-fire-endgame.json`.
- `tree_load` and `tree_highlight` are available.
- 122 selected nodes are highlighted.
- Sample nodes `n6077` and `n27296` render as highlighted.
- Selected links render blue.
- Language switching updates title, search placeholder, right-side detail, table
  headers, node names, node types, and node stats.
