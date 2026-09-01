import { defineStore } from 'pinia';
import { loadWatchList, saveWatchList, loadSettings, saveSettings } from '../services/storage';
import { getFundsData, getIndices } from '../services/fundApi';
import { normalizeFundRows } from '../utils/calc';
import { getPositionsCached, estimateFund } from '../services/estimate';
import { getStockQuotes } from '../services/quotes';

const DEFAULT_INDICES = ['1.000001', '0.399001', '1.000300', '0.399006', '1.000688'];
const DEFAULT_SETTINGS = { estimateSource: 'auto', quoteSource: 'auto' };

export const useFundStore = defineStore('fund', {
  state: () => ({
    watchList: loadWatchList(),
    rows: [],
    indices: [],
    loading: false,
    lastError: '',
    settings: { ...DEFAULT_SETTINGS, ...loadSettings() },
    quoteFeedback: ''
  }),
  getters: {
    totalMarketValue: (s) => Number(s.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)),
    totalTodayGains: (s) => Number(s.rows.reduce((sum, r) => sum + (Number(r.gains) || 0), 0).toFixed(2)),
    totalCostGains: (s) => Number(s.rows.reduce((sum, r) => sum + (Number(r.costGains) || 0), 0).toFixed(2))
  },
  actions: {
    async refresh() {
      this.loading = true;
      this.lastError = '';
      try {
        const [rows, indices] = await Promise.all([
          this.watchList.length ? this.fetchRows() : Promise.resolve([]),
          this.fetchIndices()
        ]);
        this.rows = rows;
        this.indices = indices;
        await this.applyEstimate();
      } catch (e) {
        this.lastError = e && e.message ? e.message : String(e);
      } finally {
        this.loading = false;
      }
    },
    async fetchRows() {
      const raw = await getFundsData(this.watchList.map((w) => w.code));
      return normalizeFundRows(raw, this.watchList);
    },
    async fetchIndices() {
      return getIndices(DEFAULT_INDICES);
    },
    // 智能估值：官方估值/真实净值优先；官方缺失时用持仓加权补齐。
    // em/tc/sina 表示强制使用指定行情源的持仓加权估值；tt 表示只展示天天基金官方估值。
    async applyEstimate() {
      const mode = this.settings.estimateSource || 'auto';
      if (mode === 'tt') {
        this.quoteFeedback = 'official';
        return;
      }
      const forceWeighted = ['em', 'tc', 'tencent', 'sina'].includes(mode);
      let feedback = '';
      await Promise.all(this.rows.map(async (row) => {
        try {
          // 当日真实净值公布后，永远不允许估算覆盖净值。
          if (row.hasReplace || row.estimateKind === 'nav') return;
          const hasOfficial = row.gsz !== null && row.gszzl !== null;
          if (mode === 'auto' && hasOfficial) return;
          if (mode !== 'auto' && !forceWeighted) return;

          const stocks = await getPositionsCached(row.code);
          if (!stocks.length) {
            row.estNone = true;
            return;
          }
          const quoteMode = mode === 'auto' ? 'auto' : mode;
          const { quotes, source } = await getStockQuotes(stocks, quoteMode);
          const est = estimateFund(stocks, quotes);
          const reliable = est && row.dwjz !== null && est.hitCoverage >= Math.max(10, est.coverage * 0.5);
          if (!reliable) {
            row.estNone = true;
            return;
          }
          row.estPct = est.pct;
          row.estNav = Number((row.dwjz * (1 + est.pct / 100)).toFixed(4));
          row.quoteSource = source;
          row.estimateKind = 'holding';
          row.gszzl = est.pct;
          row.gsz = row.estNav;
          row.gains = Number(((row.estNav - row.dwjz) * (Number(row.num) || 0)).toFixed(2));
          feedback = source;
        } catch { /* 单只失败不影响整体 */ }
      }));
      this.quoteFeedback = feedback;
      this.rows = [...this.rows];
    },
    setEstimateSource(src) {
      this.settings.estimateSource = src;
      saveSettings({ estimateSource: src });
      this.refresh();
    },
    addFund(item) {
      const idx = this.watchList.findIndex((w) => w.code === item.code);
      if (idx >= 0) {
        this.watchList[idx] = { ...this.watchList[idx], ...item };
      } else {
        this.watchList.push({ code: item.code, name: item.name, num: 0, cost: 0 });
      }
      saveWatchList(this.watchList);
      this.refresh();
    },
    removeFund(code) {
      this.watchList = this.watchList.filter((w) => w.code !== code);
      saveWatchList(this.watchList);
      this.rows = this.rows.filter((r) => r.code !== code);
    },
    updateHold(code, patch) {
      const idx = this.watchList.findIndex((w) => w.code === code);
      if (idx >= 0) {
        this.watchList[idx] = { ...this.watchList[idx], ...patch };
        saveWatchList(this.watchList);
        this.refresh();
      }
    },
    reorder(newList) {
      this.watchList = newList;
      saveWatchList(newList);
      this.rows = newList.map((w) => this.rows.find((r) => r.code === w.code)).filter(Boolean);
    }
  }
});
