# S05 Tree Data

Tree data for S05 should live here when the update script starts storing local
copies of PoE2DB node JSON and route node lists.

Current route data:

- `tactician-supporting-fire-campaign-early.json`: projected early campaign
  route, 21 selected nodes.
- `tactician-supporting-fire-first-ascendancy.json`: projected first
  ascendancy route, 38 selected nodes.
- `tactician-supporting-fire-yellow-maps.json`: projected white/yellow maps
  route, 68 selected nodes.
- `tactician-supporting-fire-red-maps.json`: projected red maps route, 96
  selected nodes.
- `tactician-supporting-fire-endgame.json`: S05 Tactician Supporting Fire
  endgame route, 122 selected nodes, with English, Simplified Chinese, and
  Traditional Chinese node details.

The shared viewer at `tools/passive-tree.html` loads route JSON by `build` and
`stage` query parameters.

Route schema:

- `schema-v1.md`: JSON shape and route protection rules for files loaded by the
  shared passive tree viewer.

Route protection fields:

- `origin`: where the route came from, such as `projected-from-endgame-order` or
  `imported-from-pob-endgame`.
- `overridePolicy`: whether an automation may replace the route.
- `handTuned`: set to `true` after a human has corrected the route for real
  leveling use.

Run `node scripts/validate-routes.mjs --season s05` after changing route JSON or
manifest entries. Validate one candidate route before replacing a stage:

```sh
node scripts/validate-routes.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file tree/tactician-supporting-fire-campaign-early.json
```

When a projected leveling route has been corrected by hand, archive it through
the dry-run-first route archiver instead of editing manifest and build fields by
hand:

```sh
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json
node scripts/archive-route.mjs --season s05 --build tactician-supporting-fire --stage campaign-early --file /tmp/tactician-campaign-early-hand-tuned.json --write
```

The candidate must declare `meta.origin=hand-tuned-manual`,
`meta.overridePolicy=manual-review-required`, and `meta.handTuned=true`.

Raw source data downloaded by `scripts/update-data.mjs --write`:

- `raw/4.5/data_us.json`
- `raw/4.5/data_cn.json`
- `raw/4.5/data_tw.json`
