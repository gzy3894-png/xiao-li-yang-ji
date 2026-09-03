import { readFileSync, existsSync } from 'node:fs';
const checks = [];
function need(name, ok, detail = '') { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) console.error(`[FAIL-GATE] ${name} ${detail}`); }
const app = readFileSync('src/App.vue', 'utf8');
const router = readFileSync('src/router/index.js', 'utf8');
const home = readFileSync('src/views/HomeView.vue', 'utf8');
const search = readFileSync('src/views/SearchView.vue', 'utf8');
const style = readFileSync('src/style.css', 'utf8');
const fundApi = readFileSync('src/services/fundApi.js', 'utf8');
const calc = readFileSync('src/utils/calc.js', 'utf8');
const gradle = readFileSync('android/app/build.gradle', 'utf8');

need('android-back-listener', /CapacitorApp\.addListener\('backButton'/.test(app) || /App\.addListener\('backButton'/.test(app));
need('root-double-exit', /exitApp\(\)/.test(app) && /lastBackAt/.test(app));
need('position-route', /fund\/:code\/position/.test(router));
need('search-has-position-entry', /关注并持仓/.test(search) && /fund\/\$\{item\.code\}\/position/.test(search));
need('home-watch-holding-switch', /viewMode/.test(home) && /仅持仓/.test(home) && /全部关注/.test(home));
need('home-position-route-entry', /fund\/' \+ r\.code \+ '\/position/.test(home));
need('no-fundgz', !/fundgz\.1234567\.com\.cn/.test(fundApi), 'fundApi 仍引用 fundgz');
need('fundvaluationlast', /FundValuationLast/.test(fundApi) || /FundValuationLast/.test(readFileSync('src/services/valuation.js','utf8')));
need('sina-estimate', /FdFundService\.getEstimateNetworthPic/.test(readFileSync('src/services/valuation.js','utf8')));
need('nav-published-guard', /PDATE === latestTradeDate/.test(calc) && /GSZ null 不代表净值公布/.test(calc));
need('tokens-serif', /--brand:/.test(style) && /SimSun/.test(style) && /serif/.test(style));
need('glass-card', /\.card \{[\s\S]*backdrop-filter/.test(style));
need('glass-fallback', /@supports not/.test(style));
need('exit-tip-style', /\.exit-tip/.test(style));
need('reports-dir', existsSync('qa/reports/latest-estimate.json'));
need('android-version-env-injection', /APP_VERSION_CODE/.test(gradle) && /APP_VERSION_NAME/.test(gradle));

const failed = checks.filter((x) => !x.ok);
console.log(`static gates: ${checks.length - failed.length}/${checks.length} pass`);
if (failed.length) process.exit(1);
