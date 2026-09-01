<template>
  <div class="page">
    <div class="topbar row-between">
      <div>
        <div class="app-title">小李养鸡</div>
        <div class="hint">估值源：{{ estimateSourceLabel }} · 行情：{{ showQuoteSource }}</div>
      </div>
      <div class="row-between" style="gap:8px">
        <button class="btn" @click="openSettings = true">设置</button>
        <button class="btn btn-primary" @click="$router.push('/search')">+ 添加</button>
      </div>
    </div>

    <div v-if="openSettings" class="modal-mask" @click.self="openSettings = false">
      <div class="modal card">
        <div class="sec-title">估值源</div>
        <label class="src-row" v-for="s in sources" :key="s.value">
          <input type="radio" name="src" :value="s.value" v-model="estimateSource" @change="confirmSource" />
          <div class="src-info">
            <div class="src-name">{{ s.label }}</div>
            <div class="hint">{{ s.hint }}</div>
          </div>
        </label>
        <button class="btn" style="width:100%;margin-top:10px" @click="openSettings = false">关闭</button>
      </div>
    </div>

    <IndexBar :indices="store.indices" />

    <div class="card summary row-between">
      <div>
        <div class="s-label">持仓市值</div>
        <div class="s-val">¥{{ store.totalMarketValue.toFixed(2) }}</div>
      </div>
      <div>
        <div class="s-label">今日估值</div>
        <div class="s-val" :class="store.totalTodayGains >= 0 ? 'up' : 'down'">
          {{ store.totalTodayGains >= 0 ? '+' : '' }}{{ store.totalTodayGains.toFixed(2) }}
        </div>
      </div>
      <div>
        <div class="s-label">持有收益</div>
        <div class="s-val" :class="store.totalCostGains >= 0 ? 'up' : 'down'">
          {{ store.totalCostGains >= 0 ? '+' : '' }}{{ store.totalCostGains.toFixed(2) }}
        </div>
      </div>
    </div>

    <div v-if="store.lastError" class="hint" style="margin-bottom:8px">行情不可用：{{ store.lastError }}</div>

    <div v-if="!store.rows.length && !store.loading" class="card empty">
      还没有自选基金。去「添加」搜索，或用「截图导入」从支付宝批量导入。
      <div style="margin-top:10px">
        <button class="btn btn-primary" @click="$router.push('/import')">截图导入持仓</button>
      </div>
    </div>

    <div v-for="(r, i) in store.rows" :key="r.code" class="card fund-card">
      <div class="fc-main row-between" @click="$router.push('/fund/' + r.code)">
        <div class="fc-left">
          <div class="fc-name">{{ r.name }} <span class="fc-code">{{ r.code }}</span></div>
          <div class="hint" style="margin-top:2px">
            <span v-if="r.quoteSource">{{ sourceTag(r.quoteSource) }}估值</span>
            <span v-else-if="r.hasReplace">已更新净值</span>
            <span v-else>官方估值</span>
            · {{ r.gztime ? String(r.gztime).slice(5, 11) : r.jzrq || '--' }}
          </div>
        </div>
        <div class="fc-right" style="text-align:right">
          <div class="fc-gszzl" :class="showPct(r) >= 0 ? 'up' : 'down'">{{ showPct(r) >= 0 ? '+' : '' }}{{ Number(showPct(r)).toFixed(2) }}%</div>
          <div class="hint" style="margin-top:2px">
            净 {{ fmt4(r.dwjz) }}<span v-if="r.estNav"> / 估 <span :class="showPct(r) >= 0 ? 'up' : 'down'">{{ fmt4(r.estNav) }}</span></span>
          </div>
        </div>
      </div>

      <div class="fc-nums">
        <div class="fc-num"><span class="hint">份额/市值</span>{{ r.num || '--' }} / {{ fmt2(r.amount) }}</div>
        <div class="fc-num"><span class="hint">今日</span><span :class="r.gains >= 0 ? 'up' : 'down'">{{ fmtSign2(r.gains) }}</span></div>
        <div class="fc-num"><span class="hint">持有收益</span><span :class="r.costGains > 0 ? 'up' : (r.costGains < 0 ? 'down' : '')">{{ holdLabel(r) }}</span></div>
      </div>

      <div class="fc-actions">
        <button class="btn mini" @click="toggleEdit(r.code)">{{ editing === r.code ? '收起' : '编辑持仓' }}</button>
        <button class="btn mini" @click="move(i, -1)">上移</button>
        <button class="btn mini" @click="move(i, 1)">下移</button>
        <button class="btn mini danger" @click="del(r)">删除</button>
      </div>

      <div v-if="editing === r.code" class="fc-editor">
        <div class="hint">填份额+任一成本即可计算收益；未填写先显示 --。</div>
        <div>
          <span class="hint">持有份额</span>
          <input class="input" type="number" v-model="editForm.num" placeholder="例如 1000" />
        </div>
        <div>
          <span class="hint">持仓成本（每份）</span>
          <input class="input" type="number" v-model="editForm.cost" placeholder="留空 = 不显示持有收益" />
        </div>
        <button class="btn btn-primary" @click="saveEdit(r.code)">保存</button>
      </div>
    </div>

    <div class="hint" style="text-align:center; margin-top: 12px">下拉刷新 / 交易日每 60 秒自动刷新</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { useFundStore } from '../stores/fundStore';
