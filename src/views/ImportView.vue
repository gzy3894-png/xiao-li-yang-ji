<template>
  <div class="page">
    <div class="topbar row-between">
      <button class="btn" @click="$router.back()">← 返回</button>
      <div class="app-title">截图导入持仓</div>
      <div style="width:48px"></div>
    </div>

    <div class="card">
      <div class="sec-title">1. 上传支付宝基金截图</div>
      <div class="hint" style="margin-bottom:8px">
        打开支付宝「理财 → 基金 → 持有 → 点某只基金」，截图该页（能看清基金名称和份额）。支持 OCR 本地识别，不联网。
      </div>
      <label class="upload-area">
        <input type="file" accept="image/*" @change="onFile" class="file-input" />
        <div v-if="!imgSrc" class="upload-hint">📷 点击这里上传 / 拍照导入</div>
        <img v-else :src="imgSrc" alt="screenshot" class="preview" />
      </label>
    </div>

    <div v-if="imgSrc" class="card">
      <div class="sec-title">2. OCR 识别</div>
      <button class="btn btn-primary" :disabled="running" @click="startOcr">
        {{ running ? `识别中... ${progress}%` : '开始识别' }}
      </button>
      <div v-if="rawText" class="hint" style="margin-top:8px; white-space:pre-wrap;">{{ rawText }}</div>
    </div>

    <div v-if="parsed" class="card">
      <div class="sec-title">3. 核对并加入</div>
      <div class="form-row">
        <label>份额代码/名称</label>
        <div class="hint">识别到名称：<b>{{ parsed.name || '未识别' }}</b>{{ parsed.code ? ' · ' + parsed.code : '' }}</div>
        <input class="input" type="number" v-model="form.code" placeholder="如未识别，请手动输入6位基金代码" />
        <button class="btn mini" @click="autoSearch" v-if="!form.code">根据名称查找代码</button>
      </div>
      <div class="form-row">
        <label>持有份额</label>
        <input class="input" type="number" v-model="form.num" placeholder="如 1234.56" />
      </div>
      <div class="form-row">
        <label>持仓成本</label>
        <input class="input" type="number" v-model="form.cost" placeholder="如 1.2345" />
        <div v-if="parsed.amount && !form.num" class="hint">识别到持仓金额 {{ parsed.amount }}，无份额时可在保存后自动生成份额。</div>
      </div>
      <div class="row-between" style="gap:8px">
        <button class="btn btn-primary" style="flex:1" @click="add">确认添加</button>
        <button class="btn" @click="reset">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useFundStore } from '../stores/fundStore';
import { ocrImage, parseScreenshotText } from '../services/ocr';
import { searchFunds, getFundsData } from '../services/fundApi';

const router = useRouter();
const store = useFundStore();
const imgSrc = ref('');
const rawText = ref('');
const running = ref(false);
const progress = ref(0);
const parsed = ref(null);
const form = reactive({ code: '', num: '', cost: '' });

function onFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { imgSrc.value = reader.result; rawText.value = ''; parsed.value = null; };
  reader.readAsDataURL(file);
}

async function startOcr() {
  running.value = true;
  progress.value = 0;
  try {
    const img = document.querySelector('.preview');
    if (!img) return;
    const text = await ocrImage(img, (p) => { progress.value = p; });
    rawText.value = text;
    parsed.value = parseScreenshotText(text);
    form.code = parsed.value.code || '';
    form.num = parsed.value.share || '';
    form.cost = parsed.value.cost || '';
  } catch (e) {
    rawText.value = '';
    parsed.value = { name: '', code: '', share: null, cost: null, amount: null, gains: null };
    alert('OCR 识别失败：' + (e.message || e) + '，请手动输入。');
  } finally {
    running.value = false;
  }
}

async function autoSearch() {
  const name = rawText.value.split('\n').map((s) => s.trim()).filter(Boolean).find((l) => /[一-龥]{4,}/.test(l) && !/[\d]/.test(l));
  if (!name) { alert('未识别到可用名称'); return; }
  const list = await searchFunds(name);
  if (list && list.length) {
    form.code = list[0].code;
    if (!form.name) form.name = list[0].name;
  } else {
    alert('搜索未命中，请手动输入代码');
  }
}

async function add() {
  if (!form.code || !/^\d{6}$/.test(form.code)) { alert('代码格式不正确'); return; }
  if (!form.num && !form.amount && !(parsed.value && parsed.value.amount)) { alert('请填写份额或金额'); return; }

  let num = Number(form.num) || 0;
  let cost = Number(form.cost) || 0;

  // 没有份额但有金额：用最新净值换算
  if (!num && parsed.value && parsed.value.amount) {
    try {
      const raw = await getFundsData([form.code]);
      const nav = raw && raw[0] ? Number(raw[0].NAV) : null;
      if (nav && nav > 0) num = Number((parsed.value.amount / nav).toFixed(4));
    } catch { /* ignore */ }
  }

  store.addFund({ code: form.code, name: (parsed.value && parsed.value.name) || '' });
  store.updateHold(form.code, { num, cost });
  alert('已添加到自选');
  router.push('/');
}

function reset() {
  imgSrc.value = '';
  rawText.value = '';
  parsed.value = null;
  form.code = '';
  form.num = '';
  form.cost = '';
}
</script>

<style scoped>
.app-title { font-size: 18px; font-weight: 700; }
.topbar { margin-bottom: 12px; }
.upload-area {
  display: block;
  border: 2px dashed #d3d9e0;
  border-radius: 12px;
  text-align: center;
  padding: 24px;
  cursor: pointer;
  background: #fbfcfd;
}
.upload-hint { color: #889; font-size: 14px; padding: 12px 0; }
.file-input { display: none; }
.preview { width: 100%; max-height: 420px; object-fit: contain; border-radius: 8px; }
.form-row { margin: 10px 0; }
.form-row label { font-size: 13px; color: #555; display: block; margin-bottom: 4px; }
.btn.mini { padding: 4px 8px; font-size: 12px; margin-top: 6px; }
</style>
