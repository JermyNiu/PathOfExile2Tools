# Version Data Schema V1

This schema describes the top-level version registry and each season manifest.
The goal is to keep old seasons and tree versions readable after future POE2
patches.

## `data/versions.json`

Required top-level fields:

- `current`: the version selected by default.
- `sources`: source URLs used to bootstrap the current data.
- `history`: all known data versions.

`current` and every `history` entry use:

- `id`: stable tool version id, for example `s05-tree-4.5`.
- `season`: user-facing season label, for example `S05`.
- `poe2dbPassiveTreeVersion`: passive tree data version.
- `pobbTreeSvgVersion`: passive tree SVG version.
- `dataRoot`: folder that contains the season manifest.

Every history entry also uses:

- `builds`: list of build JSON files belonging to this version.
- `buildCount`: must equal `builds.length`.
- `status`: lifecycle state, one of `draft`, `active`, or `archived`.

`current.id` must exist in `history`. History ids must be unique.

## Season `manifest.json`

The manifest under `data/seasons/<season>/manifest.json` must match the version
entry:

- `versionId` equals the history entry `id`.
- `label` equals the history entry `season`.
- `tree.poe2dbVersion` equals `poe2dbPassiveTreeVersion`.
- `tree.pobbSvgVersion` equals `pobbTreeSvgVersion`.
- `builds.length` equals `buildCount`.

The manifest also owns module paths for the selected version:

- `tree.routes`
- `builds`
- `buildCandidates`
- `skills.catalog`
- `market.gemFlips`
- `market.hideoutFlips`
- `ninja.sampleImport`
- `dataFolders.builds`
- `dataFolders.tree`
- `dataFolders.skills`
- `dataFolders.market`
- `dataFolders.ninja`

`buildCandidates` is an optional versioned backlog file, usually
`builds/candidates.json`. It is not a published build list. The data update
page uses it to generate scaffold, validation, and registration commands for
future league starter guides. A candidate only becomes visible on the homepage
after its build JSON is completed, validated, and registered in `builds`.

## Validation

Validate all known versions:

```sh
node scripts/validate-versions.mjs
```

Validate one version before switching `current` or adding it to UI history:

```sh
node scripts/validate-versions.mjs --id s05-tree-4.5
```
