export interface HttpGetResult {
  status: number;
  data: string;
}

export interface InstallApkResult {
  path: string;
}

export interface XiaoLiNativePlugin {
  get(options: { url: string; charset?: string }): Promise<HttpGetResult>;
  installApk(options: { url: string; sha256?: string }): Promise<InstallApkResult>;
}

export const XiaoLiNative: XiaoLiNativePlugin;
