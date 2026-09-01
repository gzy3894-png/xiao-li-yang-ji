// 交易时段内的本地分时记录（代码按自然日重置）
function todayKey(code) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `xf_intraday_${ymd}_${code}`;
}

export function appendIntradayPoint(code, pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return [];
  const key = todayKey(code);
  const d = new Date();
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  // 同一分钟只保留最新值
  const last = list[list.length - 1];
  if (last && last[0] === t) {
    list[list.length - 1] = [t, Number(pct)];
  } else {
    list.push([t, Number(pct)]);
  }
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* storage full, ignore */ }
  return list;
}

export function getIntradaySeries(code) {
  try {
    return JSON.parse(localStorage.getItem(todayKey(code)) || '[]');
  } catch {
    return [];
  }
}
