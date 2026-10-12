import { defineStore } from 'pinia';
import api from '@/api';

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
    // 伺服器功能開關（/api/config）
    features: { fileUpload: false },
    // 手機版（< 768px）：側邊欄改為抽屜
    isMobile: window.matchMedia('(max-width: 767px)').matches,
    navOpen: false,
  }),
  actions: {
    watchViewport() {
      const mq = window.matchMedia('(max-width: 767px)');
      const update = () => {
        this.isMobile = mq.matches;
        if (!mq.matches) this.navOpen = false;
      };
      update();
      mq.addEventListener('change', update);
    },
    async loadConfig() {
      try {
        this.features = await api.get('/config');
      } catch {
        // 取不到設定時維持預設（不提供檔案上傳）
      }
    },
    toggleNav() {
      this.navCollapsed = !this.navCollapsed;
      localStorage.setItem('planner_nav', this.navCollapsed ? '1' : '0');
    },
    // initial：卡片上已有的資料，讓詳細資料視窗可以立即顯示
    openTask(task) {
      this.detail = { taskId: task.id, planId: task.planId, initial: task.title ? task : null };
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
