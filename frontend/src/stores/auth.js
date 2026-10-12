import { defineStore } from 'pinia';
import api from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('planner_token') || '',
    user: null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password });
      this.token = res.token;
      this.user = res.user;
      localStorage.setItem('planner_token', res.token);
    },
    async fetchMe() {
      this.user = await api.get('/auth/me');
      return this.user;
    },
    async updateProfile(data) {
      this.user = await api.put('/auth/me', data);
    },
    async changePassword(currentPassword, newPassword) {
      await api.put('/auth/me/password', { currentPassword, newPassword });
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('planner_token');
    },
  },
});
