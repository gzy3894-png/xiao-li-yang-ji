import { Capacitor } from '@capacitor/core';
import { XiaoLiNative } from 'capacitor-xiaoli-native';

export async function httpGetText(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await XiaoLiNative.get({ url });
    return res.data;
  }
  // Web 开发兜底（部分接口有 CORS 限制，仅用于调试）
  const res = await fetch(url);
  return await res.text();
}

export async function httpGetJson(url) {
  const text = (await httpGetText(url)).replace(/^\uFEFF/, '');
  return JSON.parse(text);
}
