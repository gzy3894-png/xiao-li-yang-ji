<template>
  <div class="page">
    <div class="topbar row-between glass-bar">
      <div>
        <div class="app-title">小李养鸡</div>
        <div class="hint">估值源：{{ estimateSourceLabel }} · 行情：{{ showQuoteSource }}</div>
      </div>
      <div class="row-between" style="gap:8px">
        <button class="btn" @click="openSettings = true">设置</button>
        <button class="btn btn-primary" @click="$router.push('/search')">+ 添加</button>
      </div>
    </div>

    <div v-if="updateInfo" class="card update-banner row-between">
      <div>
        <div class="update-title">发现新版本 v{{ updateInfo.versionName }}</div>
        <div class="hint">{{ updateInfo.source }} 源 · 当前 v{{ CURRENT_VERSION_NAME }}(code {{ CURRENT_VERSION_CODE }})<span v-if="updateInfo.size"> · {{ formatBytes(updateInfo.size) }}</span></div>
        <div v-if="updateInfo.changelog" class="hint clamp-1">{{ updateInfo.changelog }}</div>
      </div>
      <button class="btn btn-primary" :disabled="updateBusy" @click="downloadUpdate">
        {{ updateBusy ? (updateProgress >= 0 ? updateProgress + '%' : '下载中') : '更新' }}
      </button>
    </div>
    <div v-if="updateBusy" class="progress-line"><i :style="{ width: (updateProgress >= 0 ? updateProgress : 18) + '%' }"></i></div>
    <div v-if="updateMsg && !openSettings" class="hint update-msg">{{ updateMsg }}</div>

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
        <div class="sec-title update-sec">在线更新</div>
        <div class="hint">默认 Gitee 更新源；检查到新版本后，在 App 内下载 APK 并调起安装。</div>
        <div class="row-between update-actions">
          <button class="btn" :disabled="updateBusy" @click="checkUpdateManual">检查更新</button>
          <button class="btn btn-primary" :disabled="updateBusy || !updateInfo" @click="downloadUpdate">
            {{ updateBusy ? (updateProgress >= 0 ? updateProgress + '%' : '下载中') : '下载并安装' }}
          </button>
        </div>
        <div v-if="updateBusy" class="progress-line in-modal"><i :style="{ width: (updateProgress >= 0 ? updateProgress : 18) + '%' }"></i></div>
        <div class="hint update-result">当前 v{{ CURRENT_VERSION_NAME }}（code {{ CURRENT_VERSION_CODE }}）<span v-if="updateInfo"> → 最新 v{{ updateInfo.versionName }}（code {{ updateInfo.versionCode }}）</span></div>
        <div v-if="updateMsg" class="hint update-result">{{ updateMsg }}</div>
        <button class="btn" style="width:100%;margin-top:10px" @click="openSettings = false">关闭</button>
      </div>
    </div>

    <IndexBar :indices="store.indices" />

    <div class="card summary row-between summary-hero">
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

    <div class="seg view-switch">
      <button class="btn mini" :class="{ active: viewMode === 'all' }" @click="viewMode = 'all'">全部关注</button>
      <button class="btn mini" :class="{ active: viewMode === 'holding' }" @click="viewMode = 'holding'">仅持仓</button>
    </div>

    <div v-if="store.lastError" class="hint" style="margin-bottom:8px">行情不可用：{{ store.lastError }}</div>

    <div v-if="!store.rows.length && !store.loading" class="card empty">
      还没有自选基金。去「添加」搜索，或用「截图导入」从支付宝批量导入。
      <div style="margin-top:10px">
        <button class="btn btn-primary" @click="$router.push('/import')">截图导入持仓</button>
      </div>
    </div>

    <div v-for="r in visibleRows" :key="r.code" class="card fund-card">
      <div class="fc-main row-between" @click="$router.push('/fund/' + r.code)">
        <div class="fc-left">
          <div class="fc-name">{{ r.name }} <span class="fc-code">{{ r.code }}</span></div>
          <div class="hint" style="margin-top:2px">
            <span>{{ estimateTag(r) }}</span>
            · {{ r.gztime ? String(r.gztime).slice(5, 11) : r.jzrq || '--' }}
          </div>
        </div>
        <div class="fc-right" style="text-align:right">
          <div class="fc-gszzl" :class="pctClass(r)">{{ pctText(r) }}</div>
          <div class="hint" style="margin-top:2px">
            净 {{ fmt4(r.dwjz) }}<span v-if="r.estNav"> / 估 <span :class="pctClass(r)">{{ fmt4(r.estNav) }}</span></span>
          </div>
        </div>
      </div>

      <div class="fc-nums">
        <div class="fc-num"><span class="hint">份额/市值</span>{{ r.num || '--' }} / {{ fmt2(r.amount) }}</div>
        <div class="fc-num"><span class="hint">今日</span><span :class="numClass(r.gains)">{{ fmtSign2(r.gains) }}</span></div>
        <div class="fc-num"><span class="hint">持有收益</span><span :class="numClass(r.costGains)">{{ holdLabel(r) }}</span></div>
      </div>

      <div class="fc-actions">
        <button class="btn mini" @click="$router.push('/fund/' + r.code + '/position')">{{ Number(r.num) > 0 ? '编辑持仓' : '录入持仓' }}</button>
        <button class="btn mini" @click="moveCode(r.code, -1)">上移</button>
        <button class="btn mini" @click="moveCode(r.code, 1)">下移</button>
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
import { getAvailableUpdate, installUpdateWithFallback, CURRENT_VERSION_CODE, CURRENT_VERSION_NAME, formatBytes } from '../services/updater';

