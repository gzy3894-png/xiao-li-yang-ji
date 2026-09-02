// 基金估值对账门禁：不落盘、不过门禁，就不准进入下一阶段。
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { getFundsData } from '../src/services/fundApi.js';
import { normalizeFundRows } from '../src/utils/calc.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CASES = [
  { code: '161725', expect: 'estimate' },
  { code: '001632', expect: 'estimate' },
  { code: '510300', expect: 'estimate' },
  { code: '159915', expect: 'estimate' },
  { code: '510880', expect: 'estimate' },
  { code: '000001', expect: 'estimate' },
  { code: '110022', expect: 'estimate' },
  { code: '005827', expect: 'estimate' },
  { code: '003096', expect: 'estimate' },
  { code: '010416', expect: 'estimate' },
  { code: '000198', expect: 'unsupported' },
  { code: '050025', expect: 'no-fake-qdii' },
  { code: '110003', expect: 'no-fake' },
  { code: '519736', expect: 'estimate-or-none' }
];

function nowName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function simplify(r) {
  return {
    code: r.FCODE,
    name: r.SHORTNAME,
    latestTradeDate: r.__latestTradeDate || '',
    phase: r.__phase || '',
    nav: r.NAV ?? null,
    navPct: r.NAVCHGRT ?? null,
    navDate: r.PDATE ?? null,
    estimateNav: r.GSZ ?? null,
    estimatePct: r.GSZZL ?? null,
    estimateAt: r.GZTIME ?? null,
    estimateSource: r.__estimateSource || 'none',
    rawEstimate: r.__estimateRaw || null
  };
}

const codes = CASES.map((x) => x.code);
const rows = await getFundsData(codes);
const rowsByCode = new Map(rows.map((r) => [r.FCODE, r]));
const normalized = normalizeFundRows(rows, []);
const normByCode = new Map(normalized.map((r) => [r.code, r]));

const failures = [];
const report = [];
for (const c of CASES) {
  const row = rowsByCode.get(c.code);
  const item = row ? simplify(row) : { code: c.code, missing: true };
  const n = normByCode.get(c.code);
  if (n && n.phase) item.phase = n.phase;
  const latestTradeDate = item.latestTradeDate || '';
  const navPublished = Boolean(n && n.hasReplace);

  if (!row) failures.push(`${c.code}: FundMNFInfo 没有返回`);
  if (c.expect === 'estimate') {
    const hasEstimate = item.estimateNav !== null && item.estimatePct !== null && ['tiantian', 'sina_ds3', 'sina_ds2'].includes(item.estimateSource);
    if (!hasEstimate) failures.push(`${c.code}: 预期有盘中估值，实际 source=${item.estimateSource} nav=${item.estimateNav} pct=${item.estimatePct}`);
  }
  if (c.expect === 'unsupported') {
    if (item.estimateNav !== null || item.estimatePct !== null) failures.push(`${c.code}: 货币/不支持基金被硬造估值 ${item.estimatePct}`);
  }
  if (c.expect === 'no-fake-qdii') {
    // QDII 净值滞后，不允许拿旧 NAV/NAVCHGRT 冒充今日；是否给估值只允许来源于明确的 tiantian/sina 且要打 low confidence 标签，当前直接禁止。
    if (item.navDate && latestTradeDate && item.navDate !== latestTradeDate && item.estimateSource === 'nav') failures.push(`${c.code}: QDII 被旧净值冒充`);
  }
  if (c.expect === 'no-fake') {
    if (item.navDate && latestTradeDate && item.navDate !== latestTradeDate && navPublished) failures.push(`${c.code}: PDATE<latestTradeDate 被误判为净值已公布`);
  }
  if (item.navDate && latestTradeDate && item.navDate !== latestTradeDate && navPublished) {
    failures.push(`${c.code}: NAV 公布状态机误判：PDATE=${item.navDate} latestTradeDate=${latestTradeDate}`);
  }
  report.push({ ...item, navPublished, expect: c.expect });
}

mkdirSync('qa/reports', { recursive: true });
const base = join('qa/reports', `estimate-${nowName()}`);
const doc = { generatedAt: new Date().toISOString(), failures, report };
writeFileSync(`${base}.json`, JSON.stringify(doc, null, 2));
writeFileSync('qa/reports/latest-estimate.json', JSON.stringify(doc, null, 2));
writeFileSync(`${base}.md`, ['# 基金估值门禁对账', '', '| code | name | source | estimatePct | estimateAt | navPct | navDate | latestTradeDate | phase |', '|---|---|---:|---:|---|---:|---|---|---|', ...report.map((r) => `| ${r.code} | ${r.name || ''} | ${r.estimateSource} | ${r.estimatePct ?? '--'} | ${r.estimateAt || '--'} | ${r.navPct ?? '--'} | ${r.navDate || '--'} | ${r.latestTradeDate || '--'} | ${r.phase || '--'} |`)].join('\n') + '\n');

for (const r of report) {
  console.log(`${r.code} ${r.name || ''} | source=${r.estimateSource} | est=${r.estimateNav ?? '--'}/${r.estimatePct ?? '--'}% @ ${r.estimateAt || '--'} | nav=${r.nav ?? '--'}/${r.navPct ?? '--'}%/${r.navDate || '--'} | latestTradeDate=${r.latestTradeDate || '--'} | phase=${r.phase || '--'}`);
}
if (failures.length) {
  console.error('\nFUND ORACLE FAILED');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nFUND ORACLE PASS');
