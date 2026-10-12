<template>
  <div class="flex-1 min-h-0 flex">
    <div class="flex-1 min-w-0 overflow-y-auto thin-scroll">
      <div class="max-w-[960px] mx-auto px-8 py-6">
        <div class="flex items-center gap-3 mb-1">
          <Icon name="sun" :size="28" class="text-[#ca5010]" />
          <h1 class="text-2xl font-semibold">我的一天</h1>
        </div>
        <p class="text-sm text-ink-3 mb-6 ml-10">{{ fmtLong(date) }}</p>

        <div v-if="loading && !loaded" class="py-16 text-center text-ink-3">載入中…</div>
        <template v-else>
          <div v-if="!tasks.length" class="bg-white rounded-md card-shadow py-14 flex flex-col items-center text-center">
            <svg width="96" height="96" viewBox="0 0 96 96" class="mb-3">
              <circle cx="48" cy="48" r="20" fill="#fde5ad" />
              <circle cx="48" cy="48" r="13" fill="#eaa300" />
              <g stroke="#eaa300" stroke-width="3" stroke-linecap="round">
                <path d="M48 12v8M48 76v8M12 48h8M76 48h8M22.5 22.5l5.7 5.7M67.8 67.8l5.7 5.7M22.5 73.5l5.7-5.7M67.8 28.2l5.7-5.7" />
              </g>
            </svg>
            <div class="text-lg font-semibold mb-1">專注於今天</div>
            <p class="text-sm text-ink-3 max-w-sm">從右側的建議或任何工作卡片的「…」選單，將工作新增至「我的一天」。「我的一天」會在每天結束時清除。</p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TaskCard v-for="t in tasks" :key="t.id" :task="t" show-plan />
          </div>
        </template>
      </div>
    </div>

    <!-- 建議 -->
    <aside class="w-[320px] shrink-0 border-l border-line bg-[#fafafa] flex flex-col">
      <div class="px-4 h-14 flex items-center gap-2 shrink-0">
        <Icon name="info" :size="16" class="text-ink-3" />
        <span class="font-semibold">建議</span>
      </div>
      <p class="px-4 text-xs text-ink-3 mb-2">指派給你、今天到期或已逾期的工作。</p>
      <div class="flex-1 overflow-y-auto thin-scroll px-3 pb-4 space-y-2">
        <div v-for="t in suggestions" :key="t.id" class="relative group/sg">
          <TaskCard :task="t" show-plan />
          <button
            class="absolute right-2 bottom-2 btn btn-default !h-7 !px-2 text-xs opacity-0 group-hover/sg:opacity-100"
            @click.stop="add(t)"
          >
            <Icon name="plus" :size="14" />加入
          </button>
        </div>
        <div v-if="!suggestions.length" class="text-center text-xs text-ink-4 py-10">目前沒有建議的工作</div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Icon from '@/components/Icon.vue';
import TaskCard from '@/components/TaskCard.vue';
import api from '@/api';
import { fmtLong, todayStr } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTaskRefresh } from '@/composables/useTaskRefresh';

const planStore = usePlanStore();
const ui = useUiStore();
const tasks = ref([]);
const suggestions = ref([]);
const date = ref(todayStr());
const loading = ref(false);
const loaded = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/me/myday');
    tasks.value = res.tasks;
    suggestions.value = res.suggestions;
    date.value = res.date;
    loaded.value = true;
  } catch (e) {
    ui.error(e);
  } finally {
    loading.value = false;
  }
}

async function add(t) {
  try {
    await planStore.setMyDay(t, true);
  } catch (e) {
    ui.error(e);
  }
}

load();
useTaskRefresh(load);
</script>
