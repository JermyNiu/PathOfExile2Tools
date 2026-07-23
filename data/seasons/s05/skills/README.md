# Skills

This folder stores versioned skill and support metadata for S05.

- `catalog.json`: original local skill/support seed kept for reference.
- `snapshots/catalog-live-poe2db.json`: current manifest-registered PoE2DB
  skill/support snapshot for the Tactician guide ids.
- `snapshots/catalog-live-poe2db-details.json`: current manifest-registered
  PoE2DB skill/support snapshot with compact per-gem page details.
- `schema-v1.md`: catalog contract.

The original `catalog.json` is a manual seed that covers the skill and support
ids used by the Tactician guide. It is intentionally marked
`manual-seed-needs-poe2db`; keep it as a fallback/reference, not as a confirmed
official unlock table.

PoE2DB/编年史候选目录不要直接覆盖 `catalog.json`。先抓取候选：

```sh
node scripts/fetch-poe2db-skills.mjs --season s05 --out <candidate-json> --write
```

补充每个技能/辅助单页详情：

```sh
node scripts/fetch-poe2db-skill-details.mjs --season s05 --out <candidate-json> --write
```

再运行：

```sh
node scripts/archive-skill-catalog.mjs --season s05 --file <candidate-json> --key <snapshot-key>
```

确认 dry-run 中 `sourceType=poe2db-snapshot-v1`、当前 BD 引用覆盖完整、验证失败数为
0 后，再加 `--write` 归档到 `skills/snapshots/` 并切换 manifest 指针。
