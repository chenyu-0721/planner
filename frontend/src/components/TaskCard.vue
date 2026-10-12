<template>
  <div
    class="group relative bg-white rounded-md card-shadow hover:card-shadow-hover cursor-pointer select-none transition-shadow"
    :class="done ? 'opacity-90' : ''"
    @click="ui.openTask(task)"
  >
    <!-- 圖片預覽 -->
    <img v-if="previewImage" :src="previewImage.url" class="w-full max-h-40 object-cover rounded-t-md" alt="" />

    <div class="px-3 pt-2.5 pb-2.5">
      <div v-if="showPlan && task.plan" class="flex items-center gap-1.5 mb-1.5 text-xs text-ink-3">
        <PlanIcon :plan="task.plan" :size="14" />
        <span class="truncate">{{ task.plan.name }}<template v-if="task.bucket"> · {{ task.bucket.name }}</template></span>
      </div>

      <div v-if="task.labels.length" class="flex flex-wrap gap-1 mb-2">
        <LabelPill v-for="l in task.labels" :key="l" :id="l" :label-names="labelNames" />
      </div>

      <div class="flex items-start gap-1.5">
        <button
          class="mt-[1px] shrink-0 rounded-full cursor-pointer"
          :title="done ? '標示為未完成' : '標示為完成'"
          @click.stop="toggleComplete"
        >
          <span v-if="done"><ProgressIcon :value="100" :size="18" /></span>
          <span v-else class="relative block size-[18px]">
            <svg width="18" height="18" viewBox="0 0 20 20" class="text-ink-3">
              <circle cx="10" cy="10" r="7.75" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path class="opacity-0 group-hover:opacity-100 hover:!opacity-100" d="m6.6 10.2 2.4 2.4 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </span>
        </button>
        <div class="flex-1 min-w-0 text-sm leading-5 break-words" :class="done ? 'line-through text-ink-3' : 'text-ink font-semibold'">
          {{ task.title }}
        </div>
        <Popover placement="bottom-end" close-on-click>
          <template #trigger>
            <button class="icon-btn !size-6 -mr-1 -mt-0.5 touch-show opacity-0 group-hover:opacity-100" title="更多選項">
              <Icon name="more" :size="16" />
            </button>
          </template>
          <button class="menu-item" @click="ui.openTask(task)"><Icon name="external" />開啟</button>
          <button class="menu-item" @click="toggleMyDay"><Icon name="sun" />{{ task.inMyDay ? '從「我的一天」移除' : '新增至「我的一天」' }}</button>
          <button class="menu-item" @click="toggleComplete"><Icon name="circle-check" />{{ done ? '標示為未完成' : '標示為完成' }}</button>
          <div class="border-t border-line my-1"></div>
          <button class="menu-item !text-[#c50f1f]" @click="remove"><Icon name="trash" />刪除</button>
        </Popover>
      </div>

      <!-- 附註預覽 -->
      <p v-if="preview === 'description'" class="mt-1.5 ml-6 text-xs text-ink-3 line-clamp-4 whitespace-pre-line">{{ task.notes }}</p>

      <!-- 檢查清單預覽 -->
      <div v-if="preview === 'checklist'" class="mt-1.5 ml-[22px] space-y-0.5">
        <label
          v-for="c in task.checklist.slice(0, 8)"
          :key="c.id"
          class="flex items-start gap-1.5 text-xs cursor-pointer rounded px-0.5 hover:bg-hover"
          @click.stop
        >
          <input type="checkbox" class="mt-0.5 accent-accent cursor-pointer" :checked="c.isChecked" @change="toggleCheck(c)" />
          <span :class="c.isChecked ? 'line-through text-ink-4' : 'text-ink-2'">{{ c.title }}</span>
        </label>
      </div>

      <!-- 底部資訊 -->
      <div v-if="hasFooter" class="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-ink-3 min-h-6">
        <span v-if="task.progress === 50" class="inline-flex" title="進行中"><ProgressIcon :value="50" :size="14" /></span>
        <PriorityIcon :value="task.priority" />
        <span
          v-if="task.dueDate || done"
          class="inline-flex items-center gap-1 rounded px-1 h-5"
          :class="late ? 'bg-[#c50f1f] text-white' : ''"
          :title="done ? '已完成' : '到期日'"
        >
          <Icon :name="done ? 'check' : 'calendar'" :size="12" />
          {{ done ? fmtShort(task.completedAt?.slice?.(0, 10) || task.dueDate) : fmtShort(task.dueDate) }}
        </span>
        <span v-if="task.notes && preview !== 'description'" class="inline-flex" title="此工作有附註"><Icon name="notes" :size="14" /></span>
        <span v-if="task.checklistTotal" class="inline-flex items-center gap-1" title="檢查清單"><Icon name="checklist" :size="14" />{{ task.checklistDone }}/{{ task.checklistTotal }}</span>
        <span v-if="task.attachments.length" class="inline-flex items-center gap-1" title="附件"><Icon name="paperclip" :size="13" />{{ task.attachments.length }}</span>
        <span v-if="task.commentCount" class="inline-flex items-center gap-1" title="意見"><Icon name="comment" :size="13" />{{ task.commentCount }}</span>
        <span v-if="task.inMyDay" class="inline-flex text-[#ca5010]" title="在「我的一天」中"><Icon name="sun" :size="14" /></span>

        <div class="flex-1"></div>
        <div v-if="assignees.length" class="flex -space-x-1.5">
          <Avatar v-for="u in assignees.slice(0, 3)" :key="u.id" :user="u" :size="24" ring />
          <span v-if="assignees.length > 3" class="size-6 rounded-full bg-[#edebe9] text-ink-2 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">+{{ assignees.length - 3 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import Avatar from './Avatar.vue';
import Popover from './Popover.vue';
import PlanIcon from './PlanIcon.vue';
import LabelPill from './LabelPill.vue';
import ProgressIcon from './ProgressIcon.vue';
import PriorityIcon from './PriorityIcon.vue';
import api from '@/api';
import { fmtShort, isLate } from '@/utils/planner';
import { useUiStore } from '@/stores/ui';
import { usePlanStore } from '@/stores/plan';
import { usePlansStore } from '@/stores/plans';

const props = defineProps({
  task: { type: Object, required: true },
  showPlan: { type: Boolean, default: false },
});

const ui = useUiStore();
const planStore = usePlanStore();
const plans = usePlansStore();

const done = computed(() => props.task.progress === 100);
const late = computed(() => isLate(props.task));
const labelNames = computed(() => props.task.plan?.labelNames
  || (planStore.plan?.id === props.task.planId ? planStore.plan.labelNames : {}));

const userMap = computed(() => Object.fromEntries(plans.users.map((u) => [u.id, u])));
const assignees = computed(() => props.task.assigneeIds
  .map((id) => planStore.memberMap[id] || userMap.value[id])
  .filter(Boolean));

const previewImage = computed(() => (props.task.previewType === 'reference'
  ? props.task.attachments.find((a) => a.mimeType?.startsWith('image/'))
  : null));

const preview = computed(() => {
  const t = props.task;
  if (t.previewType === 'description') return t.notes ? 'description' : null;
  if (t.previewType === 'checklist') return t.checklistTotal ? 'checklist' : null;
  if (t.previewType === 'automatic' && t.checklistTotal && !done.value) return 'checklist';
  return null;
});

const hasFooter = computed(() => {
  const t = props.task;
  return t.progress === 50 || t.priority !== 5 || t.dueDate || done.value || t.notes || t.checklistTotal
    || t.attachments.length || t.commentCount || t.inMyDay || t.assigneeIds.length;
});

async function toggleComplete() {
  try {
    await planStore.updateTask(props.task.id, { progress: done.value ? 0 : 100 });
  } catch (e) {
    ui.error(e);
  }
}

async function toggleMyDay() {
  const next = !props.task.inMyDay;
  try {
    await planStore.setMyDay(props.task, next);
    ui.toast(next ? '已新增至「我的一天」' : '已從「我的一天」移除', 'success');
  } catch (e) {
    ui.error(e);
  }
}

async function toggleCheck(item) {
  item.isChecked = !item.isChecked;
  const t = props.task;
  t.checklistDone = t.checklist.filter((c) => c.isChecked).length;
  try {
    await api.put(`/tasks/${t.id}/checklist/${item.id}`, { isChecked: item.isChecked });
    ui.emitTask('updated', t);
  } catch (e) {
    item.isChecked = !item.isChecked;
    ui.error(e);
  }
}

async function remove() {
  const ok = await ui.confirm({ title: '刪除工作', message: `確定要刪除「${props.task.title}」嗎？此動作無法復原。` });
  if (!ok) return;
  try {
    await planStore.deleteTask(props.task.id);
  } catch (e) {
    ui.error(e);
  }
}
</script>
