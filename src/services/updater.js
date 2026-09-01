import { Capacitor } from '@capacitor/core';
import { XiaoLiNative } from 'capacitor-xiaoli-native';
import { httpGetJson } from './http';
import appMeta from '../../package.json';

// 默认 Gitee 更新源（releases 分支）。CI 会把 app-release.apk 与 update.json 同步到这里。
export const UPDATE_SOURCE = {
  name: 'Gitee',
  manifest: 'https://gitee.com/gzy3894/xiao-li-yang-ji/raw/releases/update.json',
  apk: 'https://gitee.com/gzy3894/xiao-li-yang-ji/raw/releases/app-release.apk'
};

export const CURRENT_VERSION_CODE = Number(appMeta.appVersionCode || 0);
export const CURRENT_VERSION_NAME = String(appMeta.version || '');

function withCacheBuster(url) {
  return url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
}

function normalizeUpdate(info, source = UPDATE_SOURCE) {
  if (!info || typeof info !== 'object') return null;
  const versionCode = Number(info.versionCode);
  if (!Number.isFinite(versionCode) || versionCode <= 0) return null;
  return {
    source: source.name,
    manifestUrl: source.manifest,
    versionCode,
    versionName: String(info.versionName || ''),
    url: String(info.url || source.apk),
    sha256: String(info.sha256 || ''),
    changelog: String(info.changelog || ''),
    forceUpdate: Boolean(info.forceUpdate),
    size: Number(info.size) || 0,
    currentVersionCode: CURRENT_VERSION_CODE,
    currentVersionName: CURRENT_VERSION_NAME
  };
}

export async function checkUpdate(source = UPDATE_SOURCE) {
  try {
    const info = await httpGetJson(withCacheBuster(source.manifest));
    return normalizeUpdate(info, source);
  } catch (e) {
    return { error: e && e.message ? e.message : String(e), source: source.name };
  }
}

export async function getAvailableUpdate(source = UPDATE_SOURCE) {
  const info = await checkUpdate(source);
  if (info && !info.error && info.versionCode > CURRENT_VERSION_CODE) return info;
  return info && info.error ? info : null;
}

export function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v >= 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + ' MB';
  if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
  return v + ' B';
}

export async function installUpdate(info, onProgress) {
  if (!info || !info.url) throw new Error('update url missing');
  if (!Capacitor.isNativePlatform()) {
    window.open(info.url, '_blank');
    return { opened: true };
  }

  let handle = null;
  if (typeof onProgress === 'function' && XiaoLiNative.addListener) {
    handle = await XiaoLiNative.addListener('updateDownloadProgress', (p) => {
      const received = Number(p.received) || 0;
      const total = Number(p.total) || 0;
      onProgress({
        received,
        total,
        done: Boolean(p.done),
        percent: total > 0 ? Math.round((received * 100) / total) : -1
      });
    });
  }

  try {
    return await XiaoLiNative.installApk({ url: info.url, sha256: info.sha256 || '' });
  } finally {
    if (handle && handle.remove) {
      try { await handle.remove(); } catch { /* ignore */ }
    }
  }
}

// 原生下载安装失败时的兜底：交给系统浏览器下载。
export async function installUpdateWithFallback(info, onProgress) {
  try {
    return await installUpdate(info, onProgress);
  } catch (e) {
    try { window.open(info.url, '_blank'); } catch { /* ignore */ }
    throw e;
  }
}
