<template>
  <div class="w-80">
    <div class="px-3 pt-2 pb-1 text-sm font-semibold">成員（{{ planStore.members.length }}）</div>
    <div class="px-3 pb-2">
      <input v-model="keyword" class="input" placeholder="輸入名稱以新增成員" />
      <div v-if="keyword" class="mt-1 border border-line rounded max-h-48 overflow-y-auto thin-scroll">
        <button v-for="u in candidates" :key="u.id" class="menu-item !h-10" @click="add(u)">
          <Avatar :user="u" :size="26" />
          <span class="flex-1 truncate">{{ u.displayName }} <span class="text-ink-4 text-xs">{{ u.username }}</span></span>
          <Icon name="plus" :size="14" class="text-accent" />
        </button>
        <div v-if="!candidates.length" class="px-3 py-2 text-sm text-ink-3">找不到可新增的使用者</div>
      </div>
    </div>
    <div class="max-h-72 overflow-y-auto thin-scroll border-t border-line pt-1">
      <div v-for="m in planStore.members" :key="m.id" class="group/m flex items-center gap-2.5 px-3 h-11 hover:bg-hover">
        <Avatar :user="m" :size="30" />
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">{{ m.displayName }}</div>
          <div class="text-xs text-ink-4">{{ m.planRole === 'owner' ? '擁有者' : '成員' }}</div>
        </div>
        <button
          v-if="m.planRole !== 'owner' && (planStore.plan?.canManage || m.id === auth.user?.id)"
          class="icon-btn !size-7 opacity-0 group-hover/m:opacity-100"
          :title="m.id === auth.user?.id ? '離開計劃' : '從計劃移除'"
          @click="remove(m)"
        >
          <Icon name="x" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import { usePlanStore } from '@/stores/plan';
import { usePlansStore } from '@/stores/plans';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const planStore = usePlanStore();
const plans = usePlansStore();
const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const keyword = ref('');

const candidates = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const ids = new Set(planStore.members.map((m) => m.id));
  return plans.users.filter((u) => !ids.has(u.id)
    && (u.displayName.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw)));
});

async function add(u) {
  try {
    await planStore.addMember(u.id);
    keyword.value = '';
    ui.toast(`已將 ${u.displayName} 新增至計劃`, 'success');
  } catch (e) {
    ui.error(e);
  }
}

async function remove(m) {
  const self = m.id === auth.user?.id;
  const ok = await ui.confirm({
    title: self ? '離開計劃' : '移除成員',
    message: self ? '確定要離開此計劃嗎？' : `確定要將 ${m.displayName} 從計劃中移除嗎？其工作指派也會一併移除。`,
    okText: self ? '離開' : '移除',
  });
  if (!ok) return;
  try {
    await planStore.removeMember(m.id);
    if (self) router.push('/plans');
  } catch (e) {
    ui.error(e);
  }
}
</script>
