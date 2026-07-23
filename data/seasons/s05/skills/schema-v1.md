# Skill Catalog Schema V1

This schema describes versioned skill and support metadata. It exists so build
guides can eventually reference exact source data for skill unlock timing,
skill tags, support compatibility, and localized names instead of keeping that
knowledge only in guide prose.

## Top-Level Fields

- `id`: catalog id, for example `s05-skill-catalog-v1`.
- `season`: season label, for example `S05`.
- `versionId`: tool data version, for example `s05-tree-4.5`.
- `source.type`: source status. Current allowed values:
  - `manual-seed-needs-poe2db`: hand-entered seed that must not be treated as
    verified official skill data.
  - `poe2db-snapshot-v1`: normalized data fetched from PoE2DB/编年史.
- `source.note`: short source note.
- `source.version`: optional upstream version label when using a fetched
  PoE2DB/编年史 snapshot.
- `source.fetchedAt`: optional timestamp for fetched snapshots.
- `updatedAt`: ISO timestamp or date for this normalized catalog.
- `entries`: skill and support records.

## Entry Fields

- `id`: stable local id. Build guide skill and support ids must be present in
  this catalog.
- `kind`: `active` or `support`.
- `name`: localized `zhCN`, `zhTW`, and `en`.
- `verificationStatus`: `needs-poe2db-verification` or `verified`.
- `tags`: string array. Use known tags when available; keep `needs-source`
  while still unverified.
- `acquisition`: optional object for unlock timing. Unverified seed entries may
  leave `act`, `level`, and `sourceRef` as `null`.
- `supportRequirements`: optional object for support gems that have tag,
  damage-type, hit, ailment, minion, or reservation constraints.
- `poe2db`: optional object for normalized PoE2DB snapshots. Verified
  `poe2db-snapshot-v1` entries must include:
  - `href`: PoE2DB page slug.
  - `gemTier`: the number shown next to the gem on the PoE2DB gem list. This is
    stored separately and must not be confused with character level.
- `poe2db.detail`: optional compact metadata fetched from the individual
  PoE2DB/编年史 gem page. This is the preferred source for guide-facing unlock
  and compatibility evidence once present:
  - `pageFetchedAt`: ISO timestamp for the detail page fetch.
  - `sourceRef`: exact page URL used for the detail fetch.
  - `from.text`: normalized text from the `From /n` card, for example
    `Uncut Skill Gem Tier 5` or a passive/weapon source.
  - `from.tier`: the uncut gem tier when the `From` text exposes one. This is
    still not a character level.
  - `levelRange` and `requiresLevelRange`: min/max ranges parsed from the page.
  - `requirementsText`, `reservation`, `category`, and `description`: compact
    text from the main gem card.
  - `recommendedSupportRows`: active-skill page summary of recommended support
    gem rows.
  - `compatibleSkillRows`: support-gem page summary of compatible skill rows.

## Validation

Validate the manifest-registered catalog:

```sh
node scripts/validate-skills.mjs --season s05
```

Validate one candidate catalog before replacing the manifest pointer:

```sh
node scripts/validate-skills.mjs --season s05 --file skills/catalog.json
```

If the catalog is still `manual-seed-needs-poe2db`, pages and guides must not
describe unlock timing or support compatibility as confirmed official data.

If the catalog is `poe2db-snapshot-v1`, entries must be marked `verified` and
must not keep the `needs-source` tag. Active entries must include
`acquisition.sourceRef`; support entries must include
`supportRequirements.sourceRef`; all entries must include `poe2db.href` and
`poe2db.gemTier`.

Generate a PoE2DB candidate from current Skill_Gems and Support_Gems pages:

```sh
node scripts/fetch-poe2db-skills.mjs --season s05
node scripts/fetch-poe2db-skills.mjs --season s05 --out <candidate-json> --write
```

Add compact detail metadata from each entry's PoE2DB page:

```sh
node scripts/fetch-poe2db-skill-details.mjs --season s05
node scripts/fetch-poe2db-skill-details.mjs --season s05 --out <candidate-json> --write
```

Archive a verified candidate only after dry-run validation:

```sh
node scripts/archive-skill-catalog.mjs --season s05 --file <candidate-json> --key <snapshot-key>
node scripts/archive-skill-catalog.mjs --season s05 --file <candidate-json> --key <snapshot-key> --write
```
