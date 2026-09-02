import { httpGetJson, httpGetText } from './http';

const FV_ENDPOINTS = [
  'https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast',
  'https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast'
];
const FV_FIELDS = 'FCODE,SHORTNAME,GSZ,GSZZL,GZTIME,NAV,PDATE,NAVCHGRT';
const FV_BATCH = 50;
const SINA_HEADERS = { Referer: 'https://finance.sina.com.cn' };

function toNum(v) {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalizeDate(yyyymmdd) {
  const s = String(yyyymmdd || '');
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s.slice(0, 10) || '';
}

function normalizeGztime(gztime, pdate) {
  const s = String(gztime || '');
  if (!s) return '';
  if (s.length <= 8 && /\d{1,2}:\d{2}/.test(s)) return `${pdate} ${s.slice(0, 5)}`;
  if (s.indexOf('-') === -1 && /^\d{8}/.test(s)) {
    const d = normalizeDate(s.slice(0, 8));
    const t = s.length > 9 ? s.slice(9, 14) : s.slice(8, 13);
    return `${d} ${t}`;
  }
  return s.slice(0, 16);
}

function compactNum(v) {
  const n = toNum(v);
  return n === null ? null : Number(n.toFixed(6));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }));
  return out;
}

export function extractLatestTradeDate(expansion, rows) {
  const fromExpansion = normalizeDate(expansion && (expansion.GZTIME || expansion.FSRQ));
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromExpansion)) return fromExpansion;
  let max = '';
  for (const row of rows || []) {
    const a = normalizeDate(row && (row.GZTIME || row.PDATE || row.FSRQ));
    if (a && a > max) max = a;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(max) ? max : normalizeDate(new Date());
}

export function dateDiffDays(a, b) {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.round((da - db) / 86400000);
}

export function sessionPhase(now = new Date()) {
  const day = now.getDay();
  if (day === 0 || day === 6) return 'OFF';
  const min = now.getHours() * 60 + now.getMinutes();
  if (min >= 570 && min <= 690) return 'TRADING';
  if (min > 690 && min < 780) return 'BREAK';
  if (min >= 780 && min <= 905) return 'TRADING';
  return 'OFF';
}

export async function fetchFundValuationLast(codes) {
  const list = (codes || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!list.length) return new Map();
  const params = new URLSearchParams({ FCODES: list.join(','), FIELDS: FV_FIELDS });
  const out = new Map();

  for (const endpoint of FV_ENDPOINTS) {
    try {
      const chunks = chunk(list, FV_BATCH);
      await Promise.all(chunks.map(async (group) => {
        const p = new URLSearchParams({ FCODES: group.join(','), FIELDS: FV_FIELDS });
        const json = await httpGetJson(`${endpoint}?${p.toString()}`);
        const data = Array.isArray(json) ? json : (json.data || json.Datas || json.Data || []);
        for (const item of data || []) {
          const code = String(item.FCODE || '').trim();
          if (!code) continue;
          const pdate = normalizeDate(item.PDATE);
          out.set(code, {
            code,
            name: item.SHORTNAME || '',
            nav: toNum(item.NAV),
            navPct: toNum(item.NAVCHGRT),
            navDate: pdate,
            estimateNav: toNum(item.GSZ),
            estimatePct: toNum(item.GSZZL),
            estimateAt: normalizeGztime(item.GZTIME, pdate),
            raw: item
          });
        }
      }));
      if (out.size) return out;
    } catch { /* 换备用域名 */ }
  }
  return out;
}

export function pickSinaEstimatePoint(networth) {
  if (!Array.isArray(networth) || !networth.length) return null;
  const last = networth[networth.length - 1];
  if (!last || String(last.symbol || '') === '') return null;
  const ds3 = { nav: toNum(last.pre_nav2), pct: toNum(last.growthrate2) === null ? null : toNum(last.growthrate2) * 100, source: 'sina_ds3' };
  const ds2 = { nav: toNum(last.pre_nav), pct: toNum(last.growthrate) === null ? null : toNum(last.growthrate) * 100, source: 'sina_ds2' };
  const chosen = ds3.nav !== null && ds3.pct !== null ? ds3 : (ds2.nav !== null && ds2.pct !== null ? ds2 : null);
  if (!chosen) return null;
  const date = normalizeDate(last.pre_date);
  const time = String(last.min_time || '').slice(0, 8);
  return {
    ...chosen,
    estimateAt: date && time ? `${date} ${time.slice(0, 5)}` : (date || ''),
    last,
    networth
  };
}

