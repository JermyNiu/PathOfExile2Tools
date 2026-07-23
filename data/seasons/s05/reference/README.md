# S05 Reference Data

This folder is the versioned local reference index for data copied from PoE2DB/Chronicle.

The goal is that every user-facing page resolves names, descriptions, stats, passives, gems, supports, equipment, base items, and unique items from the selected version's local data instead of from a global latest dictionary.

Current state:

- Passives are already stored as localized raw files under `tree/raw/4.5/`.
- Skills and support gems use `skills/snapshots/catalog-poe2db-4.5-complete.json`.
- Unique items are stored in `reference/poe2db/4.5/items/uniques.json`.
- Base items, equipment bases, currency-like items, flasks, charms, jewels, waystones, runes, catalysts, essences, and other listed item classes are stored in `reference/poe2db/4.5/items/base-items.json`.
- Focused item detail pages for parsed-import gaps are stored in `reference/poe2db/4.5/items/item-details.json`.
- Listed modifier rows are stored in `reference/poe2db/4.5/stats/modifiers.json`.
- Extra modifier-like pages used by parsed equipment are stored in `reference/poe2db/4.5/stats/extra-modifiers.json`.
- `Misc_Map_Items` is recorded as skipped during fetch because PoE2DB currently returns 404 for `/us`, `/cn`, and `/tw`.

Version rule:

- A BD guide should use its own `versionId`.
- A Ninja/PoB import should resolve through the user-selected or detected `versionId`.
- If a newer PoE2DB version is pulled, create or update a separate season/version data root instead of replacing old localized data in place.

Expected target layout:

```text
reference/
├── poe2db/
│   └── 4.5/
│       ├── skills/
│       │   ├── skill-gems.json
│       │   ├── support-gems.json
│       │   └── details.json
│       ├── items/
│       │   ├── base-items.json
│       │   ├── uniques.json
│       │   ├── currency.json
│       │   └── equipment.json
│       └── stats/
│           ├── mods.json
│           └── stat-translations.json
```

Each catalog should keep all supported locales in the same entry:

```json
{
  "id": "Hollow_Focus",
  "kind": "skill",
  "name": {
    "en": "Hollow Focus",
    "zhCN": "...",
    "zhTW": "..."
  },
  "source": {
    "type": "poe2db",
    "version": "4.5",
    "href": "Hollow_Focus"
  }
}
```
