<template>
  <div class="flex-1 min-h-0 overflow-x-auto overflow-y-hidden thin-scroll snap-x snap-mandatory md:snap-none">
    <div class="h-full flex items-start gap-3 px-3 sm:px-6 pt-3 sm:pt-4 pb-2 w-max">
      <draggable
        :model-value="columns"
        item-key="key"
        class="h-full flex items-start gap-3"
        handle=".bucket-handle"
        :delay="250"
        :delay-on-touch-only="true"
        :disabled="groupBy !== 'bucket'"
        :animation="150"
        ghost-class="drag-ghost"
                :force-fallback="true"
                :fallback-on-body="true"
                fallback-class="drag-fallback"
        @change="onBucketMove"
      >
        <template #item="{ element: col }">
          <section class="w-[85vw] max-w-[284px] sm:w-[284px] h-full flex flex-col shrink-0 snap-start scroll-ml-3">
            <!-- 欄位標題 -->
            <header class="bucket-handle flex items-center gap-2 h-10 px-1 shrink-0" :class="groupBy === 'bucket' ? 'cursor-grab active:cursor-grabbing' : ''">
              <template v-if="col.kind === 'progress'"><ProgressIcon :value="col.ref" :size="16" /></template>
              <template v-else-if="col.kind === 'priority'"><PriorityIcon :value="col.ref" show-medium /></template>
              <template v-else-if="col.kind === 'assignee'"><Avatar :user="col.user" :size="22" /></template>
              <template v-else-if="col.kind === 'label' && col.label"><span class="size-3 rounded-full" :style="{ background: col.label.dot }"></span></template>

              <input
                v-if="editingBucket === col.ref && col.kind === 'bucket'"
                v-model="bucketName"
                v-focus
                class="input flex-1 font-semibold"
                maxlength="100"
                @keydown.enter="saveBucketName(col)"
                @keydown.esc="editingBucket = null"
                @blur="saveBucketName(col)"
              />
              <h3
                v-else
                class="flex-1 min-w-0 truncate text-sm font-semibold text-ink"
                :class="col.kind === 'due' && col.ref === 'late' ? 'text-[#c50f1f]' : ''"
                @click="col.kind === 'bucket' && startRename(col)"
              >
                {{ col.title }}
                <span class="ml-1 font-normal text-ink-4">{{ col.active.length + col.completed.length }}</span>
              </h3>

              <Popover v-if="col.kind === 'bucket'" placement="bottom-end" close-on-click>
                <template #trigger>
                  <button class="icon-btn !size-7" title="更多選項"><Icon name="more" /></button>
                </template>
                <button class="menu-item" @click="startRename(col)"><Icon name="pencil" />重新命名</button>
                <button class="menu-item !text-[#c50f1f]" @click="removeBucket(col)"><Icon name="trash" />刪除</button>
              </Popover>
            </header>

            <!-- 新增工作 -->
            <div class="shrink-0 mb-2">
              <AddTaskForm
                v-if="addingTo === col.key"
                :defaults="col.defaults"
                @close="addingTo = null"
                v-click-outside="() => (addingTo = null)"
              />
              <button
                v-else-if="col.canDrop"
                class="w-full h-9 flex items-center justify-center gap-1.5 rounded-md bg-white/70 hover:bg-white text-sm text-ink-2 card-shadow cursor-pointer"
                @click="addingTo = col.key"
              >
                <Icon name="plus" :size="16" />新增工作
              </button>
            </div>

            <!-- 工作清單 -->
            <div class="flex-1 min-h-0 overflow-y-auto thin-scroll -mx-1 px-1 pb-6">
              <draggable
                :model-value="col.active"
                item-key="id"
                :group="{ name: 'tasks', put: col.canDrop }"
                class="flex flex-col gap-2 min-h-10"
                ghost-class="drag-ghost"
                :force-fallback="true"
                :fallback-on-body="true"
                fallback-class="drag-fallback"
                :animation="150"
                :delay="250"
                :delay-on-touch-only="true"
                @start="dragFrom = col"
                @change="(e) => onChange(e, col, 'active')"
              >
                <template #item="{ element }">
                  <TaskCard :task="element" />
                </template>
              </draggable>

              <template v-if="col.split && col.completed.length">
                <button
                  class="mt-3 mb-2 inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold text-ink-2 hover:bg-black/5 cursor-pointer"
                  @click="toggleCompleted(col.key)"
                >
                  <Icon :name="showCompleted[col.key] ? 'chevron-down' : 'chevron-right'" :size="14" />
                  已完成的工作 {{ col.completed.length }}
                </button>
                <draggable
                  v-if="showCompleted[col.key]"
                  :model-value="col.completed"
                  item-key="id"
                  :group="{ name: 'tasks', put: col.canDrop }"
                  class="flex flex-col gap-2 min-h-4"
                  :delay="250"
                  :delay-on-touch-only="true"
                  ghost-class="drag-ghost"
                :force-fallback="true"
                :fallback-on-body="true"
                fallback-class="drag-fallback"
                  :animation="150"
                  @start="dragFrom = col"
                  @change="(e) => onChange(e, col, 'completed')"
                >
                  <template #item="{ element }">
                    <TaskCard :task="element" />
                  </template>
                </draggable>
              </template>
            </div>
          </section>
        </template>
      </draggable>

      <!-- 新增貯體 -->
      <section v-if="groupBy === 'bucket'" class="w-[85vw] max-w-[284px] sm:w-[284px] shrink-0 snap-start scroll-ml-3">
        <div v-if="addingBucket" class="h-10 flex items-center">
          <input
            v-model="newBucketName"
            v-focus
            class="input font-semibold"
            placeholder="輸入貯體名稱"
            maxlength="100"
            @keydown.enter="addBucket"
            @keydown.esc="addingBucket = false"
            @blur="addBucket"
          />
        </div>
        <button v-else class="h-10 px-1 text-sm font-semibold text-accent hover:underline cursor-pointer" @click="addingBucket = true">
          新增貯體
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import draggable from 'vuedraggable';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import Popover from '../Popover.vue';
import TaskCard from '../TaskCard.vue';
import ProgressIcon from '../ProgressIcon.vue';
import PriorityIcon from '../PriorityIcon.vue';
import AddTaskForm from './AddTaskForm.vue';
import { buildColumns } from '@/utils/grouping';
import { sortOrderAt } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({
  tasks: { type: Array, required: true },
  groupBy: { type: String, default: 'bucket' },
});

