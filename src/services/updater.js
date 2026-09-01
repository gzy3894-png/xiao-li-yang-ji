import { Capacitor } from '@capacitor/core';
import { XiaoLiNative } from 'capacitor-xiaoli-native';
import { httpGetText } from './http';

const UPDATE_JSON_URL = 'https://gitee.com/gzy3894/xiao-li-yang-ji/raw/releases/update.json';
const CURRENT_VERSION_CODE = 3;

export function currentVersionCode() {
  return CURRENT_VERSION_CODE;
}

export async function checkUpdate() {
  try {
    const text = await httpGetText(UPDATE_JSON_URL);
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

export async function getAvailableUpdate() {
  const info = await checkUpdate();
  if (info && Number(info.versionCode) > CURRENT_VERSION_CODE) return info;
  return null;
}

export async function installUpdate(info) {
  if (!info || !info.url) return;
  if (Capacitor.isNativePlatform()) {
    await XiaoLiNative.installApk({ url: info.url, sha256: info.sha256 || '' });
  } else {
    window.open(info.url, '_blank');
  }
}
