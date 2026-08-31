<template>
  <div class="index-scroll">
    <div v-for="(el, i) in indices" :key="i" class="index-item card">
      <div class="idx-name">{{ el.f14 }}</div>
      <div class="idx-val" :class="Number(el.f3) >= 0 ? 'up' : 'down'">{{ el.f2 }}</div>
      <div class="idx-pct" :class="Number(el.f3) >= 0 ? 'up' : 'down'">
        {{ Number(el.f3) >= 0 ? '+' : '' }}{{ el.f3 }}%
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ indices: { type: Array, default: () => [] } });
</script>

<style scoped>
.index-scroll {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 2px 0 10px;
  -webkit-overflow-scrolling: touch;
}
.index-item {
  flex: 0 0 96px;
  text-align: center;
  margin-bottom: 0;
  padding: 10px 8px;
}
.idx-name {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}
.idx-val {
  font-size: 16px;
  font-weight: 600;
  margin-top: 4px;
}
.idx-pct {
  font-size: 12px;
  margin-top: 2px;
}
</style>
