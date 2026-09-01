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
    // 用持仓加权重新估值（替代/修正 DCF 官方 GSZ）
    async applyEstimate() {
      if (this.settings.estimateSource === 'tt') return; // 纯官方天天基金估值
      let feedback = '';
      await Promise.all(this.rows.map(async (row) => {
        try {
          const stocks = await getPositionsCached(row.code);
          if (!stocks.length) return;
          const { quotes, source } = await getStockQuotes(stocks, this.settings.estimateSource === 'auto' ? 'auto' : this.settings.estimateSource);
          const est = estimateFund(stocks, quotes);
          if (est !== null && row.dwjz !== null) {
            row.estPct = est.pct;
            row.estNav = Number((row.dwjz * (1 + est.pct / 100)).toFixed(4));
            row.quoteSource = source;
            // 用估值代替官方估算，重新计算收益
            row.gszzl = est.pct;
            row.gsz = row.estNav;
            row.gains = Number(((row.estNav - row.dwjz) * (Number(row.num) || 0)).toFixed(2));
            feedback = source;
          }
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
