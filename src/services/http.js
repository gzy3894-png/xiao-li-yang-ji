import { Capacitor } from '@capacitor/core';
import { XiaoLiNative } from 'capacitor-xiaoli-native';

export async function httpGetText(url, charset) {
  if (Capacitor.isNativePlatform()) {
    const res = await XiaoLiNative.get({ url, charset: charset || 'UTF-8' });
    return res.data;
  }
  // Web 开发兜底（部分接口有 CORS 限制，仅用于调试）
  const res = await fetch(url);
  if (!charset || /^utf-?8$/i.test(charset)) {
    return await res.text();
  }
  const buf = await res.arrayBuffer();
  return new TextDecoder(charset).decode(buf);
}

export async function httpGetJson(url) {
  const text = (await httpGetText(url)).replace(/^\uFEFF/, '');
  return JSON.parse(text);
}
