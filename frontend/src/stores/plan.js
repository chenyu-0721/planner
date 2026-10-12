import { defineStore } from 'pinia';
import api from '@/api';
import { usePlansStore } from './plans';
import { useUiStore } from './ui';

// 看過的計劃暫存在記憶體：再次開啟時先立即顯示，背景再更新成最新資料
const cache = new Map();
const CACHE_LIMIT = 10;
let loadSeq = 0;

// 目前開啟的計劃（貯體、工作、成員）
export const usePlanStore = defineStore('plan', {
  state: () => ({
    plan: null,
    members: [],
    buckets: [],
    tasks: [],
    loading: false,
  }),
  getters: {
    memberMap: (s) => Object.fromEntries(s.members.map((m) => [m.id, m])),
    bucketMap: (s) => Object.fromEntries(s.buckets.map((b) => [b.id, b])),
    sortedBuckets: (s) => [...s.buckets].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  },
  actions: {
    apply(data) {
      this.plan = data.plan;
      this.members = data.members;
      this.buckets = data.buckets;
      this.tasks = data.tasks;
    },
    remember() {
      if (!this.plan) return;
      cache.delete(this.plan.id);
      cache.set(this.plan.id, {
        plan: this.plan, members: this.members, buckets: this.buckets, tasks: this.tasks,
      });
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    },
    async load(id) {
      const planId = Number(id);
      const seq = ++loadSeq;
      // 切換前把目前計劃（含尚未重新載入的修改）存起來
      if (this.plan && this.plan.id !== planId) this.remember();
      const cached = cache.get(planId);
      if (cached) this.apply(cached);
      this.loading = !cached;
      try {
        const data = await api.get(`/plans/${planId}`);
        if (seq !== loadSeq) return; // 已切換到別的計劃
        this.apply(data);
        this.remember();
        usePlansStore().patchLocal(planId, { lastViewedAt: new Date().toISOString() });
      } catch (e) {
        if (seq === loadSeq) cache.delete(planId);
        throw e;
      } finally {
        if (seq === loadSeq) this.loading = false;
      }
    },
    async ensure(id) {
      if (this.plan?.id !== Number(id)) await this.load(id);
    },
    async reload() {
      if (this.plan) await this.load(this.plan.id);
    },

    /* ---- 計劃 ---- */
    async updatePlan(data) {
      const res = await api.put(`/plans/${this.plan.id}`, data);
      Object.assign(this.plan, res);
      usePlansStore().patchLocal(this.plan.id, res);
    },
    async deletePlan() {
      const id = this.plan.id;
      await api.delete(`/plans/${id}`);
      usePlansStore().removeLocal(id);
      cache.delete(id);
      this.plan = null;
    },
    async togglePin() {
      const pinned = !this.plan.pinned;
      this.plan.pinned = pinned;
      await usePlansStore().setPinned(this.plan.id, pinned);
    },
    async addMember(userId) {
      const m = await api.post(`/plans/${this.plan.id}/members`, { userId });
      if (!this.members.find((x) => x.id === m.id)) this.members.push(m);
      usePlansStore().fetch();
    },
    async removeMember(userId) {
      await api.delete(`/plans/${this.plan.id}/members/${userId}`);
      this.members = this.members.filter((m) => m.id !== userId);
      this.tasks.forEach((t) => {
        t.assigneeIds = t.assigneeIds.filter((id) => id !== userId);
      });
      usePlansStore().fetch();
    },

    /* ---- 貯體 ---- */
    async createBucket(name) {
      const max = Math.max(0, ...this.buckets.map((b) => b.sortOrder));
      const b = await api.post(`/plans/${this.plan.id}/buckets`, { name, sortOrder: max + 1 });
      this.buckets.push(b);
      return b;
    },
    async updateBucket(id, data) {
      const b = this.buckets.find((x) => x.id === id);
      const old = { ...b };
      Object.assign(b, data);
      try {
        await api.put(`/buckets/${id}`, data);
      } catch (e) {
        Object.assign(b, old);
        throw e;
      }
    },
    async deleteBucket(id) {
      await api.delete(`/buckets/${id}`);
      this.buckets = this.buckets.filter((b) => b.id !== id);
      this.tasks = this.tasks.filter((t) => t.bucketId !== id);
    },

    /* ---- 工作 ---- */
    async createTask(data) {
      const task = await api.post(`/plans/${this.plan.id}/tasks`, data);
      this.tasks.push(task);
      useUiStore().emitTask('created', task);
      return task;
    },
    upsertLocal(task) {
      const i = this.tasks.findIndex((t) => t.id === task.id);
      if (i >= 0) this.tasks[i] = { ...this.tasks[i], ...task };
      else if (this.plan && task.planId === this.plan.id) this.tasks.push(task);
    },
    // 樂觀更新
    async updateTask(id, patch) {
      const local = this.tasks.find((t) => t.id === id);
      const backup = local ? { ...local } : null;
      if (local) {
        Object.assign(local, patch);
        if (patch.progress !== undefined) local.completedAt = patch.progress === 100 ? new Date().toISOString() : null;
      }
      try {
        const task = await api.put(`/tasks/${id}`, patch);
        this.upsertLocal(task);
        useUiStore().emitTask('updated', task);
        return task;
      } catch (e) {
        if (local && backup) Object.assign(local, backup);
        throw e;
      }
    },
    async deleteTask(id) {
      await api.delete(`/tasks/${id}`);
      const task = this.tasks.find((t) => t.id === id);
      this.tasks = this.tasks.filter((t) => t.id !== id);
      useUiStore().emitTask('deleted', task || { id });
    },
    async setMyDay(task, inMyDay) {
      await api.put(`/tasks/${task.id}/myday`, { inMyDay });
      const local = this.tasks.find((t) => t.id === task.id);
      if (local) local.inMyDay = inMyDay;
      useUiStore().emitTask('updated', { ...task, inMyDay });
    },
  },
});
