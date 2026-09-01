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

// 盘中持仓加权估值：JZBL 表示个股占基金净值的比例（%），
// 因此基金涨幅 ≈ Σ(持仓权重 × 个股涨幅) / 100。未命中的持仓按 0 处理。
// coverage = 披露持仓的总权重（前十大通常 40-70%），hitCoverage = 拿到行情的权重。
export function estimateFund(stocks, quotes) {
  let weighted = 0;
  let weightAll = 0;
  let weightHit = 0;
  let hit = 0;
  for (const s of stocks || []) {
    const w = Number(s.JZBL);
    if (!Number.isFinite(w) || w <= 0) continue;
    weightAll += w;
    const q = quotes ? quotes[s.GPDM] : null;
    if (!q || !Number.isFinite(q.pct)) continue;
    weighted += w * q.pct;
    weightHit += w;
    hit += 1;
  }
  if (weightAll <= 0 || hit === 0) return null;
  return {
    pct: Number((weighted / 100).toFixed(4)),
    coverage: Number(weightAll.toFixed(2)),
    hitCoverage: Number(weightHit.toFixed(2)),
    hit
  };
}
