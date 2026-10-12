import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/views/MainLayout.vue'),
    children: [
      { path: '', redirect: '/plans' },
      { path: 'myday', name: 'myday', component: () => import('@/views/MyDayView.vue') },
      { path: 'mytasks', name: 'mytasks', component: () => import('@/views/MyTasksView.vue') },
      { path: 'plans', name: 'plans', component: () => import('@/views/MyPlansView.vue') },
      { path: 'plans/:id/:view(board|grid|schedule|charts)?', name: 'plan', component: () => import('@/views/PlanView.vue') },
      { path: 'admin/users', name: 'admin-users', component: () => import('@/views/AdminUsersView.vue'), meta: { admin: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (to.name === 'login' && auth.isLoggedIn) return '/';
    return true;
  }
  if (!auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } };
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return { name: 'login' };
    }
  }
  if (to.meta.admin && !auth.isAdmin) return '/';
  return true;
});

export default router;
