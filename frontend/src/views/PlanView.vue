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

        <div class="flex-1"></div>

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

        <div class="shrink-0 flex items-center gap-1 pb-1">
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
    </div>

    <!-- 內容 -->
    <BoardView v-if="view === 'board'" :tasks="filteredTasks" :group-by="groupBy" />
    <GridView v-else-if="view === 'grid'" :tasks="filteredTasks" />
    <ScheduleView v-else-if="view === 'schedule'" :tasks="filteredTasks" />
    <ChartsView v-else-if="view === 'charts'" :tasks="filteredTasks" />

    <PlanSettingsDialog v-model="settingsOpen" :initial-tab="settingsTab" />
  </template>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import PlanIcon from '@/components/PlanIcon.vue';
import BoardView from '@/components/plan/BoardView.vue';
import GridView from '@/components/plan/GridView.vue';
import ScheduleView from '@/components/plan/ScheduleView.vue';
import ChartsView from '@/components/plan/ChartsView.vue';
import FilterPanel from '@/components/plan/FilterPanel.vue';
import MembersPanel from '@/components/plan/MembersPanel.vue';
import PlanSettingsDialog from '@/components/plan/PlanSettingsDialog.vue';
import { GROUP_OPTIONS } from '@/utils/grouping';
import {
  applyFilters, countFilters, emptyFilters, priorityLabel, progressLabel, labelName,
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
    planStore.plan = null;
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
