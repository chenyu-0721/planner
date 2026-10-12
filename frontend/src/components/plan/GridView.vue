<template>
  <div class="flex-1 min-h-0 overflow-auto thin-scroll px-3 sm:px-6 py-3 sm:py-4">
    <div class="bg-white rounded-md card-shadow min-w-[1010px]">
      <!-- 表頭 -->
      <div :class="rowGrid" class="h-10 text-xs font-semibold text-ink-3 border-b border-line sticky top-0 bg-white z-10 rounded-t-md">
        <div class="sticky left-0 z-[2] bg-inherit h-full rounded-tl-md"></div>
        <button
          v-for="c in cols"
          :key="c.key"
          class="flex items-center gap-1 h-full text-left hover:text-ink cursor-pointer"
          :class="c.key === 'title' ? 'sticky left-[44px] z-[2] bg-inherit' : ''"
          @click="sortBy(c.key)"
        >
          {{ c.label }}
          <Icon v-if="sort.key === c.key" :name="sort.dir === 1 ? 'chevron-up' : 'chevron-down'" :size="12" />
        </button>
      </div>

      <!-- 新增工作 -->
      <div :class="rowGrid" class="h-11 border-b border-line bg-white">
        <div class="sticky left-0 z-[1] bg-inherit h-full flex items-center justify-center text-accent"><Icon name="plus" :size="16" /></div>
        <input
          v-model="newTitle"
          class="sticky left-[44px] z-[1] bg-inherit col-span-2 h-8 outline-none text-sm placeholder:text-accent focus:placeholder:text-ink-4"
          placeholder="新增工作"
          maxlength="200"
          @keydown.enter="addTask"
        />
      </div>

      <div v-if="!sorted.length" class="py-12 text-center text-sm text-ink-3">沒有符合的工作</div>

      <div
        v-for="t in sorted"
        :key="t.id"
        :class="rowGrid"
        class="group h-11 border-b border-line last:border-0 bg-white hover:bg-[#fafafa] text-sm"
      >
        <button class="sticky left-0 z-[1] bg-inherit h-full flex items-center justify-center cursor-pointer" :title="t.progress === 100 ? '標示為未完成' : '標示為完成'" @click="update(t, { progress: t.progress === 100 ? 0 : 100 })">
          <ProgressIcon :value="t.progress === 100 ? 100 : 0" :size="18" />
        </button>

        <div class="sticky left-[44px] z-[1] bg-inherit h-full flex items-center gap-2 min-w-0 pr-3 border-r border-line sm:border-r-0">
          <button class="truncate text-left hover:underline cursor-pointer" :class="t.progress === 100 ? 'line-through text-ink-3' : 'text-ink'" @click="ui.openTask(t)">
            {{ t.title }}
          </button>
          <span class="flex items-center gap-1.5 text-ink-4 shrink-0">
            <Icon v-if="t.notes" name="notes" :size="13" />
            <span v-if="t.checklistTotal" class="text-xs flex items-center gap-0.5"><Icon name="checklist" :size="13" />{{ t.checklistDone }}/{{ t.checklistTotal }}</span>
            <Icon v-if="t.attachments.length" name="paperclip" :size="13" />
          </span>
        </div>

        <Popover>
          <template #trigger>
            <button class="flex items-center gap-1.5 h-8 px-1 rounded hover:bg-black/5 cursor-pointer min-w-0 max-w-full">
              <template v-if="t.assigneeIds.length">
                <div class="flex -space-x-1.5">
                  <Avatar v-for="id in t.assigneeIds.slice(0, 3)" :key="id" :user="planStore.memberMap[id]" :size="24" ring />
                </div>
                <span v-if="t.assigneeIds.length === 1" class="truncate text-ink-2">{{ planStore.memberMap[t.assigneeIds[0]]?.displayName }}</span>
              </template>
              <span v-else class="text-ink-4 touch-show opacity-0 group-hover:opacity-100 flex items-center gap-1"><Icon name="user-plus" :size="14" />指派</span>
            </button>
          </template>
          <AssigneePicker :model-value="t.assigneeIds" :members="planStore.members" @update:model-value="(ids) => update(t, { assigneeIds: ids })" />
        </Popover>

        <input type="date" class="cell-input" :value="t.startDate || ''" @change="update(t, { startDate: $event.target.value || null })" />
        <input type="date" class="cell-input" :class="isLate(t) ? '!text-[#c50f1f] font-semibold' : ''" :value="t.dueDate || ''" @change="update(t, { dueDate: $event.target.value || null })" />

        <select class="cell-input" :value="t.bucketId" @change="update(t, { bucketId: Number($event.target.value) })">
          <option v-for="b in planStore.sortedBuckets" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>

        <div class="flex items-center gap-1.5">
          <ProgressIcon :value="t.progress" :size="14" />
          <select class="cell-input" :value="t.progress" @change="update(t, { progress: Number($event.target.value) })">
            <option v-for="p in PROGRESS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="w-3.5 flex justify-center"><PriorityIcon :value="t.priority" show-medium /></span>
          <select class="cell-input" :value="t.priority" @change="update(t, { priority: Number($event.target.value) })">
            <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>

        <Popover>
          <template #trigger>
            <button class="flex items-center gap-1 h-8 px-1 rounded hover:bg-black/5 cursor-pointer overflow-hidden max-w-full">
              <template v-if="t.labels.length">
                <LabelPill v-for="l in t.labels.slice(0, 2)" :key="l" :id="l" :label-names="planStore.plan?.labelNames" />
                <span v-if="t.labels.length > 2" class="text-xs text-ink-3">+{{ t.labels.length - 2 }}</span>
              </template>
              <span v-else class="text-ink-4 touch-show opacity-0 group-hover:opacity-100 flex items-center gap-1"><Icon name="tag" :size="14" />新增</span>
            </button>
          </template>
          <LabelPicker :model-value="t.labels" :label-names="planStore.plan?.labelNames" @update:model-value="(ids) => update(t, { labels: ids })" @rename="renameLabel" />
        </Popover>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import Popover from '../Popover.vue';