import IndexBar from '../components/IndexBar.vue';
import { getAvailableUpdate, installUpdate } from '../services/updater';

const store = useFundStore();
const editing = ref('');
const editForm = ref({ num: '', cost: '' });
const openSettings = ref(false);
const estimateSource = ref(store.settings.estimateSource);

const sources = [
  { value: 'auto', label: '自动（推荐）', hint: '先尝试东财行情，失败自动切腾讯/新浪' },
  { value: 'em', label: '持仓加权 · 东财', hint: '根据前十大持仓×实时股价估算，准度最高' },
  { value: 'tc', label: '持仓加权 · 腾讯', hint: '同上，但行情走腾讯' },
  { value: 'sina', label: '持仓加权 · 新浪', hint: '同上，但行情走新浪' },
  { value: 'tt', label: '天天基金官方估值', hint: '直接使用天天基金的盘中估值（偶尔偏低）' }
];

const estimateSourceLabel = computed(() => {
  const found = sources.find((s) => s.value === store.settings.estimateSource);
  return found ? found.label : '自动';
});

const showQuoteSource = computed(() => {
  const map = { em: '东财', tencent: '腾讯', sina: '新浪', none: '无', '': '官方' };
  return map[store.quoteFeedback || ''] || '官方';
});

function sourceTag(s) {
  return ({ em: '东财', tencent: '腾讯', sina: '新浪' })[s] || '官方';
}

function showPct(r) {
  return r.estPct != null ? r.estPct : (r.gszzl ?? 0);
}
function fmt4(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(4);
}
function fmt2(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(2);
}
function fmtSign2(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(2);
}
function holdLabel(r) {
  if (!r.cost) return '--';
  return Number(r.costGains).toFixed(2) + ' (' + (r.costGainsRate >= 0 ? '+' : '') + r.costGainsRate + '%)';
}

function toggleEdit(code) {
  if (editing.value === code) { editing.value = ''; return; }
  const r = store.rows.find((x) => x.code === code);
  editForm.value = { num: r ? r.num : '', cost: r && r.cost ? r.cost : '' };
  editing.value = code;
}
function saveEdit(code) {
  store.updateHold(code, { num: Number(editForm.value.num) || 0, cost: Number(editForm.value.cost) || 0 });
  editing.value = '';
}
function move(i, dir) {
  const next = [...store.watchList];
  const j = i + dir;
  if (j < 0 || j >= next.length) return;
  [next[i], next[j]] = [next[j], next[i]];
  store.reorder(next);
}
function del(r) {
  if (window.confirm(`删除自选：${r.name}？`)) store.removeFund(r.code);
}
function confirmSource() {
  store.setEstimateSource(estimateSource.value);
}
function isTradingTime() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const min = d.getHours() * 60 + d.getMinutes();
  return min >= 9 * 60 + 30 && min <= 15 * 60 + 5;
}

let timer = null;
onMounted(() => {
  store.refresh();
  getAvailableUpdate().then((u) => {
    if (u && window.confirm(`发现新版本 v${u.versionName}，是否下载并安装？`)) installUpdate(u);
  });
  timer = setInterval(() => { if (isTradingTime()) store.refresh(); }, 60 * 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.app-title { font-size: 22px; font-weight: 700; }
.topbar { margin-bottom: 12px; }
.summary .s-label { font-size: 12px; color: #888; }
.summary .s-val { font-size: 16px; font-weight: 600; margin-top: 2px; }
.empty { text-align: center; padding: 40px 16px; color: #888; }
.fund-card { padding: 12px; }
.fc-name { font-size: 15px; font-weight: 600; }
.fc-code { color: #888; font-size: 12px; font-weight: 400; }
.fc-gszzl { font-size: 18px; font-weight: 700; }
.fc-nums { display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; gap: 4px; flex-wrap: wrap; }
.fc-num { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.fc-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.btn.mini { padding: 5px 10px; font-size: 12px; }
.btn.danger { background: #fdecec; color: #d33; }
.fc-editor { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-end; z-index: 100; }
.modal { width: 100%; margin: 0; border-radius: 16px 16px 0 0; max-height: 80vh; overflow: auto; }
.src-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.src-row:last-child { border-bottom: none; }
.src-info .src-name { font-weight: 600; font-size: 14px; }
</style>
