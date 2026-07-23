#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node scripts/generate-version-log.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.5 --season s05',
    '  node scripts/generate-version-log.mjs --from-version s05-tree-4.5 --to-version s05-tree-4.6 --season s05 --write',
    '',
    'Generates a Markdown update log for a target version using version metadata, tree diff, and switch-current readiness.',
    'Default mode prints the Markdown to stdout. Use --write to save under <dataRoot>/changelog/.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    fromVersion: null,
    toVersion: null,
    season: null,
    lang: 'zhCN',
    write: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from-version') args.fromVersion = argv[++i];
    else if (arg === '--to-version') args.toVersion = argv[++i];
    else if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--lang') args.lang = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.fromVersion) throw new Error('--from-version is required');
  if (!args.toVersion) throw new Error('--to-version is required');
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function runNodeScript(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function findVersion(versions, id) {
  const version = (versions.history || []).find((item) => item.id === id);
  if (!version) throw new Error(`version not found: ${id}`);
  return version;
}

function formatList(items) {
  if (!items.length) return '- 无';
  return items.map((item) => `- ${item}`).join('\n');
}

function renderDiffSection(diffResult) {
  if (!diffResult || diffResult.error) {
    return [
      '## 天赋节点 Diff',
      '',
      `- 状态：失败`,
      `- 错误：${diffResult?.error || 'unknown'}`
    ].join('\n');
  }

  const impacted = diffResult.impactedRoutes || [];
  return [
    '## 天赋节点 Diff',
    '',
    `- 对比语言：${diffResult.lang}`,
    `- 旧节点数：${diffResult.compared.fromNodes}`,
    `- 新节点数：${diffResult.compared.toNodes}`,
    `- 新增节点：${diffResult.summary.added}`,
    `- 删除节点：${diffResult.summary.removed}`,
    `- 变化节点：${diffResult.summary.changed}`,
    `- 影响路线：${diffResult.summary.impactedRoutes}`,
    '',
    '### 受影响路线',
    '',
    impacted.length
      ? impacted.map((route) => `- ${route.buildId}:${route.stageId} affected=${route.affectedNodeCount} nodes=${route.affectedNodeIds.join(',')}`).join('\n')
      : '- 无'
  ].join('\n');
}

function renderReadinessSection(readiness) {
  const failed = readiness?.failed ?? 1;
  return [
    '## 切换 Current 检查',
    '',
    `- 状态：${failed === 0 ? '通过' : '未通过'}`,
    `- 检查文件数：${readiness?.checkedFiles ?? 0}`,
    `- 缺失文件数：${readiness?.missingFiles?.length ?? 0}`,
    '',
    '### 阻塞项',
    '',
    formatList(readiness?.failures || [])
  ].join('\n');
}

function renderMarkdown({ args, fromVersion, toVersion, diffResult, readiness }) {
  const now = new Date().toISOString();
  return [
    `# ${toVersion.id} 更新日志`,
    '',
    `生成时间：${now}`,
    '',
    '## 版本信息',
    '',
    `- 来源版本：${fromVersion.id}`,
    `- 目标版本：${toVersion.id}`,
    `- 赛季：${toVersion.season}`,
    `- PoE2DB 天赋版本：${fromVersion.poe2dbPassiveTreeVersion} -> ${toVersion.poe2dbPassiveTreeVersion}`,
    `- PoB SVG 版本：${fromVersion.pobbTreeSvgVersion} -> ${toVersion.pobbTreeSvgVersion}`,
    `- 目标数据目录：${toVersion.dataRoot}`,
    `- 目标状态：${toVersion.status}`,
    '',
    renderDiffSection(diffResult),
    '',
    renderReadinessSection(readiness),
    '',
    '## 建议后续命令',
    '',
    '```sh',
    `node scripts/validate-versions.mjs --id ${toVersion.id}`,
    args.season ? `node scripts/validate-all.mjs --season ${args.season}` : '# node scripts/validate-all.mjs --season <season-folder>',
    args.season ? `node scripts/validate-suite.mjs --season ${args.season} --serve` : '# node scripts/validate-suite.mjs --season <season-folder> --serve',
    `node scripts/switch-current.mjs --id ${toVersion.id}`,
    '```',
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const versions = await readJson(path.join(repoRoot, 'data', 'versions.json'));
  const fromVersion = findVersion(versions, args.fromVersion);
  const toVersion = findVersion(versions, args.toVersion);
  const diffArgs = ['--from-version', fromVersion.id, '--to-version', toVersion.id, '--lang', args.lang];
  if (args.season) diffArgs.push('--season', args.season);
  const diffRun = await runNodeScript('scripts/diff-tree.mjs', diffArgs);
  const switchRun = await runNodeScript('scripts/switch-current.mjs', ['--id', toVersion.id]);
  const diffResult = diffRun.code === 0 ? JSON.parse(diffRun.stdout) : { error: diffRun.stderr || diffRun.stdout };
  const readiness = switchRun.stdout ? JSON.parse(switchRun.stdout) : { failed: 1, failures: [switchRun.stderr || 'switch-current produced no output'] };
  const markdown = renderMarkdown({ args, fromVersion, toVersion, diffResult, readiness });
  const outputFile = path.join(repoRoot, toVersion.dataRoot, 'changelog', `${fromVersion.id}-to-${toVersion.id}.md`);

  if (!args.write) {
    console.log(markdown);
    return;
  }

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, markdown);
  console.log(JSON.stringify({
    status: 'written',
    file: path.relative(repoRoot, outputFile),
    diffFailed: diffRun.code,
    readinessFailed: readiness.failed
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
