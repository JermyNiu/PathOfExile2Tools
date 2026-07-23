# Passive Tree Route Schema V1

This schema describes route JSON files loaded by `tools/passive-tree.html` and
registered in `data/seasons/s05/manifest.json` under `tree.routes`.

## Required Fields

- `nodeIds`: ordered passive node ids selected by the route.
- `classId`: PoE2 passive tree class id.
- `ascendancyId`: ascendancy id used by the route.
- `alternateAscendancyId`: alternate ascendancy id, usually `0`.
- `locales.en`: node details in English.
- `locales.zh-CN`: node details in Simplified Chinese.
- `locales.zh-TW`: node details in Traditional Chinese.
- `meta.buildId`: build id matching the manifest route.
- `meta.stageId`: stage id matching the manifest route.
- `meta.origin`: route origin matching the manifest route.
- `meta.overridePolicy`: replacement policy matching the manifest route.
- `meta.handTuned`: manual route flag matching the manifest route.

Each locale entry must preserve the same node ids as `nodeIds` and use
1-based `order` values.

## Route Protection

Projected leveling routes use:

- `meta.origin=projected-from-endgame-order`
- `meta.overridePolicy=replaceable-until-hand-tuned`
- `meta.projection.strategy=prefix-by-pob-node-order`
- `meta.handTuned=false`

After a route is corrected by hand for real leveling, set `meta.handTuned=true`
and move the manifest route to `overridePolicy=manual-review-required`.

Hand-tuned candidate routes should use:

- `meta.origin=hand-tuned-manual`
- `meta.overridePolicy=manual-review-required`
- `meta.handTuned=true`

Use `scripts/validate-route-candidate.mjs` before a candidate is registered.
It validates the candidate metadata, stage ownership, locale ordering, and
checks that every node id exists in the current season raw tree data.

Use `scripts/archive-route.mjs` to replace the registered route. The script
validates the candidate, updates the manifest route metadata, and syncs the
matching build stage route review fields only when `--write` is present.

## Validation

Validate all manifest-registered routes:

```sh
node scripts/validate-routes.mjs --season s05
```

Validate one candidate route against its manifest metadata:

```sh
node scripts/validate-routes.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file tree/tactician-supporting-fire-campaign-early.json
```

Validate one unregistered hand-tuned candidate before it appears in manifest:

```sh
node scripts/validate-route-candidate.mjs --season s05 --build infernalist-minions --stage campaign-early --file /tmp/infernalist-campaign-early-route.json
```

Archive a reviewed hand-tuned candidate after checking the dry-run:

```sh
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json --write
```
