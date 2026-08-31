# 小李养鸡 🐔

一个轻量的开源基金实时估值 Android App。**不依赖自有服务器**，数据直连东方财富公开接口，通过 GitHub Actions 云端构建 APK，并用 Gitee 作为国内直连更新通道。

## 功能

- 基金搜索：代码 / 名称 / 拼音首字母模糊搜索，批量添加
- 自选列表：实时估值、估算涨跌幅、估算净值，交易日每 60 秒自动刷新
- 指数行情：上证、深证、沪深300、创业板、科创50
- 收益计算：录入持有份额 / 成本价，自动计算当日估算收益、持有收益与收益率
- 基金详情：估值走势、净值走势、涨幅走势（ECharts）
- 持仓明细：前十大持仓股票
- 基金经理、基金基本信息
- 本地存储，数据导入导出能力预留
- 应用内检查更新：检测到新版本后下载并调起系统安装器安装（国内直连 Gitee）

## 技术栈

- Vue 3 + Vite + Pinia + Vue Router
- Capacitor 6（Android 原生壳）
- ECharts 5
- 自研本地 Capacitor 插件 `capacitor-xiaoli-native`：
  - `get(url)`：原生 HTTP GET，绕过 WebView CORS 限制
  - `installApk(url, sha256)`：下载 APK、SHA-256 校验、跳转系统安装器

## 目录结构

```
├── src/                 # Vue3 前端
│   ├── services/        # 基金接口 / 更新器 / 本地存储
│   ├── stores/          # Pinia
│   ├── views/           # 首页 / 搜索 / 详情
│   └── utils/           # 收益计算、格式化
├── plugins/capacitor-xiaoli-native/   # 本地原生插件
├── android/             # Android 工程（Capacitor）
└── .github/workflows/   # 云端构建流水线
```

## 云端构建

- 推送到 `main` → 自动构建 debug APK（Artifact）
- 打 `v*` 标签（如 `v0.1.0`）→ 构建签名 release APK、创建 GitHub Release，并推送到 Gitee `releases` 分支供国内更新

需要配置的 GitHub Secrets：

| Secret | 说明 |
|---|---|
| `KEYSTORE_BASE64` | Android 签名证书 base64 |
| `STORE_PASSWORD` / `KEY_PASSWORD` / `KEY_ALIAS` | 签名参数 |
| `GITEE_USER` / `GITEE_TOKEN` / `GITEE_REPO` | 国内更新通道 |

## 本地开发

```bash
npm install
npm run dev       # 浏览器开发（部分接口受 CORS 限制）
npm run build     # 构建 Web
npx cap sync android
cd android && ./gradlew assembleDebug
```

> 说明：开发模式的浏览器环境受 CORS 影响，搜索和部分详情接口可能失败，这是浏览器安全限制。打包到 Android 后由原生插件请求，不受影响。

## 数据来源与免责声明

行情与估值数据来自东方财富等第三方公开接口，接口随时可能调整或失效；本项目仅用于学习交流，不构成投资建议。基金盘中实时估值展示受政策监管趋势影响，请自行关注合规性。

## License

GPL-3.0
