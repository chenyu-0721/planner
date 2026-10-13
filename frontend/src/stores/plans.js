import { defineStore } from 'pinia';
import api from '@/api';

// 側欄順序：依自己拖曳的 sortOrder；還沒排過的（例如剛被加入的計劃）放最前面
const byOrder = (a, b) => (a.sortOrder ?? -Infinity) - (b.sortOrder ?? -Infinity) || a.name.localeCompare(b.name);

// 使用者參與的計劃清單（側邊欄、計劃中心）
export const usePlansStore = defineStore('plans', {
  state: () => ({
    list: [],
    loaded: false,
    users: [],
  }),
  getters: {
    pinned: (s) => s.list.filter((p) => p.pinned).sort(byOrder),
    others: (s) => s.list.filter((p) => !p.pinned).sort(byOrder),
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
    // 拖曳後的新位置（拖到另一區時同時改釘選）
    async move(planId, sortOrder, pinned) {
      const p = this.list.find((x) => x.id === planId);
      if (!p) return;
      const backup = { sortOrder: p.sortOrder, pinned: p.pinned };
      Object.assign(p, { sortOrder, pinned });
      try {
        await api.put(`/plans/${planId}/position`, { sortOrder, pinned });
      } catch (e) {
        Object.assign(p, backup);
        throw e;
      }
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
