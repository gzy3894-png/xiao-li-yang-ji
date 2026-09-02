<template>
  <div class="page">
    <div class="topbar row-between">
      <button class="btn" @click="$router.back()">← 返回</button>
      <div class="app-title">{{ r?.name || '录入持仓' }}</div>
      <div style="width:48px"></div>
    </div>

    <div class="card">
      <div class="sec-title">持仓信息</div>
      <div class="hint" style="margin-bottom:10px">基金代码 {{ code }}；只填份额可计入市值，填成本后可计算持有收益。</div>
      <div class="form-row">
        <label>持有份额</label>
        <input class="input" type="number" inputmode="decimal" v-model="form.num" placeholder="例如 1000.00" />
      </div>
      <div class="form-row">
        <label>持仓成本（每份）</label>
        <input class="input" type="number" inputmode="decimal" v-model="form.cost" placeholder="可选，例如 1.2345" />
      </div>
      <div class="row-between" style="gap:10px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" @click="save">保存</button>
        <button class="btn" @click="$router.back()">取消</button>
      </div>
      <div v-if="msg" class="hint" style="margin-top:10px">{{ msg }}</div>
    </div>

    <div class="card" v-if="r">
      <div class="sec-title">当前估值</div>
      <div class="row-between">
        <span class="hint">估值/净值</span>
        <b>{{ r.gsz !== null && r.gsz !== undefined ? Number(r.gsz).toFixed(4) : Number(r.dwjz || 0).toFixed(4) }}</b>
      </div>
      <div class="row-between">
        <span class="hint">涨跌幅</span>
        <b :class="pct >= 0 ? 'up' : 'down'">{{ pct === null ? '--' : (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' }}</b>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFundStore } from '../stores/fundStore';

const route = useRoute();
const router = useRouter();
const store = useFundStore();
const code = String(route.params.code || '');
const form = reactive({ num: '', cost: '' });
const msg = ref('');

const r = computed(() => store.rows.find((x) => x.code === code) || store.watchList.find((x) => x.code === code) || null);
const pct = computed(() => {
  const row = store.rows.find((x) => x.code === code);
  const v = row ? (row.gszzl ?? null) : null;
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? null : n;
});

function load() {
  const w = store.watchList.find((x) => x.code === code);
  if (w) {
    form.num = w.num || '';
    form.cost = w.cost || '';
  }
}
load();

async function save() {
  const num = Number(form.num);
  const cost = Number(form.cost);
  if (form.num !== '' && (!Number.isFinite(num) || num < 0)) {
    msg.value = '份额必须是大于等于 0 的数字';
    return;
  }
  if (form.cost !== '' && (!Number.isFinite(cost) || cost <= 0)) {
    msg.value = '成本必须是大于 0 的数字';
    return;
  }
  const name = route.query.name || r.value?.name || '';
  if (!store.watchList.some((x) => x.code === code)) {
    store.addFund({ code, name });
  }
  store.updateHold(code, { num: Number.isFinite(num) ? num : 0, cost: Number.isFinite(cost) ? cost : 0 });
  msg.value = '已保存';
  setTimeout(() => router.back(), 250);
}
</script>

<style scoped>
.app-title { font-size: 18px; font-weight: 800; }
.topbar { margin-bottom: 12px; }
.form-row { margin: 12px 0; }
.form-row label { display:block; margin-bottom:6px; color:#4a5a74; font-weight:700; }
</style>
