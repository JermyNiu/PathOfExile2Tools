#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    season: 's05',
    baseUrl: 'http://127.0.0.1:8766',
    timeoutMs: 10000,
    skipPages: false,
    skipRuntime: false,
    serve: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (arg === '--skip-pages') args.skipPages = true;
    else if (arg === '--skip-runtime') args.skipRuntime = true;
    else if (arg === '--serve') args.serve = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/validate-suite.mjs [--season s05] [--base-url http://127.0.0.1:8766]',
    '  node scripts/validate-suite.mjs --season s05 --serve',
    '  node scripts/validate-suite.mjs --skip-runtime',
    '',
    'Runs the full local quality gate:',
    '  1. data contracts through scripts/validate-all.mjs',
    '  2. static page smoke checks through scripts/validate-pages.mjs',
    '  3. browser-side hydration checks through scripts/validate-runtime-pages.mjs',
    '',
    '--serve starts a temporary static server and closes it after checks finish.'
  ].join('\n');
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const filePath = path.resolve(repoRoot, relativePath);
  if (!filePath.startsWith(repoRoot + path.sep) && filePath !== repoRoot) return null;
  return filePath;
}

async function existingFilePath(filePath) {
  const item = await stat(filePath).catch(() => null);
  if (!item) return null;
  if (item.isDirectory()) {
    const indexFile = path.join(filePath, 'index.html');
    const indexStat = await stat(indexFile).catch(() => null);
    return indexStat?.isFile() ? indexFile : null;
  }
  return item.isFile() ? filePath : null;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function startStaticServer(baseUrl) {
  const preferred = new URL(baseUrl);
  const preferredPort = Number(preferred.port || 80);
  const server = http.createServer(async (request, response) => {
    try {
      const filePath = safeFilePath(request.url || '/');
      const resolvedFile = filePath ? await existingFilePath(filePath) : null;
      if (!resolvedFile) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': contentType(resolvedFile) });
      createReadStream(resolvedFile).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error.message);
    }
  });

  try {
    await listen(server, preferredPort);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    await listen(server, 0);
  }

  const address = server.address();
  const actualBaseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl: actualBaseUrl,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

function runNodeScript(script, args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      resolve({
        script,
        args,
        code,
        status: code === 0 ? 'ok' : 'failed',
        durationMs: Date.now() - startedAt,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function parseJsonOutput(result) {
  if (!result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch (_) {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  let server = null;
  if (args.serve && (!args.skipPages || !args.skipRuntime)) {
    server = await startStaticServer(args.baseUrl);
    args.baseUrl = server.baseUrl;
  }

  const checks = [
    {
      id: 'data',
      script: 'scripts/validate-all.mjs',
      args: ['--season', args.season]
    }
  ];

  if (!args.skipPages) {
    checks.push({
      id: 'pages',
      script: 'scripts/validate-pages.mjs',
      args: ['--base-url', args.baseUrl, '--timeout-ms', String(args.timeoutMs)]
    });
  }

  if (!args.skipRuntime) {
    checks.push({
      id: 'runtime',
      script: 'scripts/validate-runtime-pages.mjs',
      args: ['--base-url', args.baseUrl, '--timeout-ms', String(args.timeoutMs)]
    });
  }

  const results = [];
  try {
    for (const check of checks) {
      const result = await runNodeScript(check.script, check.args);
      results.push({
        id: check.id,
        script: result.script,
        args: result.args,
        status: result.status,
        durationMs: result.durationMs,
        summary: parseJsonOutput(result),
        stdout: result.status === 'ok' ? undefined : result.stdout,
        stderr: result.status === 'ok' ? undefined : result.stderr
      });
    }
  } finally {
    if (server) await server.close();
  }

  const failed = results.filter((result) => result.status !== 'ok');
  console.log(JSON.stringify({
    season: args.season,
    baseUrl: args.baseUrl,
    served: Boolean(server),
    failed: failed.length,
    checks: results
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