const store = useFundStore();
const editing = ref('');
const editForm = ref({ num: '', cost: '' });
const openSettings = ref(false);
const estimateSource = ref(store.settings.estimateSource);
const viewMode = ref('all');
const visibleRows = computed(() => viewMode.value === 'holding' ? store.rows.filter((r) => Number(r.num) > 0) : store.rows);
const updateInfo = ref(null);
const updateMsg = ref('');
const updateBusy = ref(false);
const updateProgress = ref(-1);
let updateChecked = false;

const sources = [
  { value: 'auto', label: '公共估值（推荐）', hint: '天天 FundValuationLast 批量优先；缺失时补新浪基金估算，绝不用昨日净值冒充' },
  { value: 'tt', label: '仅官方/天天估值', hint: '只使用 FundValuationLast 返回的官方盘中估值；无估值显示 --' },
  { value: 'em', label: '持仓自算 · 东财（实验）', hint: '自算口径，只在设置里明确开启；不作为默认主估值' },
  { value: 'tc', label: '持仓自算 · 腾讯（实验）', hint: '自算口径，只在设置里明确开启；不作为默认主估值' },
  { value: 'sina', label: '持仓自算 · 新浪行情（实验）', hint: '自算口径，只在设置里明确开启；不作为默认主估值' }
];

const estimateSourceLabel = computed(() => {
  const found = sources.find((s) => s.value === store.settings.estimateSource);
  return found ? found.label : '自动';
});

const showQuoteSource = computed(() => {
  const map = { em: '东财', tencent: '腾讯', tc: '腾讯', sina: '新浪', official: '官方', none: '无', '': '官方' };
  return map[store.quoteFeedback || ''] || '官方';
});

function sourceTag(s) {
  return ({ em: '东财', tencent: '腾讯', tc: '腾讯', sina: '新浪' })[s] || '官方';
}

