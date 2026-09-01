import { httpGetJson, httpGetText } from './http';

function toNum(v) {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// 行情源适配器：统一返回 { [code6位]: { name, price, pct } }
function codesFromStocks(stocks) {
  // EM 行情 secid 用的是 mkt.code 形式：1.600519 / 0.000001；腾讯源用 sh/sz/bj 前缀
  return stocks.map((s) => {
    const mkt = String(s.NEWTEXCH ?? '');
    const prefix = mkt === '1' ? 'sh' : (mkt === '0' ? 'sz' : (mkt === '2' ? 'bj' : 'sz'));
    return {
      code: s.GPDM,
      name: s.GPJC,
      emSecid: `${mkt || '0'}.${s.GPDM}`,
      tcCode: prefix + s.GPDM
    };
  });
}

// 东方财富：逐只拉（push2 stock/get 实测可用；一次拉一批（ulist）有时不稳定）
async function quotesEastMoney(stocks) {
  const items = codesFromStocks(stocks);
  const out = {};
  const results = await Promise.all(items.map(async (it) => {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${it.emSecid}&fields=f43,f169,f170,f57,f58&_=${Date.now()}`;
    try {
      const res = await httpGetJson(url);
      const d = res && res.data;
      if (!d || d.f43 == null) return null;
      return {
        code: d.f57 || it.code,
        name: d.f58 || it.name,
        price: toNum(d.f43) !== null ? toNum(d.f43) / 100 : null,
        pct: toNum(d.f170) !== null ? toNum(d.f170) / 100 : null
      };
    } catch {
      return null;
    }
  }));
  for (const r of results) if (r) out[r.code] = r;
  return out;
}

// 腾讯：批量拉（GBK），一个请求搞定
async function quotesTencent(stocks) {
  const items = codesFromStocks(stocks);
  const codes = items.map((it) => 'r_' + it.tcCode).join(',');
  const url = `https://qt.gtimg.cn/q=${codes}&_=${Date.now()}`;
  const text = await httpGetText(url, 'gbk');
  const out = {};
  for (const it of items) {
    const m = text.match(new RegExp('v_' + 'r_' + it.tcCode + '=\\"([^\\"]*)"', 'm'));
    if (!m) continue;
    const f = m[1].split('~');
    if (f.length < 33) continue;
    // v_r_sh600519: f[1] 名称, f[3] 现价, f[31] 涨跌额, f[32] 涨跌幅
    const pct = Number(f[32]);
    if (Number.isNaN(pct)) continue;
    out[it.code] = {
      code: it.code,
      name: f[1] || it.name,
      price: Number(f[3]),
      pct
    };
  }
  return out;
}

// 新浪：批量拉（GBK），需要 Referer；作为第三备用
async function quotesSina(stocks) {
  const items = codesFromStocks(stocks);
  const codes = items.map((it) => it.tcCode).join(',');
  const url = `https://hq.sinajs.cn/list=${codes}`;
  try {
    const text = await httpGetText(url, 'gbk', { headers: { Referer: 'https://finance.sina.com.cn' } });
    const out = {};
    for (const it of items) {
      const m = text.match(new RegExp('hq_str_' + it.tcCode + '=\\"([^\\"]*)"', 'm'));
      if (!m) continue;
      const f = m[1].split(',');
      if (f.length < 8) continue;
      const price = Number(f[3]);
      const yesterday = Number(f[2]);
      if (!price || !yesterday) continue;
      out[it.code] = {
        code: it.code,
        name: f[0],
        price,
        pct: Number((((price - yesterday) / yesterday) * 100).toFixed(2))
      };
    }
    return out;
  } catch {
    return {};
  }
}

export const QUOTE_SOURCES = {
  em: { label: '东方财富', fetch: quotesEastMoney, concurrent: false },
  tencent: { label: '腾讯行情', fetch: quotesTencent },
  sina: { label: '新浪行情', fetch: quotesSina }
};

const SOURCE_ALIAS = {
  tc: 'tencent',
  tencent: 'tencent',
  tt: 'auto',
  official: 'auto',
  auto: 'auto',
  em: 'em',
  sina: 'sina'
};

export async function getStockQuotes(stocks, source = 'auto') {
  if (stocks && stocks.length === 0) return { source: 'none', quotes: {} };
  const normalized = SOURCE_ALIAS[source] || 'auto';
  const order = normalized === 'auto' ? ['em', 'tencent', 'sina'] : [normalized];
  for (const src of order) {
    const adapter = QUOTE_SOURCES[src];
    if (!adapter || typeof adapter.fetch !== 'function') continue;
    try {
      const got = await adapter.fetch(stocks);
      const hit = Object.keys(got || {}).length;
      if (hit > 0) return { source: src, quotes: got };
    } catch {
      // 换下一个源
    }
  }
  return { source: 'none', quotes: {} };
}