const planStore = usePlanStore();
const ui = useUiStore();

const columns = computed(() => buildColumns(props.groupBy, props.tasks, {
  buckets: planStore.sortedBuckets,
  members: planStore.members,
  labelNames: planStore.plan?.labelNames,
}));

const addingTo = ref(null);
const dragFrom = ref(null);
const showCompleted = reactive({});
const editingBucket = ref(null);
const bucketName = ref('');
const addingBucket = ref(false);
const newBucketName = ref('');

const vFocus = { mounted: (el) => { el.focus(); el.select?.(); } };
const vClickOutside = {
  mounted(el, binding) {
    el._outside = (e) => {
      if (!el.contains(e.target) && !e.target.closest?.('.menu')) binding.value(e);
    };
    setTimeout(() => document.addEventListener('mousedown', el._outside));
  },
  unmounted(el) {
    document.removeEventListener('mousedown', el._outside);
  },
};

function toggleCompleted(key) {
  showCompleted[key] = !showCompleted[key];
}

// 卡片拖曳
async function onChange(e, col, listName) {
  const evt = e.added || e.moved;
  if (!evt) return;
  const task = evt.element;
  const list = col[listName].filter((t) => t.id !== task.id);
  const patch = {};

  if (e.added) Object.assign(patch, col.patch(task, dragFrom.value));
  if (props.groupBy === 'bucket' || e.moved) patch.sortOrder = sortOrderAt(list, evt.newIndex);
  if (listName === 'completed' && task.progress !== 100) patch.progress = 100;
  if (listName === 'active' && col.split && task.progress === 100) patch.progress = 0;

  if (!Object.keys(patch).length) return;
  try {
    await planStore.updateTask(task.id, patch);
  } catch (err) {
    ui.error(err);
  }
}

// 貯體排序
async function onBucketMove(e) {
  if (!e.moved) return;
  const bucket = e.moved.element.bucket;
  const list = planStore.sortedBuckets.filter((b) => b.id !== bucket.id);
  try {
    await planStore.updateBucket(bucket.id, { sortOrder: sortOrderAt(list, e.moved.newIndex) });
  } catch (err) {
    ui.error(err);
  }
}

function startRename(col) {
  editingBucket.value = col.ref;
  bucketName.value = col.title;
}
async function saveBucketName(col) {
  if (editingBucket.value !== col.ref) return;
  editingBucket.value = null;
  const name = bucketName.value.trim();
  if (!name || name === col.title) return;
  try {
    await planStore.updateBucket(col.ref, { name });
  } catch (err) {
    ui.error(err);
  }
}
async function removeBucket(col) {
  const count = col.active.length + col.completed.length;
  const ok = await ui.confirm({
    title: '刪除貯體',
    message: `確定要刪除貯體「${col.title}」嗎？${count ? `\n其中的 ${count} 個工作也會一併刪除。` : ''}`,
  });
  if (!ok) return;
  try {
    await planStore.deleteBucket(col.ref);
  } catch (err) {
    ui.error(err);
  }
}
async function addBucket() {
  const name = newBucketName.value.trim();
  addingBucket.value = false;
  newBucketName.value = '';
  if (!name) return;
  try {
    await planStore.createBucket(name);
  } catch (err) {
    ui.error(err);
  }
}
</script>
