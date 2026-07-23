#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zhCN', 'zhTW', 'en'];

function parseArgs(argv) {
  const args = {
    season: 's05',
    id: null,
    titleZh: null,
    titleTw: null,
    titleEn: null,
    baseZh: null,
    baseTw: null,
    baseEn: null,
    ascendancyZh: null,
    ascendancyTw: null,
    ascendancyEn: null,
    fromCandidate: false,
    out: null,
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--title-zh') args.titleZh = argv[++i];
    else if (arg === '--title-tw') args.titleTw = argv[++i];
    else if (arg === '--title-en') args.titleEn = argv[++i];
    else if (arg === '--base-zh') args.baseZh = argv[++i];
    else if (arg === '--base-tw') args.baseTw = argv[++i];
    else if (arg === '--base-en') args.baseEn = argv[++i];
    else if (arg === '--ascendancy-zh') args.ascendancyZh = argv[++i];
    else if (arg === '--ascendancy-tw') args.ascendancyTw = argv[++i];
    else if (arg === '--ascendancy-en') args.ascendancyEn = argv[++i];
    else if (arg === '--from-candidate') args.fromCandidate = true;
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/scaffold-build.mjs --id infernalist-minions --title-zh "..." --title-tw "..." --title-en "..."',
    '  node scripts/scaffold-build.mjs --season s05 --id infernalist-minions --from-candidate',
    '  node scripts/scaffold-build.mjs --season s05 --id infernalist-minions --write',
    '',
    'Creates a candidate build JSON from data/templates/build-guide-template.json.',
    'Dry-run by default. Use --write to create the file.',
    'This script does not edit manifest.json or create an HTML guide page; register the build only after replacing placeholders and passing validation.'
  ].join('\n');
}

function assertId(id) {
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('--id must be lowercase kebab-case, for example tactician-supporting-fire');
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readCandidate(seasonRoot, manifest, id) {
  const relativeFile = manifest.buildCandidates || 'builds/candidates.json';
  const file = path.resolve(seasonRoot, relativeFile);
  if (!file.startsWith(seasonRoot + path.sep)) {
    throw new Error(`Candidate file must stay inside ${seasonRoot}: ${relativeFile}`);
  }
  const data = await readJson(file);
  const candidate = (data.candidates || []).find((entry) => entry.id === id);
  if (!candidate) {
    throw new Error(`Candidate not found in ${relativeFile}: ${id}`);
  }
  return { candidate, relativeFile };
}

function localizedFromArgs(args, prefix, fallback) {
  return {
    zhCN: args[`${prefix}Zh`] || fallback.zhCN,
    zhTW: args[`${prefix}Tw`] || fallback.zhTW,
    en: args[`${prefix}En`] || fallback.en
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  assertId(args.id);

  const templateFile = path.join(repoRoot, 'data', 'templates', 'build-guide-template.json');
  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const template = await readJson(templateFile);
  const candidateSource = args.fromCandidate ? await readCandidate(seasonRoot, manifest, args.id) : null;
  const candidate = candidateSource?.candidate || {};
  const outFile = path.resolve(repoRoot, args.out || path.join('data', 'seasons', args.season, 'builds', `${args.id}.json`));

  if (!outFile.startsWith(seasonRoot + path.sep)) {
    throw new Error(`Output must stay inside ${seasonRoot}`);
  }
  if ((manifest.builds || []).some((entry) => entry.id === args.id)) {
    throw new Error(`Build id is already registered in manifest: ${args.id}`);
  }
  if (!args.force && await exists(outFile)) {
    throw new Error(`Output file already exists: ${path.relative(repoRoot, outFile)}. Use --force to overwrite.`);
  }

  const data = structuredClone(template);
  data.id = args.id;
  data.season = manifest.label || template.season;
  data.versionId = manifest.versionId || template.versionId;
  data.title = localizedFromArgs(args, 'title', candidate.title || data.title);
  data.class.base = localizedFromArgs(args, 'base', candidate.class?.base || data.class.base);
  data.class.ascendancy = localizedFromArgs(args, 'ascendancy', candidate.class?.ascendancy || data.class.ascendancy);
  data.source.notes = candidateSource
    ? `Scaffolded from ${candidateSource.relativeFile}. Replace placeholders before registering ${args.id}.`
    : `Scaffolded from data/templates/build-guide-template.json. Replace placeholders before registering ${args.id}.`;
  data.tags = [...new Set(['draft', args.id, ...(data.tags || [])])];

  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const manifestDataPath = path.relative(seasonRoot, outFile);
  const summary = {
    status: args.write ? 'written' : 'dry-run',
    season: args.season,
    id: args.id,
    file: path.relative(repoRoot, outFile),
    sourceCandidate: candidateSource ? candidateSource.relativeFile : '',
    manifestEntry: {
      id: args.id,
      status: 'draft',
      data: manifestDataPath,
      guide: `../../../builds/${args.id}.html`
    },
    nextCommands: [
      `node scripts/validate-builds.mjs --season ${args.season} --id ${args.id} --file ${manifestDataPath}`,
      `node scripts/validate-build-guides.mjs --season ${args.season} --id ${args.id}`
    ],
    note: 'This script does not edit manifest.json; replace placeholders and validate before registering the build.'
  };

  if (args.write) {
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, serialized);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
