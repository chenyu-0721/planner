import { defineStore } from 'pinia';

let toastSeq = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    navCollapsed: localStorage.getItem('planner_nav') === '1',
    detail: null, // { taskId, planId }
    toasts: [],
    confirmState: null,
    newPlanOpen: false,
    // 工作變更通知，讓「我的工作 / 我的一天」同步更新
    taskEvent: null,
  }),
  actions: {
    toggleNav() {
      this.navCollapsed = !this.navCollapsed;
      localStorage.setItem('planner_nav', this.navCollapsed ? '1' : '0');
    },
    openTask(task) {
      this.detail = { taskId: task.id, planId: task.planId };
    },
    closeTask() {
      this.detail = null;
    },
    emitTask(type, task) {
      this.taskEvent = { type, task, at: Date.now() };
    },
    toast(message, type = 'info') {
      const id = ++toastSeq;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 3500);
    },
    error(err) {
      this.toast(err?.message || String(err), 'error');
    },
    confirm({ title, message, okText = '刪除', danger = true }) {
      return new Promise((resolve) => {
        this.confirmState = { title, message, okText, danger, resolve };
      });
    },
    resolveConfirm(ok) {
      this.confirmState?.resolve(ok);
      this.confirmState = null;
    },
  },
});
