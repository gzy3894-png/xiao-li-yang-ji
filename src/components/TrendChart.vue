<template>
  <div ref="el" class="chart"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({ option: { type: Object, required: true } });
const el = ref(null);
let chart = null;

function render() {
  if (!chart && el.value) chart = echarts.init(el.value);
  if (chart) chart.setOption(props.option, true);
}

onMounted(() => {
  render();
  const onResize = () => chart && chart.resize();
  window.addEventListener('resize', onResize);
  onBeforeUnmount(() => window.removeEventListener('resize', onResize));
});
watch(() => props.option, render, { deep: true });
onBeforeUnmount(() => {
  if (chart) {
    chart.dispose();
    chart = null;
  }
});
</script>

<style scoped>
.chart {
  width: 100%;
  height: 240px;
}
</style>
