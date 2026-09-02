// 基金收益计算（与 x2rr/funds 逻辑保持一致，并修复收盘后 GSZ=null 的情况）

function toNum(v) {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function normalizeFundRows(rawFundList, watchList) {
  const rows = [];
  for (const val of rawFundList) {
    const held = watchList.find((w) => w.code === val.FCODE) || { num: 0, cost: 0 };
    const nav = toNum(val.NAV);
    const navChg = toNum(val.NAVCHGRT);
    const gsz = toNum(val.GSZ);
    const gszzl = toNum(val.GSZZL);
    const gztime = val.GZTIME || '';
    const latestTradeDate = val.__latestTradeDate || '';
    // 只有最新净值日期等于当前交易日时，才算净值已公布；GSZ null 不代表净值公布。
    const hasReplace = Boolean(latestTradeDate && val.PDATE && val.PDATE !== '--' && val.PDATE === latestTradeDate && nav !== null && navChg !== null);

    const num = toNum(held.num) || 0;
    const cost = toNum(held.cost) || 0;

    const row = {
      code: val.FCODE,
      name: val.SHORTNAME,
      jzrq: val.PDATE,
      latestTradeDate,
      phase: hasReplace ? 'NAV_PUBLISHED' : (String(val.__phase || '') === 'TRADING' ? 'TRADING' : (String(val.__phase || '') === 'BREAK' ? 'BREAK' : (latestTradeDate && val.PDATE && val.PDATE !== latestTradeDate ? 'WAIT_NAV' : 'OFF'))),
      dwjz: nav,
      gsz,
      gszzl,
      gztime,
      hasReplace,
      num,
      cost,
      estimateSource: hasReplace ? 'nav' : (val.__estimateSource || (gsz !== null && gszzl !== null ? 'tiantian' : 'none')),
      estimateKind: hasReplace ? 'nav' : (gsz !== null && gszzl !== null ? (val.__estimateSource === 'tiantian' ? 'official' : 'sina') : 'none')
    };
    row.amount = calcMarketValue(row);
    row.gains = calcTodayGains(row);
    row.costGains = calcCostGains(row);
    row.costGainsRate = calcCostGainsRate(row);
    rows.push(row);
  }
  return rows;
}

// 持有市值 = 单位净值 * 份额
export function calcMarketValue(row) {
  const nav = Number(row.dwjz);
  if (Number.isNaN(nav) || !Number.isFinite(nav)) return Number((0).toFixed(2));
  return Number((nav * (Number(row.num) || 0)).toFixed(2));
}

// 当日估算收益。无估值时返回 null（前端显示 --），而不是误显示 0。
export function calcTodayGains(row) {
  const num = Number(row.num) || 0;
  const dwjz = Number(row.dwjz);
  if (!Number.isFinite(dwjz)) return null;
  if (row.hasReplace) {
    const rate = Number(row.gszzl);
    if (!Number.isFinite(rate)) return null;
    return Number(((dwjz - dwjz / (1 + rate * 0.01)) * num).toFixed(2));
  }
  const gsz = Number(row.gsz);
  if (!Number.isFinite(gsz)) return null;
  return Number(((gsz - dwjz) * num).toFixed(2));
}

// 持有收益 = (单位净值 - 成本价) * 份额
export function calcCostGains(row) {
  const cost = Number(row.cost);
  if (!cost) return Number((0).toFixed(2));
  const dwjz = Number(row.dwjz);
  if (Number.isNaN(dwjz)) return Number((0).toFixed(2));
  return Number(((dwjz - cost) * (Number(row.num) || 0)).toFixed(2));
}

// 持有收益率
export function calcCostGainsRate(row) {
  const cost = Number(row.cost);
  if (!cost) return Number((0).toFixed(2));
  const dwjz = Number(row.dwjz);
  if (Number.isNaN(dwjz)) return Number((0).toFixed(2));
  return Number((((dwjz - cost) / cost) * 100).toFixed(2));
}
