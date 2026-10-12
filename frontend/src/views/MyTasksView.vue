<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="bg-white border-b border-line shrink-0 px-6 pt-4">
      <div class="flex items-center gap-3 mb-2">
        <Icon name="circle-check" :size="26" class="text-brand" />
        <h1 class="text-xl font-semibold">我的工作</h1>
        <span class="text-sm text-ink-3">指派給我的工作</span>
      </div>
      <div class="flex items-end gap-1">
        <button v-for="v in views" :key="v.key"
                class="flex items-center gap-1.5 px-2.5 h-10 text-sm border-b-[3px] -mb-px cursor-pointer"
                :class="view === v.key ? 'border-brand font-semibold' : 'border-transparent text-ink-2 hover:bg-hover rounded-t'"
                @click="view = v.key">
          <Icon :name="v.icon" :size="16" />{{ v.label }}
        </button>
        <div class="flex-1"></div>
        <div class="flex items-center gap-2 pb-1">
          <div class="relative w-52">
            <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input v-model="keyword" class="input !pl-8" placeholder="依關鍵字篩選" />
          </div>
          <select v-model="status" class="input select !w-28">
            <option value="open">未完成</option>
            <option value="done">已完成</option>
            <option value="all">全部</option>
          </select>
          <select v-if="view === 'board'" v-model="groupBy" class="input select !w-36">
            <option value="progress">群組：進度</option>
            <option value="due">群組：到期日</option>
            <option value="plan">群組：計劃</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading && !loaded" class="py-16 text-center text-ink-3">載入中…</div>

    <!-- 清單 -->
    <div v-else-if="view === 'list'" class="flex-1 min-h-0 overflow-auto thin-scroll px-6 py-4">
      <div class="bg-white rounded-md card-shadow min-w-[860px]">
        <div class="grid grid-cols-[44px_minmax(220px,2fr)_minmax(160px,1.2fr)_minmax(110px,1fr)_110px_100px_110px] items-center h-10 pr-3 text-xs font-semibold text-ink-3 border-b border-line">
          <div></div><div>工作名稱</div><div>計劃</div><div>貯體</div><div>進度</div><div>優先順序</div><div>到期日</div>
        </div>
        <div v-if="!filtered.length" class="py-12 text-center text-sm text-ink-3">沒有工作</div>
        <div v-for="t in filtered" :key="t.id"
             class="grid grid-cols-[44px_minmax(220px,2fr)_minmax(160px,1.2fr)_minmax(110px,1fr)_110px_100px_110px] items-center h-11 pr-3 text-sm border-b border-line last:border-0 hover:bg-[#fafafa]">
          <button class="flex justify-center cursor-pointer" @click="update(t, { progress: t.progress === 100 ? 0 : 100 })">
            <ProgressIcon :value="t.progress === 100 ? 100 : 0" :size="18" />
          </button>
          <button class="truncate text-left hover:underline cursor-pointer pr-3" :class="t.progress === 100 ? 'line-through text-ink-3' : ''" @click="ui.openTask(t)">{{ t.title }}</button>
          <router-link :to="`/plans/${t.planId}`" class="flex items-center gap-2 min-w-0 hover:underline pr-3">
            <PlanIcon :plan="t.plan" :size="20" /><span class="truncate">{{ t.plan?.name }}</span>
          </router-link>
          <span class="truncate text-ink-2 pr-3">{{ t.bucket?.name }}</span>
          <span class="flex items-center gap-1.5 text-ink-2"><ProgressIcon :value="t.progress" :size="14" />{{ progressLabel(t.progress) }}</span>
          <span class="flex items-center gap-1.5 text-ink-2"><span class="w-3.5 flex justify-center"><PriorityIcon :value="t.priority" show-medium /></span>{{ priorityLabel(t.priority) }}</span>
          <span :class="isLate(t) ? 'text-[#c50f1f] font-semibold' : 'text-ink-2'">{{ t.dueDate ? fmtShort(t.dueDate) : '' }}</span>
        </div>
      </div>
    </div>

    <!-- 面板 -->
    <div v-else class="flex-1 min-h-0 overflow-x-auto thin-scroll">
      <div class="h-full flex items-start gap-3 px-6 pt-4 w-max">
        <section v-for="col in columns" :key="col.key" class="w-[284px] h-full flex flex-col shrink-0">
          <header class="flex items-center gap-2 h-10 px-1 shrink-0">
            <ProgressIcon v-if="groupBy === 'progress'" :value="col.ref" :size="16" />
            <PlanIcon v-if="groupBy === 'plan'" :plan="col.plan" :size="20" />
            <h3 class="flex-1 truncate text-sm font-semibold" :class="col.ref === 'late' ? 'text-[#c50f1f]' : ''">
              {{ col.title }} <span class="font-normal text-ink-4">{{ col.tasks.length }}</span>
            </h3>
          </header>
          <div class="flex-1 min-h-0 overflow-y-auto thin-scroll -mx-1 px-1 pb-6">
            <draggable
              :model-value="col.tasks"
              item-key="id"
              :group="{ name: 'mytasks', put: col.canDrop !== false }"
              class="flex flex-col gap-2 min-h-16"
              ghost-class="drag-ghost"
                :force-fallback="true"
                :fallback-on-body="true"
                fallback-class="drag-fallback"
              :animation="150"
              :disabled="groupBy === 'plan'"
              @change="(e) => onChange(e, col)"
            >
              <template #item="{ element }">
                <TaskCard :task="element" :show-plan="groupBy !== 'plan'" />
              </template>
            </draggable>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import Icon from '@/components/Icon.vue';
