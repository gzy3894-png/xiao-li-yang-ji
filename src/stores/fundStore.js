import { defineStore } from 'pinia';
import { loadWatchList, saveWatchList } from '../services/storage';
import { getFundsData, getIndices } from '../services/fundApi';
import { normalizeFundRows } from '../utils/calc';

const DEFAULT_INDICES = ['1.000001', '0.399001', '1.000300', '0.399006', '1.000688'];

export const useFundStore = defineStore('fund', {
  state: () => ({
    watchList: loadWatchList(),
    rows: [],
    indices: [],
    loading: false,
    lastError: ''
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