import LabelPill from '../LabelPill.vue';
import LabelPicker from '../LabelPicker.vue';
import AssigneePicker from '../AssigneePicker.vue';
import ProgressIcon from '../ProgressIcon.vue';
import PriorityIcon from '../PriorityIcon.vue';
import { PROGRESS, PRIORITIES, isLate, bySort } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({ tasks: { type: Array, required: true } });
const planStore = usePlanStore();
const ui = useUiStore();

const rowGrid = 'grid grid-cols-[44px_minmax(170px,2.4fr)_minmax(140px,1.2fr)_130px_130px_minmax(120px,1fr)_120px_100px_minmax(140px,1fr)] items-center pr-3';
const cols = [
  { key: 'title', label: '工作名稱' },
  { key: 'assignee', label: '指派對象' },
  { key: 'startDate', label: '開始日期' },
  { key: 'dueDate', label: '到期日' },
  { key: 'bucket', label: '貯體' },
  { key: 'progress', label: '進度' },
  { key: 'priority', label: '優先順序' },
  { key: 'labels', label: '標籤' },
];

const sort = reactive({ key: '', dir: 1 });
function sortBy(key) {
  if (sort.key === key) {
    if (sort.dir === 1) sort.dir = -1;
    else sort.key = '';
  } else {
    sort.key = key;
    sort.dir = 1;
  }
}

const value = (t, key) => {
  switch (key) {
    case 'assignee': return planStore.memberMap[t.assigneeIds[0]]?.displayName || '￿';
    case 'bucket': return planStore.bucketMap[t.bucketId]?.sortOrder ?? 0;
    case 'labels': return t.labels[0] || 99;
    case 'startDate':
    case 'dueDate': return t[key] || '9999';
    default: return t[key];
  }
};

const sorted = computed(() => {
  const list = [...props.tasks];
  if (!sort.key) {
    return list.sort((a, b) => (planStore.bucketMap[a.bucketId]?.sortOrder ?? 0) - (planStore.bucketMap[b.bucketId]?.sortOrder ?? 0) || bySort(a, b));
  }
  return list.sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return bySort(a, b);
  });
});

const newTitle = ref('');
async function addTask() {
  const title = newTitle.value.trim();
  if (!title) return;
  newTitle.value = '';
  try {
    await planStore.createTask({ title });
  } catch (e) {
    ui.error(e);
  }
}

async function update(t, patch) {
  try {
    await planStore.updateTask(t.id, patch);
  } catch (e) {
    ui.error(e);
  }
}

async function renameLabel(id, name) {
  const labelNames = { ...(planStore.plan.labelNames || {}) };
  if (name) labelNames[id] = name;
  else delete labelNames[id];
  try {
    await planStore.updatePlan({ labelNames });
  } catch (e) {
    ui.error(e);
  }
}
</script>

<style scoped>
.cell-input {
  height: 2rem;
  width: 100%;
  min-width: 0;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  padding: 0 4px;
  font-size: 14px;
  color: var(--color-ink-2);
  outline: none;
  cursor: pointer;
}
.cell-input:hover {
  border-color: var(--color-line-2);
  background: #fff;
}
.cell-input:focus {
  border-color: var(--color-accent);
  background: #fff;
}
</style>
