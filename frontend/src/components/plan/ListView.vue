<template>
  <!-- 手機版的「格線」：依貯體分組的清單，點一下開啟詳細資料 -->
  <div class="flex-1 min-h-0 overflow-y-auto thin-scroll px-3 pt-3 pb-24">
    <div v-if="!tasks.length" class="py-16 text-center text-sm text-ink-3">沒有符合的工作</div>

    <section v-for="g in groups" :key="g.bucket.id" class="mb-3">
      <header class="flex items-center gap-1 h-9 px-1">
        <button class="flex-1 min-w-0 flex items-center gap-1 text-left cursor-pointer" @click="toggle(g.bucket.id)">
          <Icon :name="collapsed[g.bucket.id] ? 'chevron-right' : 'chevron-down'" :size="14" class="text-ink-3 shrink-0" />
          <span class="truncate text-sm font-semibold">{{ g.bucket.name }}</span>
          <span class="text-xs text-ink-4 ml-1">{{ g.active.length }}</span>
        </button>
        <button class="icon-btn !size-8" title="新增工作到這個貯體" @click="$emit('add', g.bucket.id)"><Icon name="plus" :size="16" /></button>
      </header>

      <div v-if="!collapsed[g.bucket.id]" class="rounded-xl bg-white card-shadow overflow-hidden divide-y divide-line">
        <TaskRow v-for="t in g.active" :key="t.id" :task="t" />
        <button
          v-if="g.done.length"
          class="w-full flex items-center gap-1 h-10 px-3 text-xs font-semibold text-ink-3 cursor-pointer"
          @click="showDone[g.bucket.id] = !showDone[g.bucket.id]"
        >
          <Icon :name="showDone[g.bucket.id] ? 'chevron-down' : 'chevron-right'" :size="13" />已完成 {{ g.done.length }}
        </button>
        <template v-if="showDone[g.bucket.id]">
          <TaskRow v-for="t in g.done" :key="t.id" :task="t" />
        </template>
        <div v-if="!g.active.length && !g.done.length" class="px-3 py-3 text-xs text-ink-4">沒有工作</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, reactive } from 'vue';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import ProgressIcon from '../ProgressIcon.vue';
import PriorityIcon from '../PriorityIcon.vue';
import LabelPill from '../LabelPill.vue';
import { bySort, fmtShort, isLate } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({ tasks: { type: Array, required: true } });
defineEmits(['add']);
const planStore = usePlanStore();
const ui = useUiStore();
const collapsed = reactive({});
const showDone = reactive({});

const groups = computed(() => planStore.sortedBuckets.map((bucket) => {
  const list = props.tasks.filter((t) => t.bucketId === bucket.id).sort(bySort);
  return { bucket, active: list.filter((t) => t.progress !== 100), done: list.filter((t) => t.progress === 100) };
}));
const toggle = (id) => { collapsed[id] = !collapsed[id]; };

async function update(t, patch) {
  try {
    await planStore.updateTask(t.id, patch);
  } catch (e) {
    ui.error(e);
  }
}

// 一列工作：完成鈕、名稱、到期日與其他資訊、負責人
const TaskRow = defineComponent({
  props: { task: { type: Object, required: true } },
  setup(p) {
    return () => {
      const t = p.task;
      const done = t.progress === 100;
      const late = isLate(t);
      const people = t.assigneeIds.map((id) => planStore.memberMap[id]).filter(Boolean);
      const meta = [];
      if (t.priority !== 5) meta.push(h(PriorityIcon, { value: t.priority }));
      if (t.progress === 50) meta.push(h(ProgressIcon, { value: 50, size: 13 }));
      if (t.dueDate) {
        meta.push(h('span', {
          class: ['inline-flex items-center gap-1 rounded px-1 h-5', late ? 'bg-[#c50f1f] text-white' : ''],
        }, [h(Icon, { name: 'calendar', size: 12 }), fmtShort(t.dueDate)]));
      }
      if (t.checklistTotal) meta.push(h('span', { class: 'inline-flex items-center gap-0.5' }, [h(Icon, { name: 'checklist', size: 13 }), `${t.checklistDone}/${t.checklistTotal}`]));
      if (t.commentCount) meta.push(h('span', { class: 'inline-flex items-center gap-0.5' }, [h(Icon, { name: 'comment', size: 12 }), t.commentCount]));
      for (const l of t.labels.slice(0, 2)) meta.push(h(LabelPill, { id: l, labelNames: planStore.plan?.labelNames }));

      return h('div', {
        class: ['flex items-start gap-2.5 px-3 py-2.5 min-h-12 cursor-pointer active:bg-hover', ui.detail?.taskId === t.id ? 'bg-[#eff6fc]' : ''],
        onClick: () => ui.openTask(t),
      }, [
        h('button', {
          class: 'mt-0.5 shrink-0 cursor-pointer',
          title: done ? '標示為未完成' : '標示為完成',
          onClick: (e) => { e.stopPropagation(); update(t, { progress: done ? 0 : 100 }); },
        }, [h(ProgressIcon, { value: done ? 100 : 0, size: 20 })]),
        h('div', { class: 'flex-1 min-w-0' }, [
          h('div', { class: ['text-[15px] leading-5 break-words', done ? 'line-through text-ink-3' : 'text-ink'] }, t.title),
          meta.length ? h('div', { class: 'mt-1 flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-ink-3' }, meta) : null,
        ]),
        people.length ? h('div', { class: 'flex -space-x-1.5 shrink-0 mt-0.5' }, people.slice(0, 3).map((u) => h(Avatar, { user: u, size: 22, ring: true }))) : null,
      ]);
    };
  },
});
</script>
