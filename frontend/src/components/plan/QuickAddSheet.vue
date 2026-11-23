<template>
  <!-- 手機版：從底部彈出的「新增工作」，可以選要放在哪個貯體 -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="fixed inset-0 z-40 bg-black/40" @click="$emit('update:modelValue', false)"></div>
    </Transition>
    <Transition name="sheet-up">
      <div
        v-if="modelValue"
        class="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-canvas shadow-[0_-4px_18px_rgba(0,0,0,.16)] pb-[calc(12px+env(safe-area-inset-bottom))]"
      >
        <div class="pt-2 pb-1 flex justify-center"><span class="w-10 h-1.5 rounded-full bg-line-2"></span></div>
        <div class="flex items-center justify-between px-4 pb-2">
          <h2 class="text-base font-semibold">新增工作</h2>
          <button class="icon-btn" title="關閉" @click="$emit('update:modelValue', false)"><Icon name="x" :size="18" /></button>
        </div>
        <div class="px-4 pb-2">
          <div class="text-xs text-ink-3 mb-1.5">放在</div>
          <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
            <button
              v-for="b in planStore.sortedBuckets"
              :key="b.id"
              class="chip shrink-0"
              :class="bucketId === b.id ? 'chip-on' : ''"
              @click="bucketId = b.id"
            >
              {{ b.name }}
            </button>
          </div>
        </div>
        <div class="px-4">
          <AddTaskForm :key="bucketId" :defaults="{ ...defaults, bucketId }" @created="onCreated" @close="$emit('update:modelValue', false)" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import Icon from '../Icon.vue';
import AddTaskForm from './AddTaskForm.vue';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({
  modelValue: Boolean,
  initialBucketId: { type: Number, default: null },
  defaults: { type: Object, default: () => ({}) },
});
defineEmits(['update:modelValue']);
const planStore = usePlanStore();
const ui = useUiStore();
const bucketId = ref(null);

watch(() => props.modelValue, (v) => {
  if (!v) return;
  const ids = planStore.sortedBuckets.map((b) => b.id);
  bucketId.value = ids.includes(props.initialBucketId) ? props.initialBucketId : ids[0] ?? null;
});

function onCreated(task) {
  ui.toast(`已新增「${task.title}」`, 'success');
}
</script>
