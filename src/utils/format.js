export function formatMoney(value, digits = 2) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '--';
  return n.toFixed(digits);
}

export function formatPct(value, digits = 2) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';
}

export function formatBig(value) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + '万亿';
  if (abs >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return (n / 1e4).toFixed(2) + '万';
  return n.toFixed(2);
}

export function signed(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return n >= 0 ? 'up' : 'down';
}
