<template>
  <div class="flex-1 min-h-0 flex relative">
    <div class="flex-1 min-w-0 flex flex-col px-3 sm:px-6 py-3 sm:py-4">
      <!-- 工具列 -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-2 mb-3 shrink-0">
        <button class="btn btn-default" @click="goToday">今天</button>
        <button class="icon-btn" title="上一個" @click="move(-1)"><Icon name="chevron-left" :size="18" /></button>
        <button class="icon-btn" title="下一個" @click="move(1)"><Icon name="chevron-right" :size="18" /></button>
        <h2 class="text-base sm:text-lg font-semibold ml-1">{{ heading }}</h2>
        <div class="flex-1"></div>
        <div class="inline-flex rounded border border-line-2 bg-white overflow-hidden">
          <button v-for="m in modes" :key="m.key" class="px-3 h-8 text-sm cursor-pointer" :class="mode === m.key ? 'bg-accent text-white font-semibold' : 'hover:bg-hover'" @click="mode = m.key">
            {{ m.label }}
          </button>
        </div>
        <button class="btn btn-ghost" @click="showUnscheduled = !showUnscheduled">
          <Icon name="calendar" :size="16" /><span class="hidden sm:inline">未排程的工作</span> ({{ unscheduled.length }})
        </button>
      </div>

      <!-- 星期列 -->
      <div class="grid grid-cols-7 bg-white border border-line rounded-t-md shrink-0">
        <div v-for="(w, i) in WEEKDAYS" :key="w" class="h-8 flex items-center justify-center sm:justify-start px-1 sm:px-2 text-xs font-semibold text-ink-3" :class="i ? 'border-l border-line' : ''"><span class="hidden sm:inline">週</span>{{ w }}</div>
      </div>

      <!-- 日曆 -->
      <div class="flex-1 min-h-0 overflow-y-auto thin-scroll bg-white border-x border-b border-line rounded-b-md">
        <div
          v-for="week in weeks"
          :key="week.start"
          class="relative border-b border-line last:border-0"
          :style="{ minHeight: `${mode === 'week' ? 420 : Math.max(118, 34 + week.lanes * 26)}px` }"
        >
          <!-- 日期格 -->
          <div class="absolute inset-0 grid grid-cols-7">
            <div
              v-for="(d, i) in week.days"
              :key="d"
              class="group relative px-0.5 sm:px-1.5 pt-1"
              :class="[i ? 'border-l border-line' : '', inMonth(d) ? '' : 'bg-[#fafafa]', dropDay === d ? '!bg-accent-light' : '']"
              @dragover.prevent="dropDay = d"
              @dragleave="dropDay === d && (dropDay = null)"
              @drop.prevent="onDrop(d)"
            >
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full text-xs"
                  :class="d === today ? 'bg-accent text-white font-semibold' : inMonth(d) ? 'text-ink' : 'text-ink-4'"
                >{{ dayLabel(d) }}</span>
                <Popover>
                  <template #trigger>
                    <button class="icon-btn !size-6 touch-show opacity-0 group-hover:opacity-100" title="在這天新增工作"><Icon name="plus" :size="14" /></button>
                  </template>
                  <template #default="{ close }">
                    <div class="p-2 w-64">
                      <div class="text-xs text-ink-3 mb-1.5">到期日：{{ fmtLong(d) }}</div>
                      <input v-focus class="input" placeholder="輸入工作名稱後按 Enter" maxlength="200" @keydown.enter="addTask($event, d, close)" />
                    </div>
                  </template>
                </Popover>
              </div>
            </div>
          </div>

          <!-- 工作條 -->
          <div
            v-for="s in week.segments"
            :key="s.task.id + '-' + week.start"
            draggable="true"
            class="absolute h-[22px] flex items-center gap-1 px-1.5 rounded bg-white border border-line-2 text-xs cursor-pointer hover:card-shadow-hover overflow-hidden z-[1]"
            :class="[s.task.progress === 100 ? 'text-ink-4 line-through' : 'text-ink']"
            :style="{
              top: `${32 + s.lane * 26}px`,
              left: `calc(${(s.col / 7) * 100}% + 3px)`,
              width: `calc(${(s.span / 7) * 100}% - 6px)`,
              borderLeft: `3px solid ${statusColor(s.task)}`,
            }"
            :title="s.task.title"
            @click="ui.openTask(s.task)"
            @dragstart="onDragStart($event, s.task)"
            @dragend="dropDay = null"
          >
            <ProgressIcon v-if="s.task.progress === 100" :value="100" :size="12" />
            <span class="truncate">{{ s.task.title }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 未排程 -->
    <aside v-if="showUnscheduled" class="w-[280px] max-w-[85vw] shrink-0 border-l border-line bg-[#fafafa] flex flex-col max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-2xl">
      <div class="flex items-center justify-between px-4 h-12 shrink-0">
        <span class="font-semibold text-sm">未排程的工作</span>
        <button class="icon-btn !size-7" @click="showUnscheduled = false"><Icon name="x" :size="14" /></button>
      </div>
      <p class="px-4 text-xs text-ink-3 mb-2">將工作拖曳到日曆上以設定到期日。</p>
      <div class="flex-1 overflow-y-auto thin-scroll px-3 pb-4 space-y-2">
        <div v-for="t in unscheduled" :key="t.id" draggable="true" @dragstart="onDragStart($event, t)" @dragend="dropDay = null">
          <TaskCard :task="t" />
        </div>
        <div v-if="!unscheduled.length" class="text-center text-xs text-ink-4 py-8">所有工作都已排程</div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Icon from '../Icon.vue';
import Popover from '../Popover.vue';
import TaskCard from '../TaskCard.vue';
import ProgressIcon from '../ProgressIcon.vue';
import {
  toDateStr, parseDate, todayStr, addDays, diffDays, fmtLong, isLate,
} from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({ tasks: { type: Array, required: true } });
const planStore = usePlanStore();
const ui = useUiStore();

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const modes = [{ key: 'week', label: '週' }, { key: 'month', label: '月' }];
const mode = ref('month');
const cursor = ref(todayStr());
const today = todayStr();
// 寬螢幕預設顯示「未排程的工作」，手機 / 平板預設收起
const showUnscheduled = ref(window.matchMedia('(min-width: 1024px)').matches);
const dropDay = ref(null);
let dragTask = null;
const vFocus = { mounted: (el) => el.focus() };

const cursorDate = computed(() => parseDate(cursor.value));
const heading = computed(() => {
  const d = cursorDate.value;
  if (mode.value === 'month') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  const s = parseDate(weekStart(cursor.value));
  const e = parseDate(addDays(weekStart(cursor.value), 6));
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 – ${e.getMonth() + 1}月${e.getDate()}日`;
});

function weekStart(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

const range = (t) => {
  let a = t.startDate || t.dueDate;
  let b = t.dueDate || t.startDate;
  if (a > b) [a, b] = [b, a];
  return [a, b];
};

const scheduled = computed(() => props.tasks.filter((t) => t.startDate || t.dueDate));
const unscheduled = computed(() => props.tasks.filter((t) => !t.startDate && !t.dueDate && t.progress !== 100));

const weeks = computed(() => {
  let start;
  let count;
  if (mode.value === 'month') {
    const d = cursorDate.value;
    const first = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
    const last = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    start = weekStart(first);
    count = Math.ceil((diffDays(last, start) + 1) / 7);
  } else {
    start = weekStart(cursor.value);
    count = 1;
  }

  return Array.from({ length: count }, (_, w) => {
    const s = addDays(start, w * 7);
    const e = addDays(s, 6);
    const days = Array.from({ length: 7 }, (__, i) => addDays(s, i));
    const segs = scheduled.value
      .map((t) => ({ t, r: range(t) }))
      .filter(({ r }) => r[0] <= e && r[1] >= s)
      .map(({ t, r }) => {
        const a = r[0] < s ? s : r[0];
        const b = r[1] > e ? e : r[1];
        return { task: t, col: diffDays(a, s), span: diffDays(b, a) + 1 };
      })
      .sort((x, y) => x.col - y.col || y.span - x.span || x.task.id - y.task.id);
    // 分配列位
    const laneEnds = [];
    segs.forEach((seg) => {
      let lane = laneEnds.findIndex((end) => end < seg.col);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = seg.col + seg.span - 1;
      seg.lane = lane;
    });
    return { start: s, days, segments: segs, lanes: laneEnds.length };
  });
});

const inMonth = (d) => mode.value === 'week' || parseDate(d).getMonth() === cursorDate.value.getMonth();
const dayLabel = (d) => {
  const x = parseDate(d);
  if (x.getDate() !== 1) return x.getDate();
  return ui.isMobile ? `${x.getMonth() + 1}/1` : `${x.getMonth() + 1}月1日`;
};
const statusColor = (t) => {
  if (t.progress === 100) return '#107c10';
  if (isLate(t)) return '#c50f1f';
  if (t.progress === 50) return '#0f6cbd';
  return '#8a8886';
};

function goToday() {
  cursor.value = todayStr();
}
function move(n) {
  const d = cursorDate.value;
  if (mode.value === 'month') cursor.value = toDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
  else cursor.value = addDays(cursor.value, n * 7);
}

function onDragStart(e, task) {
  dragTask = task;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(task.id));
}

async function onDrop(day) {
  dropDay.value = null;
  const t = dragTask;
  dragTask = null;
  if (!t) return;
  const patch = {};
  if (!t.dueDate && !t.startDate) {
    patch.dueDate = day;
  } else {
    const anchor = t.dueDate || t.startDate;
    const delta = diffDays(day, anchor);
    if (!delta) return;
    if (t.dueDate) patch.dueDate = addDays(t.dueDate, delta);
    if (t.startDate) patch.startDate = addDays(t.startDate, delta);
  }
  try {
    await planStore.updateTask(t.id, patch);
  } catch (err) {
    ui.error(err);
  }
}

async function addTask(e, day, close) {
  const title = e.target.value.trim();
  if (!title) return;
  try {
    await planStore.createTask({ title, dueDate: day });
    close();
  } catch (err) {
    ui.error(err);
  }
}
</script>