import PlanIcon from '@/components/PlanIcon.vue';
import TaskCard from '@/components/TaskCard.vue';
import ProgressIcon from '@/components/ProgressIcon.vue';
import PriorityIcon from '@/components/PriorityIcon.vue';
import api from '@/api';
import {
  PROGRESS, DUE_GROUPS, dueCategory, dateForDueCategory, fmtShort, isLate, progressLabel, priorityLabel, bySort,
} from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';
import { useTaskRefresh } from '@/composables/useTaskRefresh';

const planStore = usePlanStore();
const ui = useUiStore();

const views = [{ key: 'list', label: '清單', icon: 'grid' }, { key: 'board', label: '面板', icon: 'board' }];
const view = ref(localStorage.getItem('planner_mytasks_view') || 'list');
const groupBy = ref('progress');
const status = ref('open');
const keyword = ref('');
const tasks = ref([]);
const loading = ref(false);
const loaded = ref(false);
watch(view, (v) => localStorage.setItem('planner_mytasks_view', v));

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return tasks.value
    .filter((t) => (status.value === 'open' ? t.progress !== 100 : status.value === 'done' ? t.progress === 100 : true))
    .filter((t) => !kw || t.title.toLowerCase().includes(kw))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || bySort(a, b));
});

const columns = computed(() => {
  const list = filtered.value;
  if (groupBy.value === 'due') {
    return DUE_GROUPS.map((g) => ({
      key: g.key, ref: g.key, title: g.label, canDrop: g.key !== 'late',
      tasks: list.filter((t) => dueCategory(t) === g.key),
      patch: { dueDate: dateForDueCategory(g.key) },
    }));
  }
  if (groupBy.value === 'plan') {
    const map = new Map();
    list.forEach((t) => {
      if (!map.has(t.planId)) map.set(t.planId, { key: t.planId, title: t.plan?.name, plan: t.plan, tasks: [] });
      map.get(t.planId).tasks.push(t);
    });
    return [...map.values()];
  }
  return PROGRESS
    .filter((p) => status.value === 'all' || (status.value === 'done' ? p.value === 100 : p.value !== 100))
    .map((p) => ({
      key: p.value, ref: p.value, title: p.label,
      tasks: list.filter((t) => t.progress === p.value),
      patch: { progress: p.value },
    }));
});

async function load() {
  loading.value = true;
  try {
    tasks.value = await api.get('/me/tasks');
    loaded.value = true;
  } catch (e) {
    ui.error(e);
  } finally {
    loading.value = false;
  }
}

async function update(t, patch) {
  Object.assign(t, patch);
  try {
    await planStore.updateTask(t.id, patch);
  } catch (e) {
    ui.error(e);
    load();
  }
}

function onChange(e, col) {
  if (e.added && col.patch) update(e.added.element, { ...col.patch });
}

load();
useTaskRefresh(load);
</script>
