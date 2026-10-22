import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

// 進行中的寫入（新增 / 修改 / 刪除）數量與最後一次寫入時間：自動同步時避免蓋掉自己剛做的變更
export const writes = { pending: 0, lastAt: 0 };
const isWrite = (config) => (config?.method || 'get').toLowerCase() !== 'get';
const writeDone = (config) => {
  if (!isWrite(config)) return;
  writes.pending = Math.max(0, writes.pending - 1);
  writes.lastAt = Date.now();
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('planner_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (isWrite(config)) writes.pending += 1;
  return config;
});

api.interceptors.response.use(
  (res) => {
    writeDone(res.config);
    return res.data;
  },
  (err) => {
    writeDone(err.config);
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || '發生錯誤';
    if (status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('planner_token');
      if (!location.pathname.startsWith('/login')) {
        location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`;
      }
    }
    return Promise.reject(Object.assign(new Error(message), { status }));
  },
);

export default api;
