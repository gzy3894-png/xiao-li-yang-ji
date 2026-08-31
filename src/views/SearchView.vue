<template>
  <div class="page">
    <div class="topbar row-between">
      <button class="btn" @click="$router.back()">← 返回</button>
      <div class="app-title">添加基金</div>
      <div style="width:48px"></div>
    </div>

    <input
      class="input"
      v-model="keyword"
      placeholder="输入基金代码 / 名称 / 拼音首字母"
      @input="onSearch"
    />

    <div class="hint" style="margin:8px 0">共 {{ results.length }} 条结果</div>

    <div v-for="item in results" :key="item.code" class="card row-between">
      <div>
        <div class="s-name">{{ item.name }}</div>
        <div class="hint">{{ item.code }}</div>
      </div>
      <button class="btn btn-primary" @click="add(item)">添加</button>
    </div>

    <div v-if="keyword && !loading && !results.length" class="card empty">没有匹配结果</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFundStore } from '../stores/fundStore';
import { searchFunds } from '../services/fundApi';

const router = useRouter();
const store = useFundStore();
const keyword = ref('');
const results = ref([]);
const loading = ref(false);
let seq = 0;

async function onSearch() {
  const q = keyword.value.trim();
  if (!q) {
    results.value = [];
    return;
  }
  const my = ++seq;
  loading.value = true;
  try {
    const list = await searchFunds(q);
    if (my === seq) results.value = list;
  } catch {
    if (my === seq) results.value = [];
  }
  if (my === seq) loading.value = false;
}

function add(item) {
  store.addFund(item);
  router.push('/');
}
onMounted(() => {});
</script>

<style scoped>
.app-title {
  font-size: 18px;
  font-weight: 700;
}
.topbar {
  margin-bottom: 12px;
}
.s-name {
  font-size: 15px;
  font-weight: 600;
}
.empty {
  text-align: center;
  color: #888;
  padding: 30px 12px;
}
</style>
