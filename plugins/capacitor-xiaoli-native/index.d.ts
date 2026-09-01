import { PluginListenerHandle } from '@capacitor/core';

export interface HttpGetResult {
  status: number;
  data: string;
}

export interface InstallApkResult {
  path: string;
}

export interface UpdateDownloadProgress {
  received: number;
  total: number;
  done: boolean;
}

export interface XiaoLiNativePlugin {
  get(options: { url: string; charset?: string; headers?: Record<string, string> }): Promise<HttpGetResult>;
  installApk(options: { url: string; sha256?: string }): Promise<InstallApkResult>;
  addListener(eventName: 'updateDownloadProgress', listenerFunc: (event: UpdateDownloadProgress) => void): Promise<PluginListenerHandle>;
}

export const XiaoLiNative: XiaoLiNativePlugin;
