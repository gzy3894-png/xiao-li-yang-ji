// 联网验证数据层与计算逻辑（不打 Android 包前的冒烟测试）
// 用法：npm run verify
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { searchFunds, getIndices, getFundsData, getFundBaseInfo, getManagerList, getPositions, getValuationTrend, getYieldTrend, getNavTrend } from '../src/services/fundApi.js';
import { normalizeFundRows } from '../src/utils/calc.js';
import { getPositionsCached, estimateFund } from '../src/services/estimate.js';
import { getStockQuotes } from '../src/services/quotes.js';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' ' + detail : ''}`);
}

async function main() {
  try {
    const s = await searchFunds('易方达消费');
    record('searchFunds', s.some((x) => x.code === '110022'), `first=${s[0] && s[0].name}`);

    const idx = await getIndices(['1.000001', '0.399001']);
    record('getIndices', idx.length >= 2 && idx.every((x) => x.f14 && x.f2 !== null), JSON.stringify(idx.slice(0, 2).map((x) => `${x.f14}:${x.f2}/${x.f3}%`)));

    const raw = await getFundsData(['110022']);
    record('getFundsData', raw.length === 1 && raw[0].FCODE === '110022', `NAV=${raw[0] && raw[0].NAV}`);
    const rows = normalizeFundRows(raw, [{ code: '110022', name: '易方达消费行业股票', num: 1000, cost: 3.0 }]);
    const r = rows[0];
    record('normalize+calc', !!(r && r.dwjz !== null && r.gszzl !== null), r ? JSON.stringify({ dwjz: r.dwjz, gsz: r.gsz, gszzl: r.gszzl, hasReplace: r.hasReplace, amount: r.amount, gains: r.gains }) : '');

    const info = await getFundBaseInfo('110022');
    record('getFundBaseInfo', info && info.SHORTNAME === '易方达消费行业股票', info.SHORTNAME);

    const mgr = await getManagerList('110022');
    record('getManagerList', Array.isArray(mgr) && mgr.length > 0, `count=${mgr.length}`);

    const pos = await getPositions('110022');
    record('getPositions', Array.isArray(pos.stocks) && pos.stocks.length > 0 && pos.stocks.every((x) => typeof x.JZBL !== 'undefined'), `count=${pos.stocks.length}`);

    const vt = await getValuationTrend('110022');
    record('getValuationTrend contract', !!vt && Object.prototype.hasOwnProperty.call(vt, 'Datas'), `Datas=${vt && vt.Datas}`);

    const yt = await getYieldTrend('110022', 'y');
    record('getYieldTrend', Array.isArray(yt.Datas) && yt.Datas.length > 0, `count=${yt.Datas && yt.Datas.length}`);

    const nt = await getNavTrend('110022', 'y');
    record('getNavTrend', Array.isArray(nt.Datas) && nt.Datas.length > 0, `count=${nt.Datas && nt.Datas.length}`);

    // 持仓加权估值。需要持仓列表 + 行情源（默认 auto：东财失败自动切腾讯）
    const stocks = await getPositionsCached('110022');
    const { quotes, source } = await getStockQuotes(stocks, 'auto');
    const est = estimateFund(stocks, quotes);
    record('持仓加权估值', !!(est && est.pct !== null && est.pct !== undefined), `估值=${est && est.pct}% 源=${source} 覆盖率=${est && est.coverage}%`);
  } catch (e) {
    record('main', false, `${e && e.stack || e}`);
  }

  const failed = results.filter((x) => !x.ok);
  console.log('\n' + (failed.length ? `${failed.length} 项失败` : '全部通过'));
  process.exit(failed.length ? 1 : 0);
}

main();