export async function fetchSinaEstimate(code) {
  const c = String(code || '').trim();
  if (!/^\d{6}$/.test(c)) return null;
  const url = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol=${c}`;
  try {
    const text = await httpGetText(url, 'utf-8', { headers: SINA_HEADERS });
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const m = String(text).match(/^[^(]+\((.*)\)\s*;?\s*$/s);
      json = m ? JSON.parse(m[1]) : null;
    }
    const data = json && json.result && json.result.data;
    if (!data) return null;
    const picked = pickSinaEstimatePoint(data.networth);
    if (!picked || String(data?.networth?.[data.networth.length - 1]?.symbol || c) !== c) return null;
    return {
      code: c,
      estimateNav: compactNum(picked.nav),
      estimatePct: compactNum(picked.pct),
      estimateAt: picked.estimateAt,
      source: picked.source,
      last: picked.last,
      networth: picked.networth
    };
  } catch {
    return null;
  }
}

function looksQdiiOrOverseas(name) {
  return /(QDII|纳斯达克|标普|道琼斯|日经|德国|法国|印度|越南|全球|海外|美元|港股|恒生|H股)/i.test(String(name || ''));
}

function shouldTrySina(row, latestTradeDate, now) {
  if (!row || !row.FCODE) return false;
  if (toNum(row.GSZ) !== null || toNum(row.GSZZL) !== null) return false;
  const pdate = normalizeDate(row.PDATE || row.FSRQ);
  if (!pdate || !latestTradeDate) return sessionPhase(now) === 'TRADING';
  if (pdate === latestTradeDate && toNum(row.NAVCHGRT) !== null) return false;
  if (pdate === latestTradeDate) return false;
  const lag = dateDiffDays(latestTradeDate, pdate);
  if (lag > 1 && looksQdiiOrOverseas(row.SHORTNAME || row.name)) return false;
  return true;
}

export async function enrichFundDatas(rows, expansion, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];
  const now = opts.now || new Date();
  const latestTradeDate = extractLatestTradeDate(expansion, list);
  const codes = list.map((r) => r.FCODE).filter(Boolean);
  const tt = await fetchFundValuationLast(codes);

  for (const row of list) {
    row.__latestTradeDate = latestTradeDate;
    row.__phase = sessionPhase(now);
    const f = tt.get(row.FCODE);
    if (f && f.estimateNav !== null && f.estimatePct !== null && f.estimateAt) {
      row.GSZ = f.estimateNav;
      row.GSZZL = f.estimatePct;
      row.GZTIME = f.estimateAt;
      row.__estimateSource = 'tiantian';
      row.__estimateRaw = f.raw;
    }
  }

  const missing = list.filter((row) => toNum(row.GSZ) === null && toNum(row.GSZZL) === null && shouldTrySina(row, latestTradeDate, now));
  const sinaList = await mapLimit(missing, 4, async (row) => ({ code: row.FCODE, value: await fetchSinaEstimate(row.FCODE) }));
  for (const item of sinaList) {
    if (!item.value) continue;
    const row = list.find((x) => x.FCODE === item.code);
    if (!row || toNum(row.GSZ) !== null) continue;
    row.GSZ = item.value.estimateNav;
    row.GSZZL = item.value.estimatePct;
    row.GZTIME = item.value.estimateAt;
    row.__estimateSource = item.value.source;
    row.__estimateRaw = item.value.last;
    row.__estimateSeries = item.value.networth;
  }
  for (const row of list) {
    if (!row.__estimateSource) {
      row.__estimateSource = (toNum(row.GSZ) !== null && toNum(row.GSZZL) !== null) ? 'tiantian' : 'none';
    }
  }
  return list;
}
