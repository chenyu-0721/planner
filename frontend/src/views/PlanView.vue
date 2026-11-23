<template>
  <div v-if="error" class="flex-1 flex flex-col items-center justify-center text-center p-8">
    <Icon name="lock" :size="44" class="text-ink-4 mb-3" :stroke="1.3" />
    <div class="text-lg font-semibold mb-1">無法開啟此計劃</div>
    <p class="text-sm text-ink-3 mb-4">{{ error }}</p>
    <router-link to="/plans" class="btn btn-primary">回到我的計劃</router-link>
  </div>

  <div v-else-if="!plan" class="flex-1 flex items-center justify-center text-ink-3">載入中…</div>

  <template v-else>
    <!-- 計劃標頭 -->
    <div class="bg-white border-b border-line shrink-0">
      <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 pt-3">
        <PlanIcon :plan="plan" :size="36" />
        <div class="min-w-0 flex items-center gap-1">
          <input
            v-if="editingName"
            v-model="nameDraft"
            v-focus
            class="input !h-8 text-lg font-semibold w-44 sm:w-72"
            maxlength="100"
            @keydown.enter="$event.target.blur()"
            @keydown.esc="editingName = false"
            @blur="saveName"
          />
          <h1 v-else class="text-base sm:text-lg font-semibold truncate px-1 rounded hover:bg-hover cursor-text" title="重新命名計劃" @click="startEditName">{{ plan.name }}</h1>
          <button v-if="plan.isMember" class="icon-btn" :class="plan.pinned ? 'text-[#c19c00]' : ''" :title="plan.pinned ? '取消釘選' : '釘選此計劃'" @click="planStore.togglePin()">
            <svg v-if="plan.pinned" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" /></svg>
            <Icon v-else name="star" :size="16" />
          </button>
          <Popover close-on-click>
            <template #trigger>
              <button class="icon-btn" title="更多選項"><Icon name="more" :size="18" /></button>
            </template>
            <button class="menu-item" @click="openSettings('general')"><Icon name="settings" />計劃設定</button>
            <button class="menu-item" @click="openSettings('labels')"><Icon name="tag" />編輯標籤</button>
            <button class="menu-item" @click="exportCsv"><Icon name="upload" />將計劃匯出為 CSV</button>
            <div class="border-t border-line my-1"></div>
            <button v-if="plan.isMember && plan.ownerId !== auth.user?.id" class="menu-item" @click="leave"><Icon name="door" />離開計劃</button>
            <button v-if="plan.canManage" class="menu-item !text-[#c50f1f]" @click="removePlan"><Icon name="trash" />刪除計劃</button>
          </Popover>
        </div>

        <!-- 進度摘要（電腦版） -->
        <div v-if="stats.total" class="hidden lg:flex items-center gap-2.5 ml-2 text-xs text-ink-3 shrink-0">
          <div class="w-24 h-1.5 rounded-full bg-[#edebe9] overflow-hidden" :title="`已完成 ${stats.done}/${stats.total}`">
            <div class="h-full bg-done transition-all" :style="{ width: `${stats.pct}%` }"></div>
          </div>
          <span>完成 {{ stats.pct }}%</span>
          <span v-if="stats.late" class="text-[#c50f1f] font-semibold">{{ stats.late }} 個逾期</span>
        </div>

        <div class="flex-1"></div>

        <!-- 計劃內搜尋 -->
        <div v-if="!ui.isMobile" class="relative w-44 lg:w-56">
          <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input v-model="filters.keyword" class="input !h-8 !pl-8 !pr-7" placeholder="搜尋工作" />
          <button v-if="filters.keyword" class="absolute right-1 top-1/2 -translate-y-1/2 icon-btn !size-6" title="清除" @click="filters.keyword = ''"><Icon name="x" :size="12" /></button>
        </div>
        <button v-else class="icon-btn" :class="searchOpen || filters.keyword ? 'text-accent' : ''" title="搜尋工作" @click="toggleSearch"><Icon name="search" :size="18" /></button>

        <Popover placement="bottom-end">
          <template #trigger>
            <button class="flex items-center gap-2 h-8 px-2 rounded hover:bg-hover cursor-pointer" title="成員">
              <div class="hidden sm:flex -space-x-1.5">
                <Avatar v-for="m in planStore.members.slice(0, 4)" :key="m.id" :user="m" :size="26" ring />
              </div>
              <span v-if="planStore.members.length > 4" class="hidden sm:inline text-xs text-ink-3">+{{ planStore.members.length - 4 }}</span>
              <Icon name="user-plus" :size="16" class="text-ink-2" />
            </button>
          </template>
          <MembersPanel />
        </Popover>
      </div>

      <div class="flex items-end gap-1 px-2 sm:px-5 mt-1 overflow-x-auto no-scrollbar">
        <router-link
          v-for="v in views"
          :key="v.key"
          :to="`/plans/${plan.id}/${v.key}`"
          class="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2 sm:px-2.5 h-10 text-sm border-b-[3px] -mb-px"
          :class="view === v.key ? 'border-brand font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink hover:bg-hover rounded-t'"
        >
          <Icon :name="v.icon" :size="16" />{{ v.label }}
        </router-link>

        <div class="flex-1"></div>

        <div v-if="!ui.isMobile" class="shrink-0 flex items-center gap-1 pb-1">
          <Popover placement="bottom-end">
            <template #trigger>
              <button class="btn btn-ghost" :class="filterCount ? '!text-accent !font-semibold' : ''">
                <Icon name="filter" :size="16" /><span class="hidden sm:inline">篩選</span><template v-if="filterCount"> ({{ filterCount }})</template>
              </button>
            </template>
            <FilterPanel v-model="filters" :members="planStore.members" :buckets="planStore.sortedBuckets" :label-names="plan.labelNames" />
          </Popover>
          <button v-if="filterCount" class="icon-btn !size-7" title="清除篩選" @click="clearFilters"><Icon name="x" :size="14" /></button>

          <Popover v-if="view === 'board'" placement="bottom-end" close-on-click>
            <template #trigger>
              <button class="btn btn-ghost !px-2 sm:!px-3"><Icon name="group" :size="16" /><span class="hidden lg:inline">群組依據：</span><span class="hidden sm:inline">{{ groupLabel }}</span><Icon name="chevron-down" :size="14" /></button>
            </template>
            <button v-for="g in GROUP_OPTIONS" :key="g.key" class="menu-item" @click="groupBy = g.key">
              <span class="w-4"><Icon v-if="groupBy === g.key" name="check" :size="15" class="text-accent" /></span>{{ g.label }}
            </button>
          </Popover>
        </div>
      </div>
      <!-- 手機版搜尋列 -->
      <div v-if="ui.isMobile && (searchOpen || filters.keyword)" class="px-3 pb-2">
        <div class="relative">
          <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input ref="searchEl" v-model="filters.keyword" class="input !pl-8 !pr-8" placeholder="搜尋工作名稱" enterkeyhint="search" />
          <button class="absolute right-1 top-1/2 -translate-y-1/2 icon-btn !size-7" title="關閉搜尋" @click="closeSearch"><Icon name="x" :size="14" /></button>
        </div>
      </div>

      <!-- 快速篩選 -->
      <div v-if="view !== 'charts' || ui.isMobile" class="flex items-center gap-1.5 px-3 sm:px-6 pb-2 overflow-x-auto no-scrollbar">
        <!-- 手機版：篩選與群組放在這一列 -->
        <div v-if="ui.isMobile" class="shrink-0 flex items-center gap-1.5">
          <Popover placement="bottom-start">
            <template #trigger>
              <button class="chip shrink-0 !h-7" :class="filterCount ? 'chip-on' : ''"><Icon name="filter" :size="13" />篩選<template v-if="filterCount"> {{ filterCount }}</template></button>
            </template>
            <FilterPanel v-model="filters" :members="planStore.members" :buckets="planStore.sortedBuckets" :label-names="plan.labelNames" />
          </Popover>
          <Popover v-if="view === 'board'" placement="bottom-start" close-on-click>
            <template #trigger>
              <button class="chip shrink-0 !h-7"><Icon name="group" :size="13" />{{ groupLabel }}<Icon name="chevron-down" :size="12" /></button>
            </template>
            <div class="px-3 pt-1 pb-0.5 text-[11px] text-ink-4">群組依據</div>
            <button v-for="g in GROUP_OPTIONS" :key="g.key" class="menu-item" @click="groupBy = g.key">
              <span class="w-4"><Icon v-if="groupBy === g.key" name="check" :size="15" class="text-accent" /></span>{{ g.label }}
            </button>
          </Popover>
          <span v-if="view !== 'charts'" class="shrink-0 w-px h-5 bg-line-2 mx-0.5"></span>
        </div>
        <template v-if="view !== 'charts'">
        <button
          v-for="q in quickFilters"
          :key="q.key"
          class="chip shrink-0 !h-7"
          :class="isQuickOn(q) ? 'chip-on' : ''"
          @click="toggleQuick(q)"
        >
          <Icon v-if="q.icon" :name="q.icon" :size="13" />{{ q.label }}
          <span v-if="q.count != null" class="text-[11px]" :class="q.danger && q.count && !isQuickOn(q) ? 'text-[#c50f1f] font-semibold' : 'opacity-70'">{{ q.count }}</span>
        </button>
        <span v-if="filterCount" class="shrink-0 text-xs text-ink-3 pl-1">顯示 {{ filteredTasks.length }} / {{ planStore.tasks.length }} 個工作</span>
        </template>
      </div>
    </div>

    <!-- 內容 -->
    <BoardView v-if="view === 'board'" :tasks="filteredTasks" :group-by="groupBy" :style="panelPad" @active-bucket="activeBucket = $event" />
    <ListView v-else-if="view === 'grid' && ui.isMobile" :tasks="filteredTasks" @add="openQuickAdd" />
    <GridView v-else-if="view === 'grid'" :tasks="filteredTasks" :style="panelPad" />
    <ScheduleView v-else-if="view === 'schedule'" :tasks="filteredTasks" />
    <ChartsView v-else-if="view === 'charts'" :tasks="filteredTasks" />

    <!-- 手機版：新增工作按鈕 -->
    <button
      v-if="ui.isMobile && view !== 'charts' && !ui.detail"
      class="fixed z-20 right-4 bottom-[calc(20px+env(safe-area-inset-bottom))] h-12 pl-4 pr-5 rounded-full bg-accent text-white font-semibold text-sm flex items-center gap-1.5 shadow-[0_6px_16px_rgba(0,90,158,.35)] active:scale-95 transition-transform cursor-pointer"
      @click="openQuickAdd(view === 'board' ? activeBucket : null)"
    >
      <Icon name="plus" :size="18" :stroke="2.4" />新增工作
    </button>
    <QuickAddSheet v-model="quickAddOpen" :initial-bucket-id="quickAddBucket" />

    <PlanSettingsDialog v-model="settingsOpen" :initial-tab="settingsTab" />
  </template>
