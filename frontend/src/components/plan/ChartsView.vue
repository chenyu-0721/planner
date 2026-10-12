<template>
  <div class="flex-1 min-h-0 overflow-y-auto thin-scroll px-6 py-4">
    <div class="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
      <!-- 狀態 -->
      <section class="bg-white rounded-md card-shadow p-5">
        <h3 class="text-base font-semibold mb-4">狀態</h3>
        <div class="flex items-center gap-6">
          <svg width="160" height="160" viewBox="0 0 42 42" class="shrink-0">
            <circle cx="21" cy="21" r="15.915" fill="none" stroke="#edebe9" stroke-width="5" />
            <circle
              v-for="arc in arcs"
              :key="arc.key"
              cx="21" cy="21" r="15.915" fill="none"
              :stroke="arc.color" stroke-width="5"
              :stroke-dasharray="`${arc.pct} ${100 - arc.pct}`"
              :stroke-dashoffset="-arc.offset"
              transform="rotate(-90 21 21)"
            />
            <g>
              <text x="21" y="20.5" text-anchor="middle" class="fill-ink" style="font-size: 8px; font-weight: 600">{{ remaining }}</text>
              <text x="21" y="26.5" text-anchor="middle" class="fill-ink-3" style="font-size: 3.2px">剩餘工作</text>
            </g>
          </svg>
          <ul class="space-y-2 text-sm">
            <li v-for="s in STATUS" :key="s.key" class="flex items-center gap-2">
              <span class="size-3 rounded-sm" :style="{ background: s.color }"></span>
              <span class="text-ink-2 w-14">{{ s.label }}</span>
              <span class="font-semibold">{{ status[s.key] }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- 貯體 -->
      <section class="bg-white rounded-md card-shadow p-5 min-w-0">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold">貯體</h3>
          <Legend />
        </div>
        <div v-if="!bucketRows.length" class="text-sm text-ink-3 py-10 text-center">沒有資料</div>
        <div v-else class="overflow-x-auto thin-scroll">
          <div class="flex items-end gap-6 h-56 px-2 min-w-max border-b border-line">
            <div v-for="r in bucketRows" :key="r.key" class="flex flex-col items-center justify-end h-full w-14">
              <span class="text-xs text-ink-3 mb-1">{{ r.total }}</span>
              <div class="w-10 flex flex-col-reverse rounded-t overflow-hidden" :style="{ height: `${(r.total / maxBucket) * 85}%` }">
                <div v-for="s in STATUS" :key="s.key" :style="{ background: s.color, flexGrow: r[s.key] }" :title="`${s.label}：${r[s.key]}`"></div>
              </div>
            </div>
          </div>
          <div class="flex gap-6 px-2 min-w-max mt-2">
            <div v-for="r in bucketRows" :key="r.key" class="w-14 text-center text-xs text-ink-2 truncate" :title="r.label">{{ r.label }}</div>
          </div>
        </div>
      </section>

      <!-- 優先順序 -->
      <section class="bg-white rounded-md card-shadow p-5">
        <h3 class="text-base font-semibold mb-4">優先順序</h3>
        <div class="space-y-3">
          <div v-for="p in priorityRows" :key="p.value" class="flex items-center gap-3 text-sm">
            <span class="w-4 flex justify-center"><PriorityIcon :value="p.value" show-medium /></span>
            <span class="w-10 text-ink-2">{{ p.label }}</span>
            <div class="flex-1 h-5 bg-[#f3f2f1] rounded overflow-hidden">
              <div class="h-full bg-accent rounded" :style="{ width: `${maxPriority ? (p.count / maxPriority) * 100 : 0}%` }"></div>
            </div>
            <span class="w-6 text-right font-semibold">{{ p.count }}</span>
          </div>
        </div>
      </section>

      <!-- 成員 -->
      <section class="bg-white rounded-md card-shadow p-5 min-w-0">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold">成員</h3>
          <Legend />
        </div>
        <div class="space-y-3">
          <div v-for="r in memberRows" :key="r.key" class="flex items-center gap-3 text-sm">
            <Avatar :user="r.user" :size="28" />
            <span class="w-28 truncate text-ink-2">{{ r.label }}</span>
            <div class="flex-1 h-5 flex">
              <div class="flex h-full rounded overflow-hidden" :style="{ width: `${maxMember ? (r.total / maxMember) * 100 : 0}%` }">
                <div v-for="s in STATUS" :key="s.key" :style="{ background: s.color, flexGrow: r[s.key] }" :title="`${s.label}：${r[s.key]}`"></div>
              </div>
            </div>
            <span class="w-6 text-right font-semibold">{{ r.total }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import Avatar from '../Avatar.vue';
import PriorityIcon from '../PriorityIcon.vue';
import { PRIORITIES, isLate } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';

const props = defineProps({ tasks: { type: Array, required: true } });
const planStore = usePlanStore();

const STATUS = [
  { key: 'notStarted', label: '未開始', color: '#a19f9d' },
  { key: 'inProgress', label: '進行中', color: '#0f6cbd' },
  { key: 'late', label: '逾期', color: '#c50f1f' },
  { key: 'completed', label: '已完成', color: '#107c10' },
];

const statusOf = (t) => {
  if (t.progress === 100) return 'completed';
  if (isLate(t)) return 'late';
  return t.progress === 50 ? 'inProgress' : 'notStarted';
};

function tally(tasks) {
  const r = {
    notStarted: 0, inProgress: 0, late: 0, completed: 0, total: tasks.length,
  };
  tasks.forEach((t) => { r[statusOf(t)] += 1; });
  return r;
}

const status = computed(() => tally(props.tasks));
const remaining = computed(() => status.value.total - status.value.completed);
const arcs = computed(() => {
  let offset = 0;
  const total = status.value.total || 1;
  return STATUS.map((s) => {
    const pct = (status.value[s.key] / total) * 100;
    const arc = { key: s.key, color: s.color, pct, offset };
    offset += pct;
    return arc;
  }).filter((a) => a.pct > 0);
});

const bucketRows = computed(() => planStore.sortedBuckets.map((b) => ({
  key: b.id, label: b.name, ...tally(props.tasks.filter((t) => t.bucketId === b.id)),
})));
const maxBucket = computed(() => Math.max(1, ...bucketRows.value.map((r) => r.total)));

const priorityRows = computed(() => PRIORITIES.map((p) => ({
  ...p, count: props.tasks.filter((t) => t.priority === p.value && t.progress !== 100).length,
})));
const maxPriority = computed(() => Math.max(0, ...priorityRows.value.map((p) => p.count)));

const memberRows = computed(() => [
  ...planStore.members.map((m) => ({
    key: m.id, label: m.displayName, user: m, ...tally(props.tasks.filter((t) => t.assigneeIds.includes(m.id))),
  })),
  { key: 0, label: '未指派', user: null, ...tally(props.tasks.filter((t) => !t.assigneeIds.length)) },
]);
const maxMember = computed(() => Math.max(1, ...memberRows.value.map((r) => r.total)));

const Legend = () => h('div', { class: 'flex items-center gap-3 text-xs text-ink-3' }, STATUS.map((s) => h('span', { class: 'flex items-center gap-1' }, [
  h('span', { class: 'size-2.5 rounded-sm', style: { background: s.color } }),
  s.label,
])));
</script>
