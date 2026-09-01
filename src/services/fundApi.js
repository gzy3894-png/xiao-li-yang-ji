import { httpGetJson, httpGetText } from './http';

function deviceId() {
  let id = localStorage.getItem('xf_device_id');
  if (!id) {
    id = 'xf_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('xf_device_id', id);
  }
  return id;
}

function ts() {
  return Date.now();
}

export async function searchFunds(keyword) {
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=9&key=${encodeURIComponent(keyword)}&_=${ts()}`;
  const res = await httpGetJson(url);
  return (res.Datas || []).map((v) => ({ code: v.CODE, name: v.NAME }));
}

function toNum(v) {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

async function getIndexSingle(secid) {
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f169,f170&_=${ts()}`;
  const res = await httpGetJson(url);
  const d = (res && res.data) || {};
  return {
    f12: d.f57,
    f14: d.f58,
    f2: toNum(d.f43) !== null ? Number((toNum(d.f43) / 100).toFixed(2)) : null,
    f4: toNum(d.f169) !== null ? Number((toNum(d.f169) / 100).toFixed(2)) : null,
    f3: toNum(d.f170) !== null ? Number((toNum(d.f170) / 100).toFixed(2)) : null
  };
}

export async function getIndices(secids) {
  try {
    const list = await Promise.all(secids.map((secid) => getIndexSingle(secid)));
    const ok = list.filter((x) => x.f12);
    if (ok.length === secids.length) return ok;
    throw new Error('partial');
  } catch {
    return getIndicesTencent(secids);
  }
}

function secidToTencent(secid) {
  const idx = secid.indexOf('.');
  if (idx <= 0) return null;
  const mkt = secid.slice(0, idx);
  const code = secid.slice(idx + 1);
  if (mkt === '1') return 'sh' + code;
  if (mkt === '0') return 'sz' + code;
  return null;
}

async function getIndicesTencent(secids) {
  const pairs = secids.map((id) => ({ id, tc: secidToTencent(id) })).filter((x) => x.tc);
  if (!pairs.length) return [];
  const url = `https://qt.gtimg.cn/q=${pairs.map((p) => p.tc).join(',')}&_=${ts()}`;
  const text = await httpGetText(url, 'gbk');
  // 形如 v_sh000001="1~上证指数~000001~3979.88~..."; 每个变量一行
  const out = [];
  for (const p of pairs) {
    const m = text.match(new RegExp('v_' + p.tc + '=\"([^\"]*)"', 'm'));
    if (!m) continue;
    const f = m[1].split('~');
    if (f.length < 33) continue;
    out.push({
      f12: p.id.slice(p.id.indexOf('.') + 1),
      f14: f[1],
      f2: Number(f[3]),
      f4: Number(f[31]),
      f3: Number(f[32])
    });
  }
  return out;
}

export async function getFundsData(codes) {
  if (!codes.length) return [];
  const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=${deviceId()}&Fcodes=${codes.join(',')}`;
  const res = await httpGetJson(url);
  return res.Datas || [];
}

export async function getValuationTrend(code) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundVarietieValuationDetail.ashx?FCODE=${code}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  return httpGetJson(url);
}

export async function getYieldTrend(code, range) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundYieldDiagramNew.ashx?FCODE=${code}&RANGE=${range}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  return httpGetJson(url);
}

export async function getNavTrend(code, range) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundNetDiagram.ashx?FCODE=${code}&RANGE=${range}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  return httpGetJson(url);
}

export async function getFundBaseInfo(code) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundBaseTypeInformation.ashx?FCODE=${code}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  const res = await httpGetJson(url);
  return res.Datas || {};
}

export async function getManagerList(code) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundManagerList.ashx?FCODE=${code}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  const res = await httpGetJson(url);
  return res.Datas || [];
}

export async function getManagerDetail(code) {
  const url = `https://fundmobapi.eastmoney.com/FundMApi/FundMangerDetail.ashx?FCODE=${code}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  const res = await httpGetJson(url);
  return res.Datas || {};
}

export async function getPositions(code) {
  const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${code}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&_=${ts()}`;
  const res = await httpGetJson(url);
  const stocks = (res.Datas && res.Datas.fundStocks) || [];
  return { stocks, expansion: res.Expansion || {} };
}