</template>

<script setup>
import {
  computed, nextTick, reactive, ref, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import PlanIcon from '@/components/PlanIcon.vue';
import BoardView from '@/components/plan/BoardView.vue';
import GridView from '@/components/plan/GridView.vue';
import ListView from '@/components/plan/ListView.vue';
import QuickAddSheet from '@/components/plan/QuickAddSheet.vue';
import ScheduleView from '@/components/plan/ScheduleView.vue';
import ChartsView from '@/components/plan/ChartsView.vue';
import FilterPanel from '@/components/plan/FilterPanel.vue';
import MembersPanel from '@/components/plan/MembersPanel.vue';
import PlanSettingsDialog from '@/components/plan/PlanSettingsDialog.vue';
import { GROUP_OPTIONS } from '@/utils/grouping';
import {
  applyFilters, countFilters, emptyFilters, priorityLabel, progressLabel, labelName, dueCategory,
} from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const router = useRouter();
const planStore = usePlanStore();
const auth = useAuthStore();
const ui = useUiStore();

const views = [
  { key: 'grid', label: '格線', icon: 'grid' },
  { key: 'board', label: '面板', icon: 'board' },
  { key: 'schedule', label: '排程', icon: 'schedule' },
  { key: 'charts', label: '圖表', icon: 'chart' },
];

const planId = Number(route.params.id);
const error = ref('');
const plan = computed(() => (planStore.plan?.id === planId ? planStore.plan : null));
const view = computed(() => route.params.view || 'board');

const filters = reactive(emptyFilters());
const filterCount = computed(() => countFilters(filters));
const filteredTasks = computed(() => (plan.value ? applyFilters(planStore.tasks, filters) : []));
const clearFilters = () => Object.assign(filters, emptyFilters());

// 電腦版工作面板開著時，內容縮到面板左邊，被蓋住的欄位可以捲動過去看
const panelPad = computed(() => (ui.detail && !ui.isMobile ? { paddingRight: 'min(620px, 100vw - 320px)' } : null));

// 進度摘要
const stats = computed(() => {
  const all = planStore.tasks;
  const done = all.filter((t) => t.progress === 100).length;
  return {
    total: all.length,
    done,
    pct: all.length ? Math.round((done / all.length) * 100) : 0,
    late: all.filter((t) => dueCategory(t) === 'late').length,
  };
});

// 快速篩選：一鍵套用常用條件（與「篩選」面板共用同一組條件）
const WEEK = ['today', 'tomorrow', 'thisWeek'];
const quickFilters = computed(() => {
  const me = auth.user?.id;
  const open = planStore.tasks.filter((t) => t.progress !== 100);
  return [
    {
      key: 'mine', label: '指派給我', icon: 'user', field: 'assignees', value: [me], count: open.filter((t) => t.assigneeIds.includes(me)).length,
    },
    {
      key: 'late', label: '逾期', field: 'due', value: ['late'], count: stats.value.late, danger: true,
    },
    {
      key: 'week', label: '本週到期', field: 'due', value: WEEK, count: open.filter((t) => WEEK.includes(dueCategory(t))).length,
    },
    {
      key: 'open', label: '隱藏已完成', field: 'progress', value: [0, 50],
    },
  ];
});
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const isQuickOn = (q) => sameSet(filters[q.field], q.value);
function toggleQuick(q) {
  filters[q.field] = isQuickOn(q) ? [] : [...q.value];
}

// 手機版搜尋
const searchOpen = ref(false);
const searchEl = ref(null);
async function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (!searchOpen.value) filters.keyword = '';
  await nextTick();
  searchEl.value?.focus();
}
function closeSearch() {
  filters.keyword = '';
  searchOpen.value = false;
}

