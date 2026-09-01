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
    let gsz = toNum(val.GSZ);
    let gszzl = toNum(val.GSZZL);
    const gztime = val.GZTIME || '';
    let hasReplace = false;

    // 情况1：接口的估值时间与最新净值日期一致 => 当日净值已公布，用实际净值/涨幅
    if (gztime && val.PDATE && val.PDATE !== '--' && val.PDATE === gztime.substr(0, 10)) {
      hasReplace = true;
    }

    // 情况2：收盘后接口把 GSZ/GSZZL 置为 null => 用实际净值与涨幅展示
    if (!hasReplace && (gsz === null || gszzl === null) && nav !== null && navChg !== null) {
      hasReplace = true;
    }

    if (hasReplace) {
      gsz = nav;
      gszzl = navChg;
    }

    const num = toNum(held.num) || 0;
    const cost = toNum(held.cost) || 0;

    const row = {
      code: val.FCODE,
      name: val.SHORTNAME,
      jzrq: val.PDATE,
      dwjz: nav,
      gsz,
      gszzl,
      gztime,
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
  const nav = Number(row.dwjz);
  if (Number.isNaN(nav) || !Number.isFinite(nav)) return Number((0).toFixed(2));
  return Number((nav * (Number(row.num) || 0)).toFixed(2));
}

// 当日估算收益
export function calcTodayGains(row) {
  const num = Number(row.num) || 0;
  const dwjz = Number(row.dwjz);
  if (Number.isNaN(dwjz)) return Number((0).toFixed(2));
  if (row.hasReplace) {
    const rate = Number(row.gszzl) || 0;
    return Number(((dwjz - dwjz / (1 + rate * 0.01)) * num).toFixed(2));
  }
  const gsz = Number(row.gsz);
  if (Number.isNaN(gsz)) return Number((0).toFixed(2));
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
