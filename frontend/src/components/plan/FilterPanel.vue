<template>
  <div class="w-[300px] max-h-[70vh] overflow-y-auto thin-scroll pb-1">
    <div class="flex items-center justify-between px-3 pt-2 pb-1">
      <span class="text-sm font-semibold">篩選</span>
      <button class="text-xs text-accent hover:underline cursor-pointer disabled:text-ink-4 disabled:no-underline" :disabled="!count" @click="clear">全部清除</button>
    </div>
    <div class="px-3 pb-2">
      <input v-model="modelValue.keyword" class="input" placeholder="依關鍵字篩選" />
    </div>

    <Section title="到期日" :count="modelValue.due.length">
      <Check v-for="g in DUE_GROUPS" :key="g.key" :checked="modelValue.due.includes(g.key)" @toggle="toggle('due', g.key)">
        <span :class="g.key === 'late' ? 'text-[#c50f1f]' : ''">{{ g.label }}</span>
      </Check>
    </Section>

    <Section title="優先順序" :count="modelValue.priority.length">
      <Check v-for="p in PRIORITIES" :key="p.value" :checked="modelValue.priority.includes(p.value)" @toggle="toggle('priority', p.value)">
        <PriorityIcon :value="p.value" show-medium />{{ p.label }}
      </Check>
    </Section>

    <Section title="進度" :count="modelValue.progress.length">
      <Check v-for="p in PROGRESS" :key="p.value" :checked="modelValue.progress.includes(p.value)" @toggle="toggle('progress', p.value)">
        <ProgressIcon :value="p.value" :size="14" />{{ p.label }}
      </Check>
    </Section>

    <Section title="標籤" :count="modelValue.labels.length">
      <Check v-for="l in LABELS" :key="l.id" :checked="modelValue.labels.includes(l.id)" @toggle="toggle('labels', l.id)">
        <LabelPill :id="l.id" :label-names="labelNames" />
      </Check>
    </Section>

    <Section v-if="buckets.length" title="貯體" :count="modelValue.buckets.length">
      <Check v-for="b in buckets" :key="b.id" :checked="modelValue.buckets.includes(b.id)" @toggle="toggle('buckets', b.id)">
        <span class="truncate">{{ b.name }}</span>
      </Check>
    </Section>

    <Section title="指派對象" :count="modelValue.assignees.length">
      <Check :checked="modelValue.assignees.includes(0)" @toggle="toggle('assignees', 0)">
        <Avatar :size="20" />未指派
      </Check>
      <Check v-for="m in members" :key="m.id" :checked="modelValue.assignees.includes(m.id)" @toggle="toggle('assignees', m.id)">
        <Avatar :user="m" :size="20" /><span class="truncate">{{ m.displayName }}</span>
      </Check>
    </Section>
  </div>
</template>

<script setup>
import { computed, h, ref } from 'vue';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import LabelPill from '../LabelPill.vue';
import ProgressIcon from '../ProgressIcon.vue';
import PriorityIcon from '../PriorityIcon.vue';
import {
  DUE_GROUPS, PRIORITIES, PROGRESS, LABELS, countFilters, emptyFilters,
} from '@/utils/planner';

const props = defineProps({
  modelValue: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  buckets: { type: Array, default: () => [] },
  labelNames: { type: Object, default: () => ({}) },
});

const count = computed(() => countFilters(props.modelValue));

function toggle(key, value) {
  const arr = props.modelValue[key];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
}
function clear() {
  Object.assign(props.modelValue, emptyFilters());
}

const Section = {
  props: ['title', 'count'],
  setup(p, { slots }) {
    const open = ref(!!p.count);
    return () => h('div', { class: 'border-t border-line' }, [
      h('button', {
        class: 'w-full flex items-center justify-between px-3 h-9 text-sm hover:bg-hover cursor-pointer',
        onClick: () => { open.value = !open.value; },
      }, [
        h('span', { class: 'font-semibold' }, [p.title, p.count ? h('span', { class: 'ml-1.5 text-accent' }, `(${p.count})`) : null]),
        h(Icon, { name: open.value ? 'chevron-up' : 'chevron-down', size: 14 }),
      ]),
      open.value ? h('div', { class: 'pb-1' }, slots.default?.()) : null,
    ]);
  },
};

const Check = {
  props: ['checked'],
  emits: ['toggle'],
  setup(p, { slots, emit }) {
    return () => h('label', { class: 'flex items-center gap-2 px-3 h-8 text-sm hover:bg-hover cursor-pointer' }, [
      h('input', { type: 'checkbox', class: 'accent-accent', checked: p.checked, onChange: () => emit('toggle') }),
      h('span', { class: 'flex items-center gap-1.5 min-w-0' }, slots.default?.()),
    ]);
  },
};
</script>
