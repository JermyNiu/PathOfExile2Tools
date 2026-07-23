# Real Market Snapshot V1

`real-snapshot-v1` is the contract for market data that may be shown as a real
market snapshot instead of sample seed data. Files using this source type can be
registered from `data/seasons/s05/manifest.json` under `market.gemFlips` or
`market.hideoutFlips`.

## Top-Level Fields

- `snapshotSchemaVersion`: must be `1`.
- `id`: unique snapshot id, preferably including season, market kind, and date.
- `season`: game season label, for example `S05`.
- `versionId`: tool data version, for example `s05-tree-4.5`.
- `updatedAt`: ISO timestamp for when the normalized snapshot was produced.
- `currency`: currently must be `exalted`.
- `feeRate`: estimated resale fee used by the ranking page.
- `source.type`: must be `real-snapshot-v1`.
- `source.provider`: data provider or script name, for example `trade-api`.
- `source.league`: market league queried by the fetcher.
- `source.fetchedAt`: ISO timestamp for the external data fetch.
- `source.note`: short human-readable source note.
- `source.filters.abnormalPriceRules`: non-empty list of abnormal price filters.
- `source.filters.minListingDepth`: minimum listing depth required before an
  item is trusted as tradable.
- `scoreWeights`: ranking weights used by the page.
- `entries`: ranked candidates.

## Freshness

Pages and `scripts/validate-market.mjs` classify real snapshots by
`source.fetchedAt`:

- `fresh`: fetched within the last 6 hours.
- `stale`: fetched more than 6 hours ago.
- `unknown`: fetch time cannot be parsed.

Freshness is reported in validation output and page runtime datasets, but stale
historical snapshots are not rejected by validation. Sample seed files are
reported as `sample-not-live` and must not be treated as market advice.

## Entry Evidence

Every entry in a real snapshot must include `marketEvidence`:

- `observedAt`: ISO timestamp for this entry's source observation.
- `buyListingCount`: listing depth used for the buy side.
- `sellListingCount`: listing depth used for the sell side.
- `priceConfidence`: `0` to `100`; higher means the price is less likely to be
  a stale or manipulated listing.
- `depthNote`: short note explaining depth or filtering.

Gem flipping entries still use `category=active|support`, `buyPrice`,
`sellPrice`, `targetLevel`, `quality`, `liquidity`, `risk`, localized `name`,
and localized `notes`.

Hideout gold entries still use `category=currency|crafting|base|map`,
`goldCost`, `cashCost`, `sellPrice`, `liquidity`, `risk`, localized `name`, and
localized `notes`.

Sample files may keep `source.type=sample-manual-seed` and do not need
`marketEvidence`; pages must continue to label them as sample data.

## Validation

Validate a candidate file before registering it in `manifest.json`:

```sh
node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json --key 2026-07-22-gems --provider manual-fixture --league S05
node scripts/normalize-market-snapshot.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json --key 2026-07-22-gems --provider manual-fixture --league S05 --write
node scripts/validate-market.mjs --season s05 --kind gemFlips --file market/examples/real-gem-flips-v1.example.json
node scripts/validate-market.mjs --season s05 --kind hideoutFlips --file market/examples/real-hideout-flips-v1.example.json
```

The `examples/*.example.json` files are fixtures only. They can prove the shape
of a `real-snapshot-v1` file, but they are not live prices and must not be
registered as the active market snapshot.

Archive a validated real snapshot and update `manifest.market.<kind>` after
reviewing the dry-run:

```sh
node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file market/candidates/gemFlips-2026-07-22-gems.json --key 2026-07-22-gems
node scripts/archive-market-snapshot.mjs --season s05 --kind gemFlips --file market/candidates/gemFlips-2026-07-22-gems.json --key 2026-07-22-gems --write
```

`normalize-market-snapshot.mjs --write` also updates
`market/candidates/index.json`. The index is a review queue for candidate
snapshots and records `kind`, `key`, file path, source provider, entry count,
evidence count, confidence/depth summary, and validation status. The data
update page uses it to show which candidates are ready for an archive dry-run.
The default `validate-market.mjs --season s05` run validates this index and
cross-checks any indexed rows against their candidate snapshot files.

After the manifest points to a real snapshot, run:

```sh
node scripts/validate-all.mjs --season s05
```
