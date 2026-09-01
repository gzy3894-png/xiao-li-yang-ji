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
          <div class="hint">估算净值</div>
          <div class="q-val" :class="quote.gszzl >= 0 ? 'up' : 'down'">{{ quote.gsz !== null ? quote.gsz.toFixed(4) : '--' }}</div>
        </div>
        <div>
          <div class="hint">估算涨跌</div>
          <div class="q-val" :class="quote.gszzl >= 0 ? 'up' : 'down'">{{ pct(quote.gszzl) }}</div>
        </div>
        <div>
          <div class="hint">最新净值({{ quote.jzrq }})</div>
          <div class="q-val">{{ quote.dwjz !== null ? quote.dwjz.toFixed(4) : '--' }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">我的持仓</div>
      <div class="editor row-between">
        <div>
          <span class="hint">份额</span>
          <input class="input small" type="number" v-model="hold.num" />
        </div>
        <div>
          <span class="hint">成本</span>
          <input class="input small" type="number" v-model="hold.cost" />
        </div>
        <button class="btn btn-primary" @click="saveHold">保存</button>
      </div>
    </div>

    <div class="card">
      <div class="row-between">
        <div class="sec-title">走势</div>
        <div class="seg">
          <button v-for="t in tabs" :key="t.key" class="btn mini" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        </div>
      </div>
      <div v-if="tab !== 'gz'" class="range seg" style="margin-bottom:6px">
        <button v-for="r in ranges" :key="r.v" class="btn mini" :class="{ active: range === r.v }" @click="range = r.v; loadTrend()">{{ r.label }}</button>
      </div>
      <TrendChart v-if="trendOption" :option="trendOption" />
      <div v-else class="hint" style="padding:20px;text-align:center">趋势加载中...</div>
    </div>

    <div class="card">
      <div class="sec-title">前十大持仓</div>
      <div v-if="!positions.length" class="hint">暂无持仓数据（季报未更新或接口异常）</div>
      <div v-for="(s, i) in positions" :key="i" class="pos-row row-between">
        <div>
          <span class="pos-idx">{{ i + 1 }}</span>
          {{ s.GPJC }} <span class="hint">{{ s.GPDM }}</span>
        </div>
        <div style="display:flex;gap:10px">
          <span>{{ s.PCTNVCHG }}%</span>
          <span class="hint">占净值 {{ s.JZBL }}%</span>
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
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFundStore } from '../stores/fundStore';
import TrendChart from '../components/TrendChart.vue';
import { getFundsData, getValuationTrend, getYieldTrend, getNavTrend, getFundBaseInfo, getManagerList, getPositions } from '../services/fundApi';

const route = useRoute();
const store = useFundStore();
const code = route.params.code;

const quote = reactive({ name: '', jzrq: '', dwjz: null, gsz: null, gszzl: 0 });
const hold = reactive({ num: '', cost: '' });
const tab = ref('gz');
const range = ref('3y');
const trendOption = ref(null);
const positions = ref([]);
const managers = ref([]);
const base = ref({});

const tabs = [
  { key: 'gz', label: '估值' },
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
    ['基金名称', b.SHORTNAME],
    ['基金类型', b.FTYPE],
    ['基金公司', b.JJGS],
    ['成立日期', b.ISSBDATE],
    ['单位净值', b.DWJZ],
    ['累计净值', b.LJJZ],
    ['净值日期', b.FSRQ],
    ['近1月', b.SYL_Y != null ? b.SYL_Y + '%' : null],
    ['近3月', b.SYL_3Y != null ? b.SYL_3Y + '%' : null],
    ['近6月', b.SYL_6Y != null ? b.SYL_6Y + '%' : null],
    ['近1年', b.SYL_1N != null ? b.SYL_1N + '%' : null],
    ['申购费率', b.RATE],
    ['申购状态', b.SGZT],
    ['赎回状态', b.SHZT],
    ['风险等级', b.RISKLEVEL]
  ];
  return map.filter(([, v]) => v !== undefined && v !== null && v !== '').slice(0, 16);
});