// 手機版新增工作
const quickAddOpen = ref(false);
const quickAddBucket = ref(null);
const activeBucket = ref(null); // 手機看板目前看到的貯體
function openQuickAdd(bucketId) {
  quickAddBucket.value = bucketId;
  quickAddOpen.value = true;
}

const groupKey = `planner_group_${planId}`;
const groupBy = ref(localStorage.getItem(groupKey) || 'bucket');
watch(groupBy, (v) => localStorage.setItem(groupKey, v));
const groupLabel = computed(() => GROUP_OPTIONS.find((g) => g.key === groupBy.value)?.label);

const editingName = ref(false);
const nameDraft = ref('');
const settingsOpen = ref(false);
const settingsTab = ref('general');
const vFocus = { mounted: (el) => { el.focus(); el.select(); } };

(async () => {
  try {
    await planStore.load(planId);
    if (route.query.task) ui.openTask({ id: Number(route.query.task), planId });
  } catch (e) {
    error.value = e.message;
  }
})();

function startEditName() {
  nameDraft.value = plan.value.name;
  editingName.value = true;
}
async function saveName() {
  if (!editingName.value) return;
  editingName.value = false;
  const name = nameDraft.value.trim();
  if (!name || name === plan.value.name) return;
  try {
    await planStore.updatePlan({ name });
  } catch (e) {
    ui.error(e);
  }
}
function openSettings(tab) {
  settingsTab.value = tab;
  settingsOpen.value = true;
}

