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
  gap: 10px;
  padding: 2px 2px 10px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.index-scroll::-webkit-scrollbar { display: none; }
.index-item {
  flex: 0 0 108px;
  text-align: center;
  margin-bottom: 0;
  padding: 12px 8px;
  scroll-snap-align: start;
}
.idx-name { font-size: 12px; color: #6f7b91; white-space: nowrap; }
.idx-val { font-size: 17px; font-weight: 800; margin-top: 5px; }
.idx-pct { font-size: 12px; margin-top: 3px; font-weight: 700; }
</style>
