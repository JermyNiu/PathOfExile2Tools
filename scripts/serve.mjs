#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const poeNinjaCache = new Map();

async function cachedFetchText(key, target, ttlMs) {
  const now = Date.now();
  const cached = poeNinjaCache.get(key);
  if (cached && now - cached.updatedAt < ttlMs) return { ...cached, fromCache: true };
  const upstream = await fetch(target, {
    headers: {
      accept: 'application/json',
      'user-agent': 'poe2-tools-local/0.1'
    }
  });
  const text = await upstream.text();
  if (upstream.ok) {
    const next = { ok: true, status: 200, text, updatedAt: now };
    poeNinjaCache.set(key, next);
    return { ...next, fromCache: false };
  }
  if (cached) return { ...cached, fromCache: true, stale: true, upstreamStatus: upstream.status };
  return { ok: false, status: upstream.status, text, updatedAt: now, fromCache: false };
}

function parseArgs(argv) {
  const args = {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 8766),
    strictPort: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host') args.host = argv[++i];
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--strict-port') args.strictPort = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    throw new Error('--port must be an integer from 0 to 65535');
  }
  if (!args.host || !String(args.host).trim()) throw new Error('--host is required');
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/serve.mjs',
    '  node scripts/serve.mjs --port 8766',
    '  node scripts/serve.mjs --port 0',
    '  node scripts/serve.mjs --host 127.0.0.1 --port 8766 --strict-port',
    '',
    'Serves the local POE2 tools site from the project root.',
    'If the requested port is busy, the server falls back to a random free port unless --strict-port is passed.'
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

async function handlePoeNinjaCurrencyProxy(request, response) {
  const url = new URL(request.url || '/', 'http://local.poe2-tools');
  const league = url.searchParams.get('league') || 'Runes of Aldur';
  if (request.method !== 'GET') {
    response.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }
  const target = `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=Currency`;
  const result = await cachedFetchText(`overview:${league}`, target, 10000);
  response.writeHead(result.ok ? 200 : result.status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-poe-ninja-cache': result.fromCache ? 'hit' : 'miss',
    ...(result.stale ? { 'x-poe-ninja-stale': String(result.upstreamStatus || '') } : {})
  });
  response.end(result.text);
  return true;
}

async function handlePoeNinjaCurrencyDetailsProxy(request, response) {
  const url = new URL(request.url || '/', 'http://local.poe2-tools');
  const league = url.searchParams.get('league') || 'Runes of Aldur';
  const id = url.searchParams.get('id');
  if (request.method !== 'GET') {
    response.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }
  if (!id) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'id is required' }));
    return true;
  }
  const target = `https://poe.ninja/poe2/api/economy/exchange/current/details?league=${encodeURIComponent(league)}&type=Currency&id=${encodeURIComponent(id)}`;
  const result = await cachedFetchText(`details:${league}:${id}`, target, 60000);
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-poe-ninja-cache': result.fromCache ? 'hit' : 'miss',
    ...(result.stale ? { 'x-poe-ninja-stale': String(result.upstreamStatus || '') } : {})
  });
  response.end(result.ok ? result.text : JSON.stringify({ error: 'poe.ninja details unavailable', upstreamStatus: result.status, id }));
  return true;
}

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, 'http://local.poe2-tools');
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

function listen(server, host, port) {
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
    server.listen(port, host);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url || '/', 'http://local.poe2-tools').pathname;
      if (requestPath === '/api/poe-ninja/currency') {
        await handlePoeNinjaCurrencyProxy(request, response);
        return;
      }
      if (requestPath === '/api/poe-ninja/currency-details') {
        await handlePoeNinjaCurrencyDetailsProxy(request, response);
        return;
      }
      const filePath = safeFilePath(request.url || '/');
      const resolvedFile = filePath ? await existingFilePath(filePath) : null;
      if (!resolvedFile) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': contentType(resolvedFile),
        'cache-control': 'no-store'
      });
      createReadStream(resolvedFile).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error.message);
    }
  });
}

async function startServer(args) {
  const server = createServer();
  try {
    await listen(server, args.host, args.port);
  } catch (error) {
    if (error.code !== 'EADDRINUSE' || args.strictPort) throw error;
    await listen(server, args.host, 0);
  }
  return server;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const server = await startServer(args);
  const address = server.address();
  const hostForUrl = address.address === '0.0.0.0' || address.address === '::' ? '127.0.0.1' : address.address;
  const baseUrl = `http://${hostForUrl}:${address.port}/`;

  console.log(JSON.stringify({
    status: 'listening',
    root: repoRoot,
    host: address.address,
    port: address.port,
    baseUrl
  }, null, 2));

  const close = () => {
    server.close((error) => {
      if (error) {
        console.error(error.stack || error.message);
        process.exit(1);
      }
      process.exit(0);
    });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
