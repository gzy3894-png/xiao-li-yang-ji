import { httpGetJson } from './http';

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

export async function getIndices(secids) {
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f13,f14&secids=${secids.join(',')}&_=${ts()}`;
  const res = await httpGetJson(url);
  return (res.data && res.data.diff) || [];
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
  const gpList = stocks.map((s) => `${s.NEWTEXCH}.${s.GPDM}`).join(',');
  const gpUrl = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f1,f2,f3,f4,f12,f13,f14&fltt=2&secids=${gpList}&deviceid=Wap&plat=Wap&product=EFund&version=2.0.0&Uid=`;
  const gpRes = await httpGetJson(gpUrl);
  return { stocks, quotes: (gpRes.data && gpRes.data.diff) || [], expansion: res.Expansion || {} };
}
