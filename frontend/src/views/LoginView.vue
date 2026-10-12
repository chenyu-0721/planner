<template>
  <div class="min-h-full flex items-center justify-center bg-[#f3f2f1] px-4"
       style="background-image: radial-gradient(circle at 15% 20%, #dff0de 0, transparent 40%), radial-gradient(circle at 85% 80%, #dbe9f7 0, transparent 45%);">
    <div class="w-full max-w-[440px] bg-white card-shadow-hover px-11 py-10">
      <div class="flex items-center gap-2.5 mb-6">
        <img src="/favicon.svg" class="size-8" alt="" />
        <span class="text-xl font-semibold text-ink-2">Planner</span>
      </div>
      <h1 class="text-2xl font-semibold text-ink mb-1">登入</h1>
      <p class="text-sm text-ink-3 mb-6">使用你的帳戶繼續使用 Planner</p>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <input
            v-model="username"
            class="w-full h-9 border-0 border-b border-[#666] outline-none focus:border-accent focus:border-b-2 text-[15px] placeholder:text-ink-3"
            placeholder="帳號"
            autocomplete="username"
            autofocus
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            class="w-full h-9 border-0 border-b border-[#666] outline-none focus:border-accent focus:border-b-2 text-[15px] placeholder:text-ink-3"
            placeholder="密碼"
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>
        <div class="flex justify-end pt-4">
          <button type="submit" class="btn btn-primary !h-8 min-w-28 !rounded-none" :disabled="loading">
            {{ loading ? '登入中…' : '登入' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (!username.value || !password.value) {
    error.value = '請輸入帳號與密碼。';
    return;
  }
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.replace(route.query.redirect || '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
