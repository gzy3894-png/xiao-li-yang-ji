# 工作进度 · 小李养鸡

> 本文件用于落盘本轮工作。最新发版：`v0.2.0`（2026-09-01）；工作区修复版：`v0.2.1`（versionCode 4，待打 tag 发版）

## 1. 项目基础

| 项 | 值 |
|---|---|
| App 名 | 小李养鸡 |
| 包名 | com.xiaoli.yangji |
| GitHub | https://github.com/gzy3894-png/xiao-li-yang-ji （公开） |
| Gitee 更新通道 | https://gitee.com/gzy3894/xiao-li-yang-ji （公开，releases 分支） |
| 当前版本 | v0.2.0（versionCode 3） |
| 最新发布 | https://github.com/gzy3894-png/xiao-li-yang-ji/releases/tag/v0.2.0 |
| 签名证书 | 本地备份 `C:\Users\dell\xiaoli-keys\xiaoli-release.keystore`；GitHub Secrets 已存 `KEYSTORE_BASE64` / `KEY_ALIAS` / `KEY_PASSWORD` / `STORE_PASSWORD` |

## 2. 完成内容（按用户反馈逐项）

| 用户反馈 | 修复/实现 | 涉及的文件 |
|---|---|---|
| 版本号显示 1.0 | `android/app/build.gradle` 用 `APP_VERSION_CODE/NAME` 注入 | build.gradle + 2 个 workflow |
| 估值不准 + 无持有收益 | 新增**持仓加权估值**（持仓 × 实时股价加权），东财/腾讯/新浪三源可调，默认自动降级 | `services/estimate.js`, `services/quotes.js`, `views/HomeView.vue` |
| 持仓只显示名称 | 前十大持仓加**实时涨跌百分比**（红绿） | `views/DetailView.vue` |
| 无实时走势 | 新增「实时分时」Tab，交易时段每 30s 记录并画图 | `services/intraday.js` |
| 手动录份额麻烦 | **截图导入持仓**：支付宝基金截图 → 本地 OCR（chi_sim）→ 解析名称/份额/成本/金额→ 确认 | `services/ocr.js`, `views/ImportView.vue`, `public/tessdata/` |


## 2.1 本轮修复（v0.2.1 工作区）

- **估值源（重点）**：`getFundsData` 现在会先用东财 FundMNFInfo 拉官方估值；对缺少 `GSZ/GSZZL/GZTIME` 的基金自动用 `fundgz.1234567.com.cn` 天天基金估值逐个补齐。默认 **官方估值/真实净值优先**，只有官方缺失才用前十大持仓加权补齐；命中率不足时宁可显示 `--/暂无估值`，不再把 null 显示成 `+0.00%`。
- **估值公式修正**：持仓加权从 `Σ(w×pct)/Σ(w命中)` 改为 `Σ(w×pct)/100`，`JZBL` 口径为占基金净值百分比；未命中持仓按 0 处理，新增 `hitCoverage` 防误估。
- **行情源修复**：兼容设置值 `tc/tencent/tt`；新浪源补上 Referer headers；港股/北交所行情前缀做了兜底。
- **UI**：整套换成阿里云蓝科技风：蓝色渐变页底、透明玻璃磨砂卡、胶囊按钮/分段控件、响应式 `max-width`、标准宋体/衬线字体栈、数字等宽；首页新增蓝色更新 Banner 与设置里的在线更新面板。
- **在线更新**：默认 Gitee `releases` 分支源，去掉前端硬编码 versionCode（改读 package.json/appVersionCode），update.json 支持 `size/publishedAt`；App 内原生下载 APK、sha256 校验、下载进度回调并调起安装，失败降级为浏览器打开。
- **验证**：`npm run verify` 13 项通过；新增持仓加权公式与行情源别名回归用例；`npm run build` 通过。


## 2.2 v0.3.0 重做门禁（本轮执行）

- **数据源**：下线失效 `fundgz.1234567.com.cn`；新增 `FundValuationLast` 批量源，主动偏股缺失统一接新浪 `FdFundService.getEstimateNetworthPic`（ds3 优先、ds2 兜底）。
- **净值状态机**：`PDATE == latestTradeDate` 才允许视为净值已公布；`GSZ null` 不再触发“收盘净值已公布”的假阳性；货币/QDII/无源显示 `--`，不再显示 `0.00%`。
- **门禁命令**：`npm run qa:static`、`npm run qa:fund-oracle` 已加入；`qa/reports/latest-estimate.json` 为最新落盘对账。
- **导航**：新增 `@capacitor/app` 的 `backButton` 监听；子页返回，根页二次确认退出；新增 `/fund/:code/position` 独立持仓编辑页；搜索支持“关注 / 关注并持仓”；首页支持“全部关注 / 仅持仓”。
- **当前待关机门**：本机 Gradle 下载受 GitHub/Gradle 网络重试影响失败，Android 真机构建走 Actions 验证；未过发布门禁前不得再打 tag 覆盖 Gitee 更新源。

