import { Capacitor } from '@capacitor/core';
import { XiaoLiNative } from 'capacitor-xiaoli-native';

const DEFAULT_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9'
};

export async function httpGetText(url, charset, opts = {}) {
  const headers = { ...DEFAULT_HEADERS, ...(opts.headers || {}) };
  if (Capacitor.isNativePlatform()) {
    const res = await XiaoLiNative.get({
      url,
      charset: charset || 'UTF-8',
      headers
    });
    if (res && typeof res.status === 'number' && res.status >= 400) {
      throw new Error(`http ${res.status}: ${url}`);
    }
    return res.data;
  }
  // Web 开发兜底（部分接口有 CORS 限制，仅用于调试）
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`http ${res.status}: ${url}`);
  if (!charset || /^utf-?8$/i.test(charset)) {
    return await res.text();
  }
  const buf = await res.arrayBuffer();
  return new TextDecoder(charset).decode(buf);
}

export async function httpGetJson(url, opts = {}) {
  const text = (await httpGetText(url, 'utf-8', opts)).replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch (e) {
    const snippet = String(text).slice(0, 160);
    throw new Error(`bad json from ${url}: ${e.message}; head=${snippet}`);
  }
}
