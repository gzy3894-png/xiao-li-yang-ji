<template>
  <div class="page">
    <div class="topbar row-between">
      <button class="btn" @click="$router.back()">← 返回</button>
      <div class="app-title">{{ quote.name || code }}</div>
      <div style="width:48px"></div>
    </div>

    <div class="card quote">
      <div class="row-between">
        <div>
          <div class="hint">估算净值<span v-if="estTime" class="hint">（{{ estTime }}）</span></div>
          <div class="q-val" :class="(estimatePct ?? quote.gszzl) >= 0 ? 'up' : 'down'">
            {{ estimateNav !== null ? estimateNav.toFixed(4) : quote.gsz !== null ? quote.gsz.toFixed(4) : '--' }}
          </div>
        </div>
        <div>
          <div class="hint">估算涨跌</div>
          <div class="q-val" :class="(estimatePct ?? quote.gszzl) >= 0 ? 'up' : 'down'">
            {{ fmtPct(estimatePct ?? quote.gszzl) }}
          </div>
        </div>
        <div>
          <div class="hint">最新净值({{ quote.jzrq }})</div>
          <div class="q-val">{{ quote.dwjz !== null ? quote.dwjz.toFixed(4) : '--' }}</div>
        </div>
      </div>
      <div class="hint" style="margin-top:6px">估算方式：{{ estimateWay }}</div>
    </div>

    <div class="card">
      <div class="sec-title">我的持仓</div>
      <div class="editor row-between">
        <div><span class="hint">份额</span><input class="input small" type="number" v-model="hold.num" /></div>
        <div><span class="hint">成本</span><input class="input small" type="number" v-model="hold.cost" /></div>
        <button class="btn btn-primary" @click="saveHold">保存</button>
      </div>
    </div>

    <div class="card">
      <div class="row-between" style="margin-bottom:6px">
        <div class="sec-title" style="margin-bottom:0">排行</div>
        <div class="seg">
          <button v-for="t in tabs" :key="t.key" class="btn mini" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        </div>
      </div>
      <div v-if="tab === 'rt' && isTradingTime()" class="hint" style="margin-bottom:6px">交易时段每 30 秒刷新并记录分时</div>
      <div v-if="tab === 'nav' || tab === 'yield'" class="range seg" style="margin-bottom:6px">
        <button v-for="r in ranges" :key="r.v" class="btn mini" :class="{ active: range === r.v }" @click="range = r.v; loadTrend()">{{ r.label }}</button>
      </div>
      <TrendChart v-if="trendOption" :option="trendOption" />
      <div v-else class="hint" style="padding:24px;text-align:center">
        {{ tab === 'rt' ? '等交易时段自动记录分时走势（先打开首页返回也行）' : '加载中...' }}
      </div>
    </div>

    <div class="card">
      <div class="sec-title">前十大持仓（实时涨跌）</div>
      <div v-if="!positions.length" class="hint">暂无持仓数据</div>
      <div v-for="(s, i) in positions" :key="s.GPDM" class="pos-row row-between">
        <div class="pos-left">
          <span class="pos-idx">{{ i + 1 }}</span>
          <span class="pos-name">{{ s.GPJC }}</span>
          <span class="hint">{{ s.GPDM }}</span>
        </div>
        <div class="pos-right">
          <span class="pos-w">占 {{ s.JZBL }}%</span>
          <span v-if="s.PCTNVCHG !== undefined && s.PCTNVCHG !== ''" class="hint">变动{{ s.PCTNVCHG }}%</span>
          <span class="pos-pct" :class="quotes[s.GPDM] && quotes[s.GPDM].pct >= 0 ? 'up' : 'down'">
            {{ quotes[s.GPDM] ? (quotes[s.GPDM].pct >= 0 ? '+' : '') + Number(quotes[s.GPDM].pct).toFixed(2) + '%' : '--' }}
          </span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">基金经理</div>
      <div v-for="(m, i) in managers" :key="i" class="row-between" style="margin-bottom:4px">
        <span>{{ m.MGRNAME }}</span>
        <span class="hint">{{ m.DAYS }} 天 · 任职收益 {{ m.PENAVGROWTH }}%</span>
      </div>
      <div v-if="!managers.length" class="hint">--</div>
    </div>

    <div class="card">
      <div class="sec-title">基本信息</div>
      <div class="kv" v-for="(item, i) in baseItems" :key="i">
        <span class="hint">{{ item[0] }}</span><span>{{ item[1] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useFundStore } from '../stores/fundStore';
import TrendChart from '../components/TrendChart.vue';
import { getFundsData, getValuationTrend, getYieldTrend, getNavTrend, getFundBaseInfo, getManagerList } from '../services/fundApi';
import { getPositionsCached, estimateFund } from '../services/estimate';
import { getStockQuotes, QUOTE_SOURCES } from '../services/quotes';
import { appendIntradayPoint, getIntradaySeries } from '../services/intraday';

const route = useRoute();
const store = useFundStore();
const code = route.params.code;

const quote = reactive({ name: '', jzrq: '', dwjz: null, gsz: null, gszzl: 0 });
const hold = reactive({ num: '', cost: '' });
const tab = ref('rt');
const range = ref('3y');
const trendOption = ref(null);
const positions = ref([]);
const managers = ref([]);
const base = ref({});
const quotes = ref({});
const estimatePct = ref(null);
const estimateNav = ref(null);
const estTime = ref('');
const quoteSrcUsed = ref('');
let pollTimer = null;

const tabs = [
  { key: 'rt', label: '实时' },
  { key: 'gz', label: '官估' },
  { key: 'nav', label: '净值' },
  { key: 'yield', label: '涨幅' }
];
const ranges = [
  { v: 'y', label: '月' },
  { v: '3y', label: '季' },
  { v: '6y', label: '半年' },
  { v: 'n', label: '年' },
  { v: '3n', label: '三年' },
  { v: '5n', label: '五年' }
];

const baseItems = computed(() => {
  const b = base.value || {};
  const map = [
    ['基金名称', b.SHORTNAME], ['基金类型', b.FTYPE], ['基金公司', b.JJGS], ['成立日期', b.ISSBDATE],
    ['单位净值', b.DWJZ], ['累计净值', b.LJJZ], ['净值日期', b.FSRQ],
    ['近1月', b.SYL_Y != null ? b.SYL_Y + '%' : null], ['近3月', b.SYL_3Y != null ? b.SYL_3Y + '%' : null],
    ['近6月', b.SYL_6Y != null ? b.SYL_6Y + '%' : null], ['近1年', b.SYL_1N != null ? b.SYL_1N + '%' : null],
    ['申购费率', b.RATE], ['申购状态', b.SGZT], ['赎回状态', b.SHZT], ['风险等级', b.RISKLEVEL]
  ];
  return map.filter(([, v]) => v !== undefined && v !== null && v !== '').slice(0, 16);
});

const estimateWay = computed(() => {
  if (quoteSrcUsed.value) return `持仓加权（${QUOTE_SOURCES[quoteSrcUsed.value]?.label || quoteSrcUsed.value}）· 覆盖率仅前十大`;
  return '天天基金官方估值';
});

function fmtPct(v) {
  if (v === null || v === undefined) return '--';
  const n = Number(v);
  if (Number.isNaN(n)) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function isTradingTime() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const min = d.getHours() * 60 + d.getMinutes();
  return (min >= 570 && min <= 900) || (min >= 780 && min <= 930) || (min >= 780 && min <= 930) || (min >= 930 && min <= 1200) || (min >= 780 && min <= 930);
}

function timeX() {
  const arr = [];
  for (let m = 30; m <= 59; m++) arr.push('9:' + String(m).padStart(2, '0'));
  for (let h = 10; h <= 11; h++) for (let m = 0; m <= 59; m++) arr.push(h + ':' + String(m).padStart(2, '0'));
  for (let h = 13; h <= 14; h++) for (let m = 0; m <= 59; m++) arr.push(h + ':' + String(m).padStart(2, '0'));
  arr.push('15:00');
  return arr;
}

function baseLineOption(x, series, unit) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map((s) => s.name), bottom: 0 },
    grid: { left: 44, right: 16, top: 24, bottom: 36 },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}' + unit } },
    series: series.map((s) => ({ name: s.name, type: 'line', data: s.data, smooth: true, showSymbol: false }))
  };
}

