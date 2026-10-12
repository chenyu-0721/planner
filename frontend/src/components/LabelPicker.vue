<template>
  <div class="w-72">
    <div class="px-2 pt-1 pb-1.5">
      <input ref="searchEl" v-model="keyword" class="input" placeholder="搜尋標籤" />
    </div>
    <div class="max-h-72 overflow-y-auto thin-scroll py-1">
      <div v-for="l in shown" :key="l.id" class="flex items-center gap-1 px-2 h-9 hover:bg-hover group/label">
        <template v-if="editing === l.id">
          <span class="size-4 rounded-full shrink-0" :style="{ background: l.dot }"></span>
          <input
            v-model="editName"
            v-focus
            class="input !h-7 flex-1"
            :placeholder="l.name"
            maxlength="50"
            @keydown.enter="saveName(l)"
            @keydown.esc="editing = null"
          />
          <button class="icon-btn !size-7" title="儲存" @click="saveName(l)"><Icon name="check" :size="15" /></button>
        </template>
        <template v-else>
          <button class="flex-1 min-w-0 flex items-center gap-2 h-full cursor-pointer text-left" @click="toggle(l.id)">
            <span class="w-4 shrink-0 text-accent"><Icon v-if="modelValue.includes(l.id)" name="check" :size="16" :stroke="2.4" /></span>
            <LabelPill :id="l.id" :label-names="labelNames" />
          </button>
          <button class="icon-btn !size-7 opacity-0 group-hover/label:opacity-100" title="重新命名標籤" @click="startEdit(l)">
            <Icon name="pencil" :size="13" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import LabelPill from './LabelPill.vue';
import { LABELS, labelName } from '@/utils/planner';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  labelNames: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:modelValue', 'rename']);
const keyword = ref('');
const editing = ref(null);
const editName = ref('');
const searchEl = ref(null);
const vFocus = { mounted: (el) => el.focus() };

const shown = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return LABELS;
  return LABELS.filter((l) => labelName(props.labelNames, l.id).toLowerCase().includes(kw) || l.name.includes(kw));
});

function toggle(id) {
  const ids = props.modelValue.includes(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id];
  emit('update:modelValue', ids);
}
function startEdit(l) {
  editing.value = l.id;
  editName.value = props.labelNames?.[l.id] || '';
}
function saveName(l) {
  emit('rename', l.id, editName.value.trim());
  editing.value = null;
}
onMounted(() => searchEl.value?.focus());
</script>
