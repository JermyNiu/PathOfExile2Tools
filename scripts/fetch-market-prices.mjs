#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const poe2scoutBaseUrl = 'https://api.poe2scout.com';
const poeNinjaBaseUrl = 'https://poe.ninja';

function usage() {
  return [
    'Usage:',
    '  node scripts/fetch-market-prices.mjs --season s05 --kind hideoutFlips --offers market/hideout-warrior-offers.json',
    '  node scripts/fetch-market-prices.mjs --season s05 --kind hideoutFlips --offers market/hideout-warrior-offers.json --write',
    '',
    'Fetches poe.ninja market prices and combines them with manual hideout warrior gold-cost offers.',
    'Gold costs are not fetched from the game; edit the offers file before running this script.',
    'Default mode is dry-run. Use --write to add a real-snapshot-v1 candidate under market/candidates/.'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    season: 's05',
    kind: 'hideoutFlips',
    offers: 'market/hideout-warrior-offers.json',
    league: 'auto',
    provider: 'poe.ninja',
    key: null,
    minListingDepth: 5,
    write: false,
    force: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--season') args.season = argv[++i].toLowerCase();
    else if (arg === '--kind') args.kind = argv[++i];
    else if (arg === '--offers') args.offers = argv[++i];
    else if (arg === '--league') args.league = argv[++i];
    else if (arg === '--provider') args.provider = argv[++i];
    else if (arg === '--key') args.key = argv[++i];
    else if (arg === '--min-listing-depth') args.minListingDepth = Number(argv[++i]);
    else if (arg === '--write') args.write = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'market-prices';
}

function resolveSeasonFile(seasonRoot, file) {
  if (path.isAbsolute(file)) return file;
  if (file.startsWith(`data${path.sep}`) || file.startsWith('data/')) return path.join(repoRoot, file);
  return path.join(seasonRoot, file);
}

function encodePathPart(value) {
  return encodeURIComponent(value).replace(/%20/g, '%20');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'poe2-tools-local/0.1'
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

async function discoverLeague(realm, requestedLeague) {
  if (requestedLeague && requestedLeague !== 'auto') return { league: requestedLeague, discovered: false, leagues: [] };
  const leagues = await fetchJson(`${poe2scoutBaseUrl}/${encodePathPart(realm)}/Leagues`);
  const current = leagues.find((league) => league.IsCurrent && !String(league.Value).startsWith('HC ')) || leagues.find((league) => league.IsCurrent) || leagues[0];
  if (!current?.Value) throw new Error('poe2scout returned no usable league');
  return { league: current.Value, discovered: true, leagues };
}

function discoverPoeNinjaLeague(requestedLeague) {
  if (requestedLeague && requestedLeague !== 'auto') return { league: requestedLeague, discovered: false, leagues: [] };
  return { league: 'Runes of Aldur', discovered: true, leagues: [] };
}

async function fetchPoeNinjaCurrencyOverview(league) {
  const url = `${poeNinjaBaseUrl}/poe2/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=Currency`;
  return fetchJson(url);
}

async function fetchCurrencyPages(realm, league, minDataPoints) {
  const perPage = 50;
  const firstUrl = `${poe2scoutBaseUrl}/${encodePathPart(realm)}/Leagues/${encodePathPart(league)}/Currencies/ByCategory?category=Currency&page=1&perPage=${perPage}&dataPoints=${minDataPoints}&frequencyHours=1&referenceCurrency=exalted`;
  const first = await fetchJson(firstUrl);
  const pages = Number(first.Pages) || 1;
  const items = [...(first.Items || [])];
  for (let page = 2; page <= pages; page += 1) {
    const url = `${poe2scoutBaseUrl}/${encodePathPart(realm)}/Leagues/${encodePathPart(league)}/Currencies/ByCategory?category=Currency&page=${page}&perPage=${perPage}&dataPoints=${minDataPoints}&frequencyHours=1&referenceCurrency=exalted`;
    const data = await fetchJson(url);
    items.push(...(data.Items || []));
  }
  return items;
}

async function fetchItems(realm, league) {
  const url = `${poe2scoutBaseUrl}/${encodePathPart(realm)}/Leagues/${encodePathPart(league)}/Items`;
  return fetchJson(url);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildMarketIndex(rows) {
  const byApiId = new Map();
  const byItemId = new Map();
  const byText = new Map();
  const preferRicherRow = (existing, next) => {
    if (!existing) return next;
    const existingScore = (Number(existing.CurrentQuantity) || 0) + (Array.isArray(existing.PriceLogs) ? existing.PriceLogs.length : 0);
    const nextScore = (Number(next.CurrentQuantity) || 0) + (Array.isArray(next.PriceLogs) ? next.PriceLogs.length : 0);
    return nextScore > existingScore ? next : existing;
  };
  const setBest = (map, key, row) => {
    const normalized = normalizeKey(key);
    if (!normalized) return;
    map.set(normalized, preferRicherRow(map.get(normalized), row));
  };
  for (const row of rows) {
    if (row.ApiId) setBest(byApiId, row.ApiId, row);
    if (row.ItemId !== undefined && row.ItemId !== null) setBest(byItemId, row.ItemId, row);
    if (row.Text) setBest(byText, row.Text, row);
  }
  return { byApiId, byItemId, byText };
}

function buildPoeNinjaMarketIndex(data) {
  const itemById = new Map((data.items || []).map((item) => [normalizeKey(item.id), item]));
  const itemByName = new Map((data.items || []).map((item) => [normalizeKey(item.name), item]));
  const byApiId = new Map();
  const byText = new Map();
  for (const line of data.lines || []) {
    const item = itemById.get(normalizeKey(line.id)) || {};
    const row = { ...line, item, Text: item.name || line.id, ApiId: line.id };
    byApiId.set(normalizeKey(line.id), row);
    if (item.name) byText.set(normalizeKey(item.name), row);
  }
  for (const [name, item] of itemByName.entries()) {
    if (!byText.has(name) && byApiId.has(normalizeKey(item.id))) byText.set(name, byApiId.get(normalizeKey(item.id)));
  }
  return { byApiId, byItemId: new Map(), byText };
}

function findMarketRow(index, offer) {
  const ref = offer.marketRef || {};
  if (ref.apiId && index.byApiId.has(normalizeKey(ref.apiId))) return index.byApiId.get(normalizeKey(ref.apiId));
  if (ref.itemId !== undefined && ref.itemId !== null && index.byItemId.has(String(ref.itemId))) return index.byItemId.get(String(ref.itemId));
  if (ref.text && index.byText.has(normalizeKey(ref.text))) return index.byText.get(normalizeKey(ref.text));
  return null;
}

function cleanPriceLogs(logs) {
  return (logs || [])
    .filter((log) => log && Number.isFinite(Number(log.Price)) && log.Time)
    .map((log) => ({
      price: Number(log.Price),
      time: log.Time,
      quantity: Number(log.Quantity) || 0
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function changePct(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return (current - previous) / previous * 100;
}

function closestOlderLog(logs, currentTime, hours) {
  const target = currentTime - hours * 3600000;
  let best = null;
  let bestDistance = Infinity;
  for (const log of logs) {
    const time = new Date(log.time).getTime();
    if (!Number.isFinite(time) || time > currentTime) continue;
    const distance = Math.abs(time - target);
    if (distance < bestDistance) {
      best = log;
      bestDistance = distance;
    }
  }
  return best;
}

function trendFromLogs(row) {
  const logs = cleanPriceLogs(row.PriceLogs);
  const latest = logs[0] || {
    price: Number(row.CurrentPrice) || 0,
    time: new Date().toISOString(),
    quantity: Number(row.CurrentQuantity) || 0
  };
  const currentTime = new Date(latest.time).getTime();
  const oneHour = logs[1] || closestOlderLog(logs, currentTime, 1);
  const sixHour = closestOlderLog(logs, currentTime, 6);
  const day = closestOlderLog(logs, currentTime, 24);
  return {
    observedAt: latest.time,
    currentPrice: Number(row.CurrentPrice) || latest.price,
    currentQuantity: Number(row.CurrentQuantity) || latest.quantity || 0,
    logs,
    oneHourChangePct: changePct(latest.price, oneHour?.price),
    sixHourChangePct: changePct(latest.price, sixHour?.price),
    dayChangePct: changePct(latest.price, day?.price)
  };
}

function trendFromPoeNinja(row, data) {
  const exaltedRate = Number(data.core?.rates?.exalted) || 0;
  if (!exaltedRate) throw new Error('poe.ninja response has no exalted exchange rate');
  const sparkline = row.sparkline || {};
  const points = Array.isArray(sparkline.data) ? sparkline.data.filter((point) => Number.isFinite(Number(point))).map(Number) : [];
  const totalChange = Number.isFinite(Number(sparkline.totalChange)) ? Number(sparkline.totalChange) : null;
  const lastPoint = points.length ? points[points.length - 1] : totalChange;
  const prevPoint = points.length > 1 ? points[points.length - 2] : null;
  const recentChange = Number.isFinite(lastPoint) && Number.isFinite(prevPoint) ? lastPoint - prevPoint : totalChange;
  const currentPrice = Number(row.primaryValue || 0) * exaltedRate;
  const volume = Math.floor(Number(row.volumePrimaryValue || 0) * exaltedRate);
  const baseChange = Number.isFinite(totalChange) ? totalChange : lastPoint;
  const basePrice = Number.isFinite(baseChange) && baseChange !== -100
    ? currentPrice / (1 + baseChange / 100)
    : currentPrice;
  return {
    observedAt: new Date().toISOString(),
    currentPrice,
    currentQuantity: volume,
    logs: points.map((point, index) => ({
      price: Number((basePrice * (1 + point / 100)).toFixed(4)),
      time: `poe.ninja-sparkline-${index + 1}`,
      quantity: volume,
      changePct: point
    })),
    oneHourChangePct: Number.isFinite(recentChange) ? recentChange : null,
    sixHourChangePct: null,
    dayChangePct: Number.isFinite(totalChange) ? totalChange : null,
    poeNinja: {
      primaryValue: Number(row.primaryValue || 0),
      exaltedRate,
      volumePrimaryValue: Number(row.volumePrimaryValue || 0),
      maxVolumeCurrency: row.maxVolumeCurrency || '',
      maxVolumeRate: Number(row.maxVolumeRate || 0),
      sparkline: {
        totalChange,
        data: points
      }
    }
  };
}

function alertFromTrend(trend, minListingDepth) {
  const alerts = [];
  const depth = Number(trend.currentQuantity) || 0;
  const oneHour = trend.oneHourChangePct;
  if (Number.isFinite(oneHour) && oneHour >= 50 && depth >= minListingDepth) alerts.push({ level: 'critical', type: 'short-spike', window: '1h', changePct: Number(oneHour.toFixed(2)) });
  else if (Number.isFinite(oneHour) && oneHour >= 25 && depth >= minListingDepth) alerts.push({ level: 'warning', type: 'rising-fast', window: '1h', changePct: Number(oneHour.toFixed(2)) });
  if (Number.isFinite(oneHour) && oneHour >= 25 && depth < minListingDepth) alerts.push({ level: 'warning', type: 'possible-manipulation', window: '1h', changePct: Number(oneHour.toFixed(2)) });
  return alerts;
}

function confidenceFor(row, trend, minListingDepth) {
  const depth = Number(row.CurrentQuantity ?? trend.currentQuantity) || 0;
  const depthScore = Math.min(70, depth / Math.max(1, minListingDepth) * 35);
  const historyScore = Math.min(20, trend.logs.length * 3);
  const volatilityPenalty = Math.min(25, Math.abs(trend.oneHourChangePct || 0) / 2);
  return Math.max(0, Math.min(100, Math.round(20 + depthScore + historyScore - volatilityPenalty)));
}

function liquidityFor(row, trend, minListingDepth) {
  const quantity = Number(row.CurrentQuantity ?? trend.currentQuantity) || 0;
  return Math.max(0, Math.min(100, Math.round(quantity / Math.max(1, minListingDepth * 8) * 100)));
}

function riskFor(trend, confidence, minListingDepth) {
  const depth = Number(trend.currentQuantity) || 0;
  const volatility = Math.min(45, Math.abs(trend.oneHourChangePct || 0));
  const lowDepth = depth < minListingDepth ? 25 : 0;
  return Math.max(0, Math.min(100, Math.round(100 - confidence + volatility + lowDepth)));
}

function localizeTrendNote(trend, alerts) {
  const recentPoint = Number.isFinite(trend.oneHourChangePct) ? `${trend.oneHourChangePct.toFixed(1)}%` : '-';
  const alertText = alerts.length ? alerts.map((alert) => `${alert.type} ${alert.changePct}%`).join(', ') : 'no alert';
  return {
    zhCN: `市场价参考 poe.ninja 聚合快照；最近点变化 ${recentPoint}；${alerts.length ? '有预警' : '暂无预警'}。`,
    zhTW: `市場價參考 poe.ninja 聚合快照；最近點變化 ${recentPoint}；${alerts.length ? '有預警' : '暫無預警'}。`,
    en: `Market price from poe.ninja aggregate snapshot; recent-point change ${recentPoint}; ${alertText}.`
  };
}

function normalizeOfferEntry(offer, row, trend, minListingDepth, provider) {
  const alerts = alertFromTrend(trend, minListingDepth);
  const confidence = confidenceFor(row, trend, minListingDepth);
  const liquidity = Number.isFinite(Number(offer.liquidity)) ? Number(offer.liquidity) : liquidityFor(row, trend, minListingDepth);
  const risk = Number.isFinite(Number(offer.risk)) ? Number(offer.risk) : riskFor(trend, confidence, minListingDepth);
  const name = row.Text || row.item?.name || row.ApiId || offer.id;
  const depth = Math.max(0, Math.floor(Number(row.CurrentQuantity ?? trend.currentQuantity) || 0));
  return {
    id: offer.id || slug(row.ApiId || name || row.ItemId),
    category: offer.category || 'currency',
    name: offer.name || { zhCN: name, zhTW: name, en: name },
    goldCost: Number(offer.goldCost),
    cashCost: Number(offer.cashCost || 0),
    sellPrice: Number(trend.currentPrice),
    liquidity,
    risk,
    notes: localizeTrendNote(trend, alerts),
    marketRef: offer.marketRef,
    marketEvidence: {
      observedAt: trend.observedAt,
      buyListingCount: depth,
      sellListingCount: depth,
      priceConfidence: confidence,
      depthNote: `${provider} volume ${Number(depth.toFixed(2))}; ${trend.logs.length} trend points`
    },
    trend: {
      provider,
      league: '',
      currentPrice: Number(trend.currentPrice),
      currentQuantity: Number(trend.currentQuantity) || 0,
      oneHourChangePct: trend.oneHourChangePct === null ? null : Number(trend.oneHourChangePct.toFixed(2)),
      sixHourChangePct: trend.sixHourChangePct === null ? null : Number(trend.sixHourChangePct.toFixed(2)),
      dayChangePct: trend.dayChangePct === null ? null : Number(trend.dayChangePct.toFixed(2)),
      priceLogs: trend.logs.slice(0, 8),
      poeNinja: trend.poeNinja
    },
    alerts
  };
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
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function candidateProfitSummary(snapshot, limit = 5) {
  const feeRate = Number(snapshot.feeRate || 0);
  const goldUnit = Number(snapshot.goldUnit || 10000);
  return [...(snapshot.entries || [])]
    .map((entry) => {
      const sellPrice = Number(entry.sellPrice || 0);
      const cashCost = Number(entry.cashCost || 0);
      const goldCost = Number(entry.goldCost || 0);
      const fee = sellPrice * feeRate;
      const netProfit = sellPrice - cashCost - fee;
      const profitPerGoldUnit = goldCost > 0 ? netProfit / goldCost * goldUnit : 0;
      return {
        id: entry.id,
        name: entry.name?.en || entry.name?.zhCN || entry.id,
        sellPrice: Number(sellPrice.toFixed(4)),
        goldCost,
        cashCost: Number(cashCost.toFixed(4)),
        netProfit: Number(netProfit.toFixed(4)),
        profitPerGoldUnit: Number(profitPerGoldUnit.toFixed(4)),
        liquidity: entry.liquidity,
        risk: entry.risk,
        oneHourChangePct: entry.trend?.oneHourChangePct,
        alertCount: entry.alerts?.length || 0
      };
    })
    .sort((a, b) => b.profitPerGoldUnit - a.profitPerGoldUnit || b.netProfit - a.netProfit)
    .slice(0, limit);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.kind !== 'hideoutFlips') throw new Error('only --kind hideoutFlips is supported for hideout warrior offers');
  if (!Number.isInteger(args.minListingDepth) || args.minListingDepth <= 0) throw new Error('--min-listing-depth must be a positive integer');

  const seasonRoot = path.join(repoRoot, 'data', 'seasons', args.season);
  const manifest = await readJson(path.join(seasonRoot, 'manifest.json'));
  const offersFile = resolveSeasonFile(seasonRoot, args.offers);
  const offers = await readJson(offersFile);
  const entries = Array.isArray(offers.entries) ? offers.entries : [];
  if (!entries.length) throw new Error('offers file has no entries');

  const realm = 'poe2';
  const provider = normalizeKey(args.provider);
  const isPoeNinja = provider === 'poe.ninja' || provider === 'poeninja';
  const isPoe2Scout = provider === 'poe2scout';
  if (!isPoeNinja && !isPoe2Scout) throw new Error('--provider must be poe.ninja or poe2scout');
  const { league, discovered } = isPoeNinja ? discoverPoeNinjaLeague(args.league) : await discoverLeague(realm, args.league);
  const poeNinjaOverview = isPoeNinja ? await fetchPoeNinjaCurrencyOverview(league) : null;
  const marketIndex = isPoeNinja
    ? buildPoeNinjaMarketIndex(poeNinjaOverview)
    : buildMarketIndex([
      ...await fetchCurrencyPages(realm, league, 7),
      ...await fetchItems(realm, league).catch(() => [])
    ]);
  const fetchedAt = new Date().toISOString();
  const normalizedEntries = [];
  const missing = [];
  for (const offer of entries) {
    const row = findMarketRow(marketIndex, offer);
    if (!row) {
      missing.push(offer.id || offer.marketRef?.apiId || offer.marketRef?.text || 'unknown');
      continue;
    }
    const trend = isPoeNinja ? trendFromPoeNinja(row, poeNinjaOverview) : trendFromLogs(row);
    const normalized = normalizeOfferEntry(offer, row, trend, args.minListingDepth, isPoeNinja ? 'poe.ninja' : 'poe2scout');
    normalized.trend.league = league;
    normalizedEntries.push(normalized);
  }
  if (!normalizedEntries.length) throw new Error(`no offers matched ${isPoeNinja ? 'poe.ninja' : 'poe2scout'} market data; missing=${missing.join(',')}`);

  const key = slug(args.key || `hideout-warrior-${league}-${fetchedAt.slice(0, 13)}`);
  const rawSnapshot = {
    id: `${args.season}-hideout-warrior-${key}`,
    season: offers.season || manifest.label || args.season.toUpperCase(),
    versionId: offers.versionId || manifest.versionId,
    updatedAt: fetchedAt,
    currency: offers.currency || 'exalted',
    goldUnit: offers.goldUnit || 10000,
    feeRate: offers.feeRate ?? 0.08,
    source: {
      fetchedAt,
      note: `${isPoeNinja ? 'poe.ninja' : 'poe2scout'} ${league} prices joined with manual hideout warrior gold-cost offers.`,
      filters: {
        minListingDepth: args.minListingDepth,
        abnormalPriceRules: [
          `Use ${isPoeNinja ? 'poe.ninja Currency overview' : 'poe2scout aggregate current price'} instead of single listing price.`,
          'Flag short-window spikes separately from buy-now recommendations.',
          'Treat manual gold-cost input as player-provided data.'
        ]
      }
    },
    scoreWeights: offers.scoreWeights || { netProfit: 0.35, profitPerGoldUnit: 0.3, liquidity: 0.2, risk: -0.25 },
    entries: normalizedEntries
  };

  const tmpRawFile = path.join(repoRoot, '.tmp', `hideout-warrior-${process.pid}-${Date.now()}.json`);
  await writeJson(tmpRawFile, rawSnapshot);
  try {
    const normalizeArgs = [
      'scripts/normalize-market-snapshot.mjs',
      '--season', args.season,
      '--kind', args.kind,
      '--file', tmpRawFile,
      '--key', key,
      '--provider', isPoeNinja ? 'poe.ninja' : 'poe2scout',
      '--league', league,
      '--fetched-at', fetchedAt,
      '--min-listing-depth', String(args.minListingDepth),
      '--note', rawSnapshot.source.note
    ];
    if (args.write) normalizeArgs.push('--write');
    if (args.force) normalizeArgs.push('--force');
    const normalized = await runNodeScript(normalizeArgs[0], normalizeArgs.slice(1));
    const parsed = normalized.stdout ? JSON.parse(normalized.stdout) : {};
    const result = {
      mode: args.write ? 'write' : 'dry-run',
      season: args.season,
      kind: args.kind,
      provider: isPoeNinja ? 'poe.ninja' : 'poe2scout',
      league,
      leagueDiscovered: discovered,
      offersFile: path.relative(repoRoot, offersFile),
      matchedEntries: normalizedEntries.length,
      missingEntries: missing,
      topEntries: candidateProfitSummary(rawSnapshot),
      fetchedAt,
      outputFile: parsed.outputFile,
      validation: parsed.validation,
      candidateIndexUpdated: parsed.candidateIndexUpdated || false
    };
    console.log(JSON.stringify(result, null, 2));
    if (normalized.code !== 0) {
      if (normalized.stderr) console.error(normalized.stderr);
      process.exit(1);
    }
  } finally {
    await rm(tmpRawFile, { force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
