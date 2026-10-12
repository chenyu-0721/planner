<template>
  <div class="flex-1 overflow-y-auto thin-scroll">
    <div class="max-w-[1280px] mx-auto px-4 sm:px-8 py-4 sm:py-6">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-xl sm:text-2xl font-semibold">我的計劃</h1>
        <button class="btn btn-primary" @click="ui.newPlanOpen = true">
          <Icon name="plus" :size="16" :stroke="2.2" />新增計劃
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-1 border-b border-line mb-4">
        <button v-for="t in tabs" :key="t.key"
                class="px-3 h-9 text-sm cursor-pointer -mb-px border-b-2"
                :class="tab === t.key ? 'border-brand font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'"
                @click="tab = t.key">
          {{ t.label }}
        </button>
        <div class="flex-1"></div>
        <div class="relative w-full sm:w-60 mb-2 sm:mb-1 order-first sm:order-none">
          <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input v-model="keyword" class="input !pl-8" placeholder="依名稱篩選" />
        </div>
      </div>

      <div v-if="!plans.loaded" class="py-16 text-center text-ink-3">載入中…</div>
      <div v-else-if="!shown.length" class="py-20 flex flex-col items-center text-center">
        <Icon name="plans" :size="48" class="text-ink-4 mb-3" :stroke="1.2" />
        <div class="text-lg font-semibold mb-1">{{ tab === 'pinned' ? '尚無釘選的計劃' : '還沒有任何計劃' }}</div>
        <p class="text-sm text-ink-3 mb-4">建立計劃來整理團隊的工作、追蹤進度。</p>
        <button v-if="tab !== 'pinned'" class="btn btn-primary" @click="ui.newPlanOpen = true">新增計劃</button>
      </div>

      <!-- 清單 -->
      <div v-else class="bg-white rounded-md card-shadow overflow-hidden">
        <div class="grid grid-cols-[minmax(0,1fr)_88px_40px] md:grid-cols-[minmax(0,1fr)_140px_160px_120px_48px] items-center h-10 px-3 sm:px-4 text-xs font-semibold text-ink-3 border-b border-line">
          <div>名稱</div>
          <div>進度</div>
          <div class="hidden md:block">上次檢視</div>
          <div class="hidden md:block">成員</div>
          <div></div>
        </div>
        <div
          v-for="p in shown"
          :key="p.id"
          class="group grid grid-cols-[minmax(0,1fr)_88px_40px] md:grid-cols-[minmax(0,1fr)_140px_160px_120px_48px] items-center h-14 px-3 sm:px-4 border-b border-line last:border-0 hover:bg-[#fafafa] cursor-pointer"
          @click="$router.push(`/plans/${p.id}`)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <PlanIcon :plan="p" :size="32" />
            <div class="min-w-0">
              <div class="font-semibold truncate">{{ p.name }}</div>
              <div class="text-xs text-ink-3 truncate">{{ p.description || (p.role === 'owner' ? '我擁有的計劃' : '我參與的計劃') }}</div>
            </div>
          </div>
          <div class="pr-2 md:pr-4">
            <div class="text-xs text-ink-3 mb-1">{{ p.completedCount }}/{{ p.taskCount }} 已完成</div>
            <div class="h-1.5 rounded bg-[#edebe9] overflow-hidden">
              <div class="h-full bg-done" :style="{ width: pct(p) + '%' }"></div>
            </div>
          </div>
          <div class="hidden md:block text-sm text-ink-3">{{ p.lastViewedAt ? fmtDateTime(p.lastViewedAt) : '—' }}</div>
          <div class="hidden md:flex text-sm text-ink-3 items-center gap-1"><Icon name="users" :size="14" />{{ p.memberCount }}</div>
          <button
            class="icon-btn"
            :class="p.pinned ? 'text-[#c19c00]' : 'touch-show opacity-0 group-hover:opacity-100'"
            :title="p.pinned ? '取消釘選' : '釘選'"
            @click.stop="plans.setPinned(p.id, !p.pinned)"
          >
            <svg v-if="p.pinned" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" /></svg>
            <Icon v-else name="star" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import PlanIcon from '@/components/PlanIcon.vue';
import { fmtDateTime } from '@/utils/planner';
import { usePlansStore } from '@/stores/plans';
import { useUiStore } from '@/stores/ui';

const plans = usePlansStore();
const ui = useUiStore();
const tabs = [
  { key: 'recent', label: '最近' },
  { key: 'pinned', label: '已釘選' },
  { key: 'mine', label: '我的計劃' },
];
const tab = ref('recent');
const keyword = ref('');

const shown = computed(() => {
  let list = tab.value === 'pinned' ? plans.pinned : tab.value === 'mine' ? plans.list.filter((p) => p.role === 'owner') : plans.recent;
  const kw = keyword.value.trim().toLowerCase();
  if (kw) list = list.filter((p) => p.name.toLowerCase().includes(kw));
  return list;
});
const pct = (p) => (p.taskCount ? Math.round((p.completedCount / p.taskCount) * 100) : 0);
</script>