const timeX = buildTimeAxis();

function buildTimeAxis() {
  const arr = [];
  for (let m = 30; m <= 59; m++) arr.push('9:' + String(m).padStart(2, '0'));
  for (let h = 10; h <= 11; h++) for (let m = 0; m <= 59; m++) arr.push(h + ':' + String(m).padStart(2, '0'));
  for (let h = 13; h <= 14; h++) for (let m = 0; m <= 59; m++) arr.push(h + ':' + String(m).padStart(2, '0'));
  arr.push('15:00');
  return arr;
}

function pct(v) {
  const n = Number(v);
  if (v === null || v === undefined || Number.isNaN(n)) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function baseLineOption(x, series, unit) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map((s) => s.name), bottom: 0 },
    grid: { left: 44, right: 16, top: 20, bottom: 36 },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}' + unit } },
    series: series.map((s) => ({ name: s.name, type: 'line', data: s.data, smooth: true }))
  };
}

async function loadQuote() {
  try {
    const raw = await getFundsData([code]);
    if (raw && raw.length) {
      const v = raw[0];
      Object.assign(quote, {
        name: v.SHORTNAME,
        jzrq: v.PDATE,
        dwjz: Number(v.NAV),
        gsz: Number(v.GSZ),
        gszzl: Number(v.GSZZL)
      });
      if (v.PDATE && v.PDATE !== '--' && v.GZTIME && v.PDATE === v.GZTIME.substr(0, 10)) {
        quote.gsz = Number(v.NAV);
        quote.gszzl = Number(v.NAVCHGRT);
      }
      const w = store.watchList.find((x) => x.code === code);
      hold.num = w ? w.num : '';
      hold.cost = w && w.cost ? w.cost : '';
    }
  } catch {}
}

async function loadTrend() {
  trendOption.value = null;
  try {
    if (tab.value === 'gz') {
      const res = await getValuationTrend(code);
      const pts = (res.Datas || []).map((s) => Number(String(s).split(',')[2]));
      trendOption.value = baseLineOption(timeX, [{ name: '估算涨跌', data: pts }], '%');
    } else if (tab.value === 'nav') {
      const res = await getNavTrend(code, range.value);
      const list = res.Datas || [];
      trendOption.value = baseLineOption(
        list.map((x) => x.FSRQ),
        [
          { name: '单位净值', data: list.map((x) => Number(x.DWJZ)) },
          { name: '累计净值', data: list.map((x) => Number(x.LJJZ)) }
        ],
        ''
      );
    } else {
      const res = await getYieldTrend(code, range.value);
      const list = res.Datas || [];
      trendOption.value = baseLineOption(
        list.map((x) => x.PDATE),
        [
          { name: '涨幅', data: list.map((x) => Number(x.YIELD)) },
          { name: (res.Expansion && res.Expansion.INDEXNAME) || '同类', data: list.map((x) => Number(x.INDEXYIED)) }
        ],
        '%'
      );
    }
  } catch {
    trendOption.value = baseLineOption([], []);
  }
}

async function loadPositions() {
  try {
    const res = await getPositions(code);
    positions.value = res.stocks.slice(0, 10);
  } catch {
    positions.value = [];
  }
}

async function loadInfo() {
  try {
    base.value = await getFundBaseInfo(code);
    managers.value = await getManagerList(code);
  } catch {}
}

function switchTab(k) {
  tab.value = k;
  loadTrend();
}

function saveHold() {
  store.updateHold(code, { num: Number(hold.num) || 0, cost: Number(hold.cost) || 0 });
}

watch(range, loadTrend);
onMounted(() => {
  loadQuote();
  loadTrend();
  loadPositions();
  loadInfo();
});
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
.pos-row { border-bottom: 1px dashed var(--border); padding: 6px 0; }
.pos-row:last-child { border-bottom: none; }
.pos-idx { display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; background: #eef0f3; border-radius: 4px; font-size: 12px; margin-right: 4px; }
.kv { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
.kv:last-child { border-bottom: none; }
.range { margin-bottom: 4px; }
</style>
