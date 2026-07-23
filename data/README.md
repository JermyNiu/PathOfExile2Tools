# POE2 Tools Data

The data folder is versioned by season so older builds and market snapshots can
remain readable after a future patch changes the tree or item data.

## Layout

```text
data/
├── versions.json
└── seasons/
    └── s05/
        ├── builds/
        │   └── tactician-supporting-fire.json
        ├── market/
        ├── ninja/
        └── tree/
            └── tactician-supporting-fire-endgame.json
```

## Rules

- Add a new season or version folder instead of overwriting historical data.
- Build guide pages may be handwritten HTML while the data shape is stabilizing,
  but shared facts should be mirrored into the season JSON.
- Active skill gems and support gems must be represented separately.
- Language fields use `zhCN`, `zhTW`, and `en`.
- poe.ninja imports should store an explicit source version if the export code
  contains one. If not, store the tool version selected by the user at import
  time.
- `scripts/update-data.mjs` is dry-run by default. Use `--write` to download
  source files and `--force` only when intentionally replacing an existing
  downloaded source file.
- `scripts/create-version.mjs` is dry-run by default. Use it to clone a draft
  version folder and append a history entry before downloading new source data.
  It does not switch `current`.
- `scripts/diff-tree.mjs` compares two PoE2DB raw passive tree files or two
  registered versions and reports added, removed, changed, and route-impacting
  node IDs.
- `scripts/switch-current.mjs` is dry-run by default. It refuses draft versions
  unless explicitly allowed, checks raw tree files, SVG assets, builds, routes,
  market snapshots, and ninja archives, then updates `current` only with
  `--write`.
- `scripts/generate-version-log.mjs` writes Markdown update logs under the
  target version's `changelog/` folder. It includes version metadata, passive
  tree diff summary, route impact, and current-switch readiness.
- Hand-tuned route JSON and market snapshots should not be overwritten by raw
  source-data updates.
- Run `node scripts/validate-all.mjs --season s05` after changing season data,
  manifest entries, routes, or market snapshots.
- `data/versions.json` must keep `current` aligned with a `history` entry, and
  each history entry must point to a readable season manifest whose tree and
  build metadata match the version record. Validate it with
  `node scripts/validate-versions.mjs`. Validate one candidate history entry
  with `node scripts/validate-versions.mjs --id <version-id>`.
- Build JSON files registered in a season manifest must keep stage, playbook,
  skill, support, support profile, recommended link, and skill progression
  references valid. Validate them with
  `node scripts/validate-builds.mjs --season s05`. Candidate build files can be
  checked before manifest registration with
  `node scripts/validate-builds.mjs --season s05 --id <build-id> --file <file>`.
- Route JSON files registered in a season manifest must declare `origin`,
  `overridePolicy`, and `handTuned`. Validate them with
  `node scripts/validate-routes.mjs --season s05`. Candidate stage routes can
  be checked before replacement with
  `node scripts/validate-routes.mjs --season s05 --build <build-id> --stage <stage-id> --file <file>`.
- Skill catalog JSON registered in a season manifest must include every active
  skill and support id referenced by registered builds. Validate it with
  `node scripts/validate-skills.mjs --season s05`. While the source remains
  `manual-seed-needs-poe2db`, entries must stay marked
  `needs-poe2db-verification` and must not be described as official unlock or
  compatibility data. Generate a PoE2DB/编年史 candidate catalog with
  `node scripts/fetch-poe2db-skills.mjs --season s05 --out <file> --write`,
  then optionally enrich it with compact per-gem page details using
  `node scripts/fetch-poe2db-skill-details.mjs --season s05 --out <file> --write`.
  Detail fields such as `poe2db.detail.from` are source evidence, not market
  prices and not character-level recommendations. Archive the final candidate
  with
  `node scripts/archive-skill-catalog.mjs --season s05 --file <file> --key <snapshot-key> --write`
  only after dry-run confirms it is `poe2db-snapshot-v1` and covers every
  skill/support id referenced by registered builds.
- Market snapshot JSON files registered in a season manifest must keep required
  price, liquidity, risk, source, and localization fields. Validate them with
  `node scripts/validate-market.mjs --season s05`.
  Sample market seeds use `source.type=sample-manual-seed`. Real market
  snapshots must use `source.type=real-snapshot-v1`, add
  `snapshotSchemaVersion=1`, source fetch metadata, abnormal-price filters,
  minimum listing depth, and per-entry `marketEvidence`. Candidate files can be
  normalized and checked before manifest registration with
  `node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file <file> --key <snapshot-key> --provider <provider> --league S05 --write`, then
  `node scripts/validate-market.mjs --season s05 --kind gemFlips --file <file>`.
  Archive a validated real snapshot and point the matching manifest market entry
  to it with
  `node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file <file> --key <snapshot-key> --write`.
- Ninja/player import JSON files registered in a season manifest must keep the
  parser version, schema version, assigned version, version source, character,
  counts, skills, supports, items, and passive IDs consistent. Validate them
  with `node scripts/validate-ninja.mjs --season s05`. Candidate exported
  results can be checked before manifest registration with
  `node scripts/validate-ninja.mjs --season s05 --file <file> --key <name>`.
  Archive a validated result with
  `node scripts/archive-ninja-import.mjs --season s05 --file <file> --key <name> --write`.

## Planned Data Areas

- `builds`: league starter and endgame build metadata, stages, skill links,
  gear priorities, crafting notes, and passive tree stage IDs.
- `tree`: local passive tree SVG, selected node lists, node stats, and
  localized node labels for the matching tree version.
  Raw downloaded source files live under `tree/raw/<poe2db-version>/`.
- `ninja`: parsed player exports with talents, gear, skills, jewels, flasks,
  and import metadata.
- `market`: hideout gold arbitrage snapshots, skill flipping snapshots, prices,
  update time, and liquidity notes.
