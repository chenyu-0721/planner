<template>
  <header class="h-12 shrink-0 flex items-center bg-brand text-white pr-2 relative z-30">
    <!-- 手機：開啟側邊欄；桌面：應用程式選單 -->
    <button class="md:hidden size-12 flex items-center justify-center hover:bg-black/15" title="選單" @click="ui.navOpen = true">
      <Icon name="menu" :size="20" />
    </button>
    <button class="hidden md:flex size-12 items-center justify-center hover:bg-black/15" title="應用程式">
      <Icon name="waffle" :size="18" />
    </button>
    <router-link to="/plans" class="hidden sm:block px-2 text-base font-semibold tracking-tight hover:underline">Planner</router-link>

    <div class="flex-1 min-w-0 flex justify-center px-1 sm:px-4">
      <div class="relative w-full max-w-[468px]">
        <Icon name="search" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-brand" />
        <input
          v-model="keyword"
          class="w-full h-8 rounded bg-white/95 text-ink pl-9 pr-3 text-sm outline-none placeholder:text-ink-3 focus:bg-white"
          placeholder="搜尋計劃"
          @focus="searchOpen = true"
          @blur="onBlur"
          @keydown.enter="goFirst"
        />
        <div v-if="searchOpen && keyword" class="menu absolute left-0 right-0 top-9 max-h-80 overflow-auto thin-scroll text-ink">
          <div v-if="!results.length" class="px-3 py-2 text-sm text-ink-3">找不到符合的計劃</div>
          <button v-for="p in results" :key="p.id" class="menu-item" @mousedown.prevent="go(p)">
            <PlanIcon :plan="p" :size="22" />
            <span class="truncate">{{ p.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <Popover placement="bottom-end" close-on-click>
      <template #trigger>
        <button class="h-12 px-2 flex items-center hover:bg-black/15">
          <Avatar :user="auth.user" :size="32" />
        </button>
      </template>
      <div class="w-72 text-ink">
        <div class="flex items-center gap-3 px-4 py-4">
          <Avatar :user="auth.user" :size="56" />
          <div class="min-w-0">
            <div class="font-semibold truncate">{{ auth.user?.displayName }}</div>
            <div class="text-sm text-ink-3 truncate">{{ auth.user?.username }}</div>
            <div class="text-xs text-ink-4">{{ auth.isAdmin ? '系統管理員' : '一般會員' }}</div>
          </div>
        </div>
        <div class="border-t border-line my-1"></div>
        <button class="menu-item" @click="$emit('profile')"><Icon name="user" />我的帳戶</button>
        <router-link v-if="auth.isAdmin" to="/admin/users" class="menu-item"><Icon name="shield" />使用者管理</router-link>
        <button class="menu-item" @click="logout"><Icon name="logout" />登出</button>
      </div>
    </Popover>
  </header>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';
import Avatar from './Avatar.vue';
import Popover from './Popover.vue';
import PlanIcon from './PlanIcon.vue';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';

defineEmits(['profile']);
const auth = useAuthStore();
const ui = useUiStore();
const plans = usePlansStore();
const router = useRouter();
const keyword = ref('');
const searchOpen = ref(false);

const results = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return plans.list.filter((p) => p.name.toLowerCase().includes(kw)).slice(0, 10);
});

function go(p) {
  keyword.value = '';
  searchOpen.value = false;
  router.push(`/plans/${p.id}`);
}
function goFirst() {
  if (results.value[0]) go(results.value[0]);
}
function onBlur() {
  setTimeout(() => (searchOpen.value = false), 150);
}
function logout() {
  auth.logout();
  router.replace('/login');
}
</script>
