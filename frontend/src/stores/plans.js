import { defineStore } from 'pinia';
import api from '@/api';

// 使用者參與的計劃清單（側邊欄、計劃中心）
export const usePlansStore = defineStore('plans', {
  state: () => ({
    list: [],
    loaded: false,
    users: [],
  }),
  getters: {
    pinned: (s) => s.list.filter((p) => p.pinned).sort((a, b) => a.name.localeCompare(b.name)),
    recent: (s) => [...s.list].sort((a, b) => new Date(b.lastViewedAt || 0) - new Date(a.lastViewedAt || 0)),
  },
  actions: {
    async fetch() {
      this.list = await api.get('/plans');
      this.loaded = true;
    },
    async fetchUsers() {
      this.users = await api.get('/users');
      return this.users;
    },
    async create(data) {
      const plan = await api.post('/plans', data);
      await this.fetch();
      return plan;
    },
    async setPinned(planId, pinned) {
      const p = this.list.find((x) => x.id === planId);
      if (p) p.pinned = pinned;
      await api.put(`/plans/${planId}/pin`, { pinned });
    },
    patchLocal(planId, data) {
      const p = this.list.find((x) => x.id === planId);
      if (p) Object.assign(p, data);
    },
    removeLocal(planId) {
      this.list = this.list.filter((p) => p.id !== planId);
    },
  },
});