function estimateTag(r) {
  if (r.estimateKind === 'holding') return '持仓自算（实验）';
  if (r.estimateKind === 'nav' || r.hasReplace) return '今日净值';
  if (r.estimateSource === 'tiantian') return '天天估值';
  if (r.estimateSource === 'sina_ds3') return '新浪估值Ⅲ';
  if (r.estimateSource === 'sina_ds2') return '新浪估值Ⅱ';
  if (r.estimateKind === 'official') return '官方估值';
  return '暂无估值';
}
function pctValue(r) {
  const v = r.estPct !== null && r.estPct !== undefined ? r.estPct : r.gszzl;
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? null : n;
}
function pctText(r) {
  const v = pctValue(r);
  return v === null ? '--' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
function pctClass(r) {
  const v = pctValue(r);
  return v === null ? 'muted-num' : (v >= 0 ? 'up' : 'down');
}
function numClass(v) {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? 'muted-num' : (n >= 0 ? 'up' : 'down');
}
function fmt4(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(4);
}
function fmt2(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(2);
}
function fmtSign2(v) {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? '--' : (n >= 0 ? '+' : '') + n.toFixed(2);
}
function holdLabel(r) {
  if (!r.cost) return '--';
  const gains = Number(r.costGains);
  if (!Number.isFinite(gains)) return '--';
  return gains.toFixed(2) + ' (' + (r.costGainsRate >= 0 ? '+' : '') + r.costGainsRate + '%)';
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
function moveCode(code, dir) {
  const next = [...store.watchList];
  const i = next.findIndex((w) => w.code === code);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= next.length) return;
  [next[i], next[j]] = [next[j], next[i]];
  store.reorder(next);
}
function del(r) {
  if (window.confirm(`删除自选：${r.name}？`)) store.removeFund(r.code);
}
function confirmSource() {
  store.setEstimateSource(estimateSource.value);
}
async function silentCheckUpdate() {
  if (updateChecked) return;
  updateChecked = true;
  const info = await getAvailableUpdate();
  if (info && !info.error) updateInfo.value = info;
}
async function checkUpdateManual() {
  updateMsg.value = '正在检查更新...';
  const info = await getAvailableUpdate();
  if (info && info.error) {
    updateInfo.value = null;
    updateMsg.value = `检查失败（${info.source || 'Gitee'}）：${info.error}`;
    return;
  }
  if (info) {
    updateInfo.value = info;
    updateMsg.value = `发现新版本 v${info.versionName}（code ${info.versionCode}）`;
    return;
  }
  updateInfo.value = null;
  updateMsg.value = '当前已是最新版本。';
}
async function downloadUpdate() {
  if (!updateInfo.value || updateBusy.value) return;
  updateBusy.value = true;
  updateProgress.value = updateInfo.value.size ? 0 : -1;
  updateMsg.value = '开始下载安装包...';
  try {
    await installUpdateWithFallback(updateInfo.value, (p) => {
      updateProgress.value = p.percent;
      if (p.total) updateMsg.value = `下载中 ${p.percent >= 0 ? p.percent + '%' : ''}（${formatBytes(p.received)} / ${formatBytes(p.total)}）`;
    });
    updateProgress.value = 100;
    updateMsg.value = '安装程序已调起，请在系统安装器中完成更新。';
  } catch (e) {
    updateMsg.value = '下载或调起安装失败，已尝试打开浏览器下载：' + (e && e.message ? e.message : e);
  } finally {
    updateBusy.value = false;
  }
}
function isTradingTime() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const min = d.getHours() * 60 + d.getMinutes();
  return (min >= 570 && min <= 720) || (min >= 780 && min <= 905);
}

let timer = null;
onMounted(() => {
  store.refresh();
  silentCheckUpdate();
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

.glass-bar { position: sticky; top: 8px; z-index: 20; }
.update-banner { border: none; color: #dcebff; }
.update-title { font-weight: 800; font-size: 15px; color: #fff; }
.update-sec { margin-top: 12px; }
.update-actions { gap: 10px; margin-top: 10px; }
.update-actions .btn { flex: 1; }
.update-result { margin-top: 8px; line-height: 1.6; }
.progress-line { height: 5px; border-radius: 999px; overflow: hidden; margin: 8px 0 10px; background: rgba(24, 119, 255, .14); }
.progress-line i { display: block; height: 100%; min-width: 18%; border-radius: inherit; background: var(--brand-grad); transition: width .25s ease; }
.progress-line.in-modal { margin: 10px 0 0; }
.update-msg { margin: -2px 0 10px; }
.clamp-1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.muted-num { color: #8b96a9; }
.view-switch { margin: 0 0 12px; }
</style>
