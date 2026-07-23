# S05 Ninja Imports

Reserved for parsed poe.ninja or player-export configurations.

If an export contains its own version, store it with the parsed result. If not,
store the selected tool version from the import screen.

Current tool page:

- `../../../tools/ninja-import.html`
- `sample-import.json`: sample parser output for the v1 local import schema.
- `schema-v1.md`: archive schema for exported parser results.
- `examples/parsed-import-with-analysis.example.json`: fixture that includes
  the optional BD comparison block.
- `examples/parsed-raw-pob-xml.example.json`: fixture for a raw PoB XML parser
  result before optional BD comparison.

Current parser scope:

- JSON
- Base64 JSON when the text can be decoded directly
- PoB Code with compressed JSON or XML payloads
- Raw PoB XML pasted directly into the parser
- Text fallback with version assignment only

The parser currently displays results in the browser and does not write imports
to this folder directly. Use the page's export button to download the parsed
JSON; after parsing, the page's "Archive Next Step" panel previews the matching
`validate-ninja.mjs` and `archive-ninja-import.mjs` commands. The preview is
dry-run first and only writes to `manifest.ninja` when the final command is run
with `--write`.

The comparison target is selected on the page. Options come from the active
version manifest's `builds` list, and the parser compares against the chosen
build data plus its endgame passive route. When available, the exported JSON
includes the optional `analysis` block for skill, support, minion support
decision matrix, gear keyword, gear stat, and passive coverage.

Validation:

```sh
node scripts/validate-ninja.mjs --season s05
node scripts/validate-ninja.mjs --season s05 --examples
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-import-with-analysis.example.json --key example
node scripts/validate-ninja.mjs --season s05 --file ninja/examples/parsed-raw-pob-xml.example.json --key raw-pob-xml
node scripts/archive-ninja-import.mjs --season s05 --file ~/Downloads/ninja-s05-tree-4.5-DemoTactician.json --key demotactician
node scripts/archive-ninja-import.mjs --season s05 --file ~/Downloads/ninja-s05-tree-4.5-DemoTactician.json --key demotactician --write
```