async function loadQuote() {
  try {
    const raw = await getFundsData([code]);
    if (raw && raw.length) {
      const v = raw[0];
      Object.assign(quote, {
        name: v.SHORTNAME, jzrq: v.PDATE,
        dwjz: v.NAV === null || v.NAV === undefined ? null : Number(v.NAV),
        gsz: v.GSZ === null || v.GSZ === undefined ? null : Number(v.GSZ),
        gszzl: v.GSZZL === null || v.GSZZL === undefined ? null : Number(v.GSZZL),
        gztime: v.GZTIME || ''
      });
      if (v.PDATE && v.PDATE !== '--' && v.GZTIME && v.PDATE === v.GZTIME.substr(0, 10)) {
        quote.gsz = Number(v.NAV); quote.gszzl = Number(v.NAVCHGRT);
      }
    }
  } catch { /* ignore */ }
}

async function loadRealtime() {
  try {
    const stocks = await getPositionsCached(code);
    if (!stocks.length) return;
    positions.value = stocks.slice(0, 10);
    const { quotes: qs, source } = await getStockQuotes(stocks, store.settings.estimateSource === 'tt' ? 'auto' : store.settings.estimateSource);
    if (qs) quotes.value = qs;
    quoteSrcUsed.value = source;
    const est = estimateFund(stocks, qs);
    if (est !== null && quote.dwjz !== null) {
      estimatePct.value = est.pct;
      estimateNav.value = Number((quote.dwjz * (1 + est.pct / 100)).toFixed(4));
      const d = new Date();
      estTime.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      if (isTradingTime()) appendIntradayPoint(code, est.pct);
      if (tab.value === 'rt') renderRealtimeChart();
    }
  } catch { /* ignore */ }
}

