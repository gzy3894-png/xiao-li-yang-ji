<template>
  <router-view />
  <div v-if="showExitTip" class="exit-tip">再按一次退出小李养鸡</div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const router = useRouter();
const showExitTip = ref(false);
let listener = null;
let lastBackAt = 0;
let tipTimer = null;

async function onAndroidBack({ canGoBack }) {
  if (canGoBack) {
    showExitTip.value = false;
    router.back();
    return;
  }
  const now = Date.now();
  if (now - lastBackAt <= 1800) {
    await CapacitorApp.exitApp();
    return;
  }
  lastBackAt = now;
  showExitTip.value = true;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { showExitTip.value = false; }, 1800);
}

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return;
  listener = await CapacitorApp.addListener('backButton', onAndroidBack);
});

onBeforeUnmount(() => {
  clearTimeout(tipTimer);
  if (listener && listener.remove) listener.remove();
});
</script>
