import { getPositions } from './fundApi';

// 盘中估值缓存（持仓按天缓存，行情实时）
const POS_CACHE = 'xf_positions_';

function today() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function cacheKey(code) {
  return POS_CACHE + today() + '_' + code;
}

export async function getPositionsCached(code) {
  const key = cacheKey(code);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { stocks, at } = JSON.parse(raw);
      if (Array.isArray(stocks)) return stocks;
    }
  } catch { /* ignore */ }
  const res = await getPositions(code);
  const stocks = res.stocks || [];
  try {
    localStorage.setItem(key, JSON.stringify({ stocks, at: Date.now() }));
  } catch { /* ignore */ }
  return stocks;
}

// 加权估值 = Σ(持仓权重 × 个股涨幅) / Σ(持仓权重)
export function estimateFund(stocks, quotes) {
  let weighted = 0;
  let weightSum = 0;
  let hit = 0;
  for (const s of stocks || []) {
    const w = Number(s.JZBL);
    if (!Number.isFinite(w) || w <= 0) continue;
    const q = quotes[s.GPDM];
    if (!q || !Number.isFinite(q.pct)) continue;
    weighted += w * q.pct;
    weightSum += w;
    hit += 1;
  }
  if (weightSum <= 0 || hit === 0) return null;
  return {
    pct: Number((weighted / weightSum).toFixed(4)),
    coverage: Number((weightSum).toFixed(2)),
    hit
  };
}
