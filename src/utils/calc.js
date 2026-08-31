// 基金收益计算（与 x2rr/funds 逻辑保持一致）
export function normalizeFundRows(rawFundList, watchList) {
  const rows = [];
  for (const val of rawFundList) {
    const held = watchList.find((w) => w.code === val.FCODE) || { num: 0, cost: 0 };
    let gsz = Number(val.GSZ);
    let gszzl = Number(val.GSZZL);
    let hasReplace = false;
    // 当天实际净值已公布：用实际净值/涨幅替代估值
    if (val.PDATE && val.PDATE !== '--' && val.GZTIME && val.PDATE === val.GZTIME.substr(0, 10)) {
      gsz = Number(val.NAV);
      gszzl = Number(val.NAVCHGRT);
      hasReplace = true;
    }
    const dwjz = Number(val.NAV);
    const num = Number(held.num) || 0;
    const cost = Number(held.cost) || 0;

    const row = {
      code: val.FCODE,
      name: val.SHORTNAME,
      jzrq: val.PDATE,
      dwjz: Number.isNaN(dwjz) ? null : dwjz,
      gsz: Number.isNaN(gsz) ? null : gsz,
      gszzl: Number.isNaN(gszzl) ? 0 : gszzl,
      gztime: val.GZTIME || '',
      hasReplace,
      num,
      cost
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
  const n = Number(row.dwjz);
  if (Number.isNaN(n) || !Number.isFinite(n)) return Number((0).toFixed(2));
  return Number((n * (Number(row.num) || 0)).toFixed(2));
}

// 当日估算收益
export function calcTodayGains(row) {
  const num = Number(row.num) || 0;
  const dwjz = Number(row.dwjz);
  if (row.hasReplace) {
    const rate = Number(row.gszzl) || 0;
    return Number(((dwjz - dwjz / (1 + rate * 0.01)) * num).toFixed(2));
  }
  const gsz = Number(row.gsz);
  if (Number.isNaN(gsz) || Number.isNaN(dwjz)) return Number((0).toFixed(2));
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
