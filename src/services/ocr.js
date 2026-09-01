import { createWorker } from 'tesseract.js';

// 全部离线打包进 APK，不依赖网络/CDN
const TESS = 'tesseract';

export async function ocrImage(image, onProgress) {
  const worker = await createWorker('chi_sim', 1, {
    workerPath: `${TESS}/worker.min.js`,
    corePath: `${TESS}/tesseract-core-lstm.wasm.js`,
    langPath: 'tessdata',
    cacheMethod: 'none',
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(Math.floor((m.progress || 0) * 100));
    }
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export function parseScreenshotText(text) {
  const lines = (text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const flat = lines.join(' ');
  const out = { name: '', code: '', share: null, cost: null, amount: null, gains: null };
  const nameRow = lines.find((l) => /[一-龥]{4,}/.test(l) && !/[\d]/.test(l));
  if (nameRow) out.name = nameRow.replace(/\(.*?\)/g, '').replace(/\s/g, '').trim();
  const codeMatch = flat.match(/(?<!\d)(\d{6})(?!\d)/);
  if (codeMatch) out.code = codeMatch[1];
  let m = flat.match(/持有份额[：:]?\s*([\d,.]+)/) || flat.match(/份额[：:]?\s*([\d,.]+)/);
  if (m) out.share = parseNum(m[1]);
  m = flat.match(/持仓成本[(-]?([):]|[：:])?\s*([\d.]+)/) || flat.match(/持仓成本价[：:]?\s*([\d.]+)/);
  if (m) out.cost = parseNum(m[2] ?? m[1]);
  m = flat.match(/持有金额[（）()]*[：:]?\s*([\d,.]+)/) || flat.match(/总金额[：:]?\s*([\d,.]+)/);
  if (m) out.amount = parseNum(m[1]);
  m = flat.match(/持有收益[（）()]*[：:]?\s*([-+]?[\d,.]+)/) || flat.match(/累计收益[：:]?\s*([-+]?[\d,.]+)/);
  if (m) out.gains = parseNum(m[1]);
  return out;
}

function parseNum(s) {
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}