> 紧急热修：`v0.3.1` 移除 `android/app/build.gradle` 中新增的 package.json 兜底读取，构建配置严格对齐已证明可安装的历史工作流；版本 versionName 仍由 CI 环境变量注入。

## 3. 技术架构变更

- **数据请求**：全部走自研本地 Capacitor 插件 `capacitor-xiaoli-native`（原生 HttpURLConnection，绕过 WebView CORS，支持 GBK 字符集）。
- **估值逻辑**（`src/services/estimate.js#estimateFund`）：
  `估值涨幅 = Σ(持仓占比 × 个股实时涨幅) / Σ(持仓占比)`，覆盖率 = 前十大持仓占比之和。
- **行情源**：
  - 东财 `push2.eastmoney.com/api/qt/stock/get`（逐只，已验证）
  - 腾讯 `qt.gtimg.cn`（批量，GBK 编码）
  - 新浪 `hq.sinajs.cn`（GBK，需 Referer）
  - 指数主源也是东财，失败自动切腾讯
- **天天基金/东财估值已公布的判定**：`PDATE == GZTIME.substr(0,10)` 或 `GSZ/GSZZL/GZTIME` 全 null → 用实际净值与真实涨跌展示。

## 4. 验证记录

每次发版前必须跑：

```
npm run verify
```

当前通过项（11 项，覆盖 v0.2.0 所有接口与计算）：
1. `searchFunds` 搜索基金
2. `getIndices` 指数行情（腾讯降级生效）
3. `getFundsData` 自选估值快照
4. `normalizeFundRows` 计算与收盘 null 兼容
5. `getFundBaseInfo` 基本信息
6. `getManagerList` 基金经理
7. `getPositions` 前十大持仓
8. `getValuationTrend` 官方估值（收盘后为 null，已兼容）
9. `getYieldTrend` 涨幅走势
10. `getNavTrend` 净值走势
11. **持仓加权估值端到端**：持仓（JGCL）→ 行情源 → `estimateFund`，返回 estimatePct/coverage

另外做了 headless Chrome 冒烟测试：`http://localhost:4173/` 与 `#/fund/110022` 均能渲染页面结构 + 真实指数数据。

产物一致性：v0.2.0 GitHub APK sha256 = `58a18565041695a1...` == Gitee `update.json.sha256` ✔

## 5. 本轮修复的坑（留给下次别踩）

- `NODE_ENV=production` 会剪 devDependencies（出现 vite/esbuild 缺失）→ 装 dev 包记得 `npm install --include=dev`
- 本机 `git push` 对 GitHub 极不稳定（connection reset/timeout），用 `scripts/api-push.mjs`（GitHub REST API 提交 blobs → tree → commit → 更新 ref），配合 `gh api` 打 tag
- 发布工作流必须有 `permissions: contents: write`，否则不能创建 Release
- Bash heredoc 太长会截断文件 → 大 Vue 文件分 `cat > + cat >>` 多段写
- Android 构建报 “Value is null” 是 Groovy `as int` 版本注入写法 → 改 `(System.getenv(...) ?: '1').toInteger()`
- Capacitor 插件的 AndroidManifest 会**合并进 App**，别重复声明 `${applicationId}.fileprovider`（App 模板已带）
- GitHub Actions `gradlew` 没执行权限 → 用 `bash gradlew`，不要 `./gradlew`

## 6. 遗留/已知限制

- [ ] App 图标还是 Capacitor 默认（需要设计和生成各分辨率图标）
- [ ] iOS 版未做（GitHub Actions macos runner 成本 + 签名证书问题）
- [ ] OCR 准确率依赖截图清晰度；名称 → 基金代码靠 `searchFunds` 首匹配，用户需核对
- [ ] 分时走势仅在 App 前台时采集，离开就停（涨跌宝等亦如此）
- [ ] 「设置」里的暗色模式还没实现
- [ ] 自己搭建多用户同步账户服务暂不支持（无自有服务器约束）

## 7. 发新版的 SOP

```
# 1. 改版本号
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.version='0.2.1';p.appVersionCode=4;fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
# 2. 同步 updater.js 里的 CURRENT_VERSION_CODE
# 3. 发版前验证
npm run verify
# 4. 本地提交 + API 推送 + 打tag
git add -A && git commit -m "..."
node scripts/api-push.mjs "commit message" <变更文件...>
SHA=$(gh api repos/gzy3894-png/xiao-li-yang-ji/git/ref/heads/main -q .object.sha)
gh api -X POST repos/gzy3894-png/xiao-li-yang-ji/git/refs -f "ref=refs/tags/v0.2.1" -f "sha=$SHA"
# 5. 等 Actions 跑完 release，核对 Gitee update.json
```

## 8. 本机环境

- Node 24.15 / npm 11 / Java 21 / keytool / Python 3.12 / gh 2.96 （已登录 gzy3894-png)
- 本机 Git push git+https 对 github.com 不稳定；数据接口对住宅 IP 可用，GitHub Actions 同样可
- APK 逆向/签名指纹查询：`keytool -list -v -keystore C:\Users\dell\xiaoli-keys\xiaoli-release.keystore -storepass <密码>`