function renderRealtimeChart() {
  const series = getIntradaySeries(code);
  const label = series.map((x) => x[0]);
  const data = series.map((x) => x[1]);
  trendOption.value = baseLineOption(label.length ? label : ['暂无'], [{ name: '估值涨跌', data: data.length ? data : [] }], '%');
}

async function loadTrend() {
  trendOption.value = null;
  try {
    if (tab.value === 'rt') {
      renderRealtimeChart();
      return;
    }
    if (tab.value === 'gz') {
      const res = await getValuationTrend(code);
      const pts = (res.Datas || []).map((s) => Number(String(s).split(',')[2]));
      trendOption.value = baseLineOption(timeX(), [{ name: '估算涨跌', data: pts }], '%');
      return;
    }
    if (tab.value === 'nav') {
      const res = await getNavTrend(code, range.value);
      const list = res.Datas || [];
      trendOption.value = baseLineOption(list.map((x) => x.FSRQ), [
        { name: '单位净值', data: list.map((x) => Number(x.DWJZ)) },
        { name: '累计净值', data: list.map((x) => Number(x.LJJZ)) }
      ], '');
      return;
    }
    const res = await getYieldTrend(code, range.value);
    const list = res.Datas || [];
    trendOption.value = baseLineOption(list.map((x) => x.PDATE), [
      { name: '涨幅', data: list.map((x) => Number(x.YIELD)) },
      { name: (res.Expansion && res.Expansion.INDEXNAME) || '同类', data: list.map((x) => Number(x.INDEXYIED)) }
    ], '%');
  } catch {
    trendOption.value = baseLineOption([], []);
  }
}

async function loadInfo() {
  try {
    base.value = await getFundBaseInfo(code);
    managers.value = await getManagerList(code);
  } catch { /* ignore */ }
}

function switchTab(k) {
  tab.value = k;
  loadTrend();
}

function saveHold() {
  store.updateHold(code, { num: Number(hold.num) || 0, cost: Number(hold.cost) || 0 });
}

onMounted(() => {
  const w = store.watchList.find((x) => x.code === code);
  hold.num = w ? (w.num || '') : '';
  hold.cost = w && w.cost ? w.cost : '';
  loadQuote();
  loadRealtime();
  infoLoadGuard();
  loadInfo();
  loadTrend();
  if (isTradingTime()) {
    pollTimer = setInterval(() => { loadQuote(); loadRealtime(); }, 30 * 1000);
  }
});
function infoLoadGuard() { /* placeholder */ }
onBeforeUnmount(() => clearInterval(pollTimer));
</script>

<style scoped>
.app-title { font-size: 18px; font-weight: 700; }
.topbar { margin-bottom: 12px; }
.quote .q-val { font-size: 18px; font-weight: 700; margin-top: 4px; }
.sec-title { font-weight: 700; margin-bottom: 8px; }
.seg { display: flex; gap: 4px; flex-wrap: wrap; }
.btn.mini { padding: 4px 8px; font-size: 12px; }
.btn.mini.active { background: #2a6df4; color: #fff; }
.editor { gap: 8px; align-items: flex-end; }
.input.small { width: 90px; }
.pos-row { align-items: center; }
.pos-left { flex: 1; min-width: 0; }
.pos-name { font-weight: 600; margin-right: 4px; }
.pos-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.pos-w { font-size: 12px; color: #888; min-width: 52px; text-align: right; }
.pos-pct { min-width: 56px; text-align: right; font-weight: 600; }
.kv { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.kv:last-child { border-bottom: none; }
.range { margin-bottom: 4px; }
</style>
