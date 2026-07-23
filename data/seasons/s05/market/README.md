# S05 Market Data

Reserved for hideout gold arbitrage and skill flipping snapshots.

Each snapshot should include update time, source, item or gem identity, buy
price, sell price, estimated fee, spread, and liquidity notes.

## Current files

- `gem-flips.json`: sample seed data for the skill flipping page. It is marked
  as `sample-manual-seed` and must not be treated as current market advice.
- `hideout-flips.json`: sample seed data for the hideout gold arbitrage page.
  It is marked as `sample-manual-seed` and must not be treated as current
  market advice.
- `examples/real-gem-flips-v1.example.json`: fixture for the stricter
  `real-snapshot-v1` gem snapshot shape. Prices are not live.
- `examples/real-hideout-flips-v1.example.json`: fixture for the stricter
  `real-snapshot-v1` hideout snapshot shape. Prices are not live.
- `examples/raw-gem-flips-v1.example.json`: raw manual-capture template for
  `normalize-market-snapshot.mjs --kind gemFlips`. Prices are not live.
- `examples/raw-hideout-flips-v1.example.json`: raw manual-capture template for
  `normalize-market-snapshot.mjs --kind hideoutFlips`. Prices are not live.
- `candidates/index.json`: registry of normalized candidate snapshots waiting
  for archive review. `normalize-market-snapshot.mjs --write` updates this
  index after a candidate passes validation.

## Snapshot rules

Future real snapshots should be appended or versioned instead of overwriting
historical data. A real snapshot must record source, fetch time, league/version,
listing depth, buy price, sell price, fee estimate, liquidity, risk notes, and
any filters used to remove abnormal prices.

Real snapshots must use `source.type=real-snapshot-v1` and follow
`snapshot-real-v1.md`. The validator keeps sample seed data lightweight, but a
real snapshot must also include `snapshotSchemaVersion=1`,
`source.provider`, `source.league`, `source.fetchedAt`, abnormal price filters,
minimum listing depth, and per-entry `marketEvidence`.

Freshness is derived from `source.fetchedAt`: within 6 hours is `fresh`, older
snapshots are `stale`, and sample seed files are `sample-not-live`. Stale
snapshots remain valid archives, but pages should warn before using them for
trade decisions.

The market pages and validator also summarize evidence strength for every
snapshot: average `marketEvidence.priceConfidence`, minimum buy-side listing
depth, and minimum sell-side listing depth. Sample seed files report these as
zero. Real snapshots should keep both listing depths at or above
`source.filters.minListingDepth`, otherwise `validate-market.mjs` rejects the
candidate.

When a real snapshot is ready, add it as a new file and update
`data/seasons/s05/manifest.json` to point the matching market module at the new
file. Do not overwrite `gem-flips.json` or `hideout-flips.json` unless the
manifest is intentionally kept on sample data.

Files under `examples/` are contract fixtures only. They can be validated, but
`archive-market-snapshot.mjs` rejects them by default so fixture prices cannot
accidentally become the active market file.

Before registering a candidate snapshot in the manifest, validate it directly:

```sh
node scripts/validate-market.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json
node scripts/validate-market.mjs --season s05 --kind hideoutFlips --file market/examples/real-hideout-flips-v1.example.json
```

Raw manual captures can start from the raw templates. The first command is a
dry-run that validates a temporary candidate; the second writes a candidate file
and updates `market/candidates/index.json` only after validation passes:

```sh
node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file data/seasons/s05/market/examples/raw-gem-flips-v1.example.json --key manual-gems-demo --provider manual-capture --league S05
node scripts/normalize-market-snapshot.mjs --season s05 --kind hideoutFlips --file data/seasons/s05/market/examples/raw-hideout-flips-v1.example.json --key manual-hideout-demo --provider manual-capture --league S05
```

When a normalized candidate is written, it should appear in
`market/candidates/index.json` with its kind, file path, source provider,
listing evidence depth, confidence summary, and validation status. The data
update page reads that index so candidates can be reviewed before
`archive-market-snapshot.mjs --write` moves one into `market/snapshots/` and
updates the manifest pointer.

`node scripts/validate-market.mjs --season s05` checks both active manifest
market files and `market/candidates/index.json`. If the index contains rows,
the validator also compares each row against its candidate file so stale entry
counts, evidence depth, confidence, or validation status cannot silently drift.
