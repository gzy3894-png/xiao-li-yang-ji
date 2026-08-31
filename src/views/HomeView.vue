<template>
  <div class="page">
    <div class="topbar row-between">
      <div>
        <div class="app-title">小李养鸡</div>
        <div class="hint">实时估值 · 数据来自东方财富公开接口</div>
      </div>
      <button class="btn btn-primary" @click="$router.push('/search')">+ 添加</button>
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

    <div v-if="store.lastError" class="hint" style="margin-bottom:8px">
      数据获取失败（{{ store.lastError }}），请检查网络后下拉重试。
    </div>

    <div v-if="!store.rows.length && !store.loading" class="card empty">
      还没有自选基金，点右上角「添加」搜索基金代码或名称。
    </div>

    <div v-for="(r, i) in store.rows" :key="r.code" class="card fund-card">
      <div class="fc-main row-between" @click="$router.push('/fund/' + r.code)">
        <div class="fc-left">
          <div class="fc-name">{{ r.name }} <span class="fc-code">{{ r.code }}</span></div>
          <div class="hint" style="margin-top:2px">
            {{ r.hasReplace ? '已更新净值' : (r.gztime ? String(r.gztime).slice(5) + ' 估值' : '--') }}
          </div>
        </div>
        <div class="fc-right" style="text-align:right">
          <div class="fc-gszzl" :class="r.gszzl >= 0 ? 'up' : 'down'" v-if="r.gszzl !== null">
            {{ r.gszzl >= 0 ? '+' : '' }}{{ Number(r.gszzl).toFixed(2) }}%
          </div>
          <div class="hint" style="margin-top:2px">
            净值 {{ r.dwjz !== null ? Number(r.dwjz).toFixed(4) : '--' }}
            <span v-if="r.gsz !== null && !r.hasReplace">/ 估 {{ Number(r.gsz).toFixed(4) }}</span>
          </div>
        </div>
      </div>

      <div class="fc-nums">
        <div class="fc-num"><span class="hint">份额</span>{{ r.num || 0 }}</div>
        <div class="fc-num"><span class="hint">市值</span>{{ Number(r.amount || 0).toFixed(2) }}</div>
        <div class="fc-num"><span class="hint">今日</span><span :class="r.gains >= 0 ? 'up' : 'down'">{{ Number(r.gains || 0).toFixed(2) }}</span></div>
        <div class="fc-num"><span class="hint">持有</span><span :class="r.costGains >= 0 ? 'up' : 'down'">{{ Number(r.costGains || 0).toFixed(2) }}</span></div>
      </div>

      <div class="fc-actions">
        <button class="btn mini" @click="toggleEdit(r.code)">{{ editing === r.code ? '收起' : '编辑份额' }}</button>
        <button class="btn mini" @click="move(i, -1)">上移</button>
        <button class="btn mini" @click="move(i, 1)">下移</button>
        <button class="btn mini danger" @click="del(r)">删除</button>
      </div>

      <div v-if="editing === r.code" class="fc-editor">
        <div>
          <span class="hint">持有份额</span>
          <input class="input" type="number" v-model="editForm.num" placeholder="例如 1000" />
        </div>
        <div>
          <span class="hint">成本净值</span>
          <input class="input" type="number" v-model="editForm.cost" placeholder="可留空" />
        </div>
        <button class="btn btn-primary" @click="saveEdit(r.code)">保存</button>
      </div>
    </div>

    <div class="hint" style="text-align:center; margin-top: 12px">
      下拉刷新 / 数据每 60 秒自动刷新（交易日）
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useFundStore } from '../stores/fundStore';
import IndexBar from '../components/IndexBar.vue';
import { getAvailableUpdate, installUpdate } from '../services/updater';

const store = useFundStore();
const editing = ref('');
const editForm = ref({ num: '', cost: '' });
let timer = null;

function isTradingTime() {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const min = d.getHours() * 60 + d.getMinutes();
  return min >= 9 * 60 + 30 && min <= 15 * 60 + 5;
}

function toggleEdit(code) {
  if (editing.value === code) {
    editing.value = '';
    return;
  }
  const r = store.rows.find((x) => x.code === code);
  editForm.value = { num: r ? r.num : '', cost: r && r.cost ? r.cost : '' };
  editing.value = code;
}

function saveEdit(code) {
  store.updateHold(code, {
    num: Number(editForm.value.num) || 0,
    cost: Number(editForm.value.cost) || 0
  });
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

onMounted(() => {
  store.refresh();
  getAvailableUpdate().then((u) => {
    if (u && window.confirm(`发现新版本 v${u.versionName}，是否下载并安装？`)) {
      installUpdate(u);
    }
  });
  timer = setInterval(() => {
    if (isTradingTime()) store.refresh();
  }, 60 * 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.app-title {
  font-size: 22px;
  font-weight: 700;
}
.topbar {
  margin-bottom: 12px;
}
.summary .s-label {
  font-size: 12px;
  color: #888;
}
.summary .s-val {
  font-size: 16px;
  font-weight: 600;
  margin-top: 2px;
}
.empty {
  text-align: center;
  padding: 40px 16px;
  color: #888;
}
.fund-card {
  padding: 12px;
}
.fc-name {
  font-size: 15px;
  font-weight: 600;
}
.fc-code {
  color: #888;
  font-size: 12px;
  font-weight: 400;
}
.fc-gszzl {
  font-size: 18px;
  font-weight: 700;
}
.fc-nums {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.fc-num {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.fc-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.btn.mini {
  padding: 5px 10px;
  font-size: 12px;
}
.btn.danger {
  background: #fdecec;
  color: #d33;
}
.fc-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}
</style>