async function removePlan() {
  const ok = await ui.confirm({
    title: '刪除計劃',
    message: `確定要刪除「${plan.value.name}」嗎？\n計劃中的所有貯體、工作與附件都會永久刪除，無法復原。`,
  });
  if (!ok) return;
  try {
    await planStore.deletePlan();
    ui.toast('已刪除計劃', 'success');
    router.push('/plans');
  } catch (e) {
    ui.error(e);
  }
}

async function leave() {
  const ok = await ui.confirm({ title: '離開計劃', message: '確定要離開此計劃嗎？', okText: '離開' });
  if (!ok) return;
  try {
    await planStore.removeMember(auth.user.id);
    router.push('/plans');
  } catch (e) {
    ui.error(e);
  }
}

function exportCsv() {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['工作識別碼', '工作名稱', '貯體名稱', '進度', '優先順序', '指派對象', '建立日期', '開始日期', '到期日', '完成日期', '標籤', '描述', '檢查清單項目'];
  const rows = planStore.tasks.map((t) => [
    t.id,
    t.title,
    planStore.bucketMap[t.bucketId]?.name,
    progressLabel(t.progress),
    priorityLabel(t.priority),
    t.assigneeIds.map((id) => planStore.memberMap[id]?.displayName).filter(Boolean).join(';'),
    t.createdAt?.slice(0, 10),
    t.startDate,
    t.dueDate,
    t.completedAt?.slice(0, 10),
    t.labels.map((l) => labelName(plan.value.labelNames, l)).join(';'),
    t.notes,
    t.checklist.map((c) => c.title).join(';'),
  ]);
  const csv = `﻿${[head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${plan.value.name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>
