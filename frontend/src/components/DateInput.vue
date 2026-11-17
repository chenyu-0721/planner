<template>
  <div class="relative min-w-0">
    <div class="input pointer-events-none flex items-center gap-2 !pr-2 overflow-hidden" :class="displayClass">
      <Icon v-if="icon" name="calendar" :size="14" class="shrink-0 text-ink-3" />
      <span class="min-w-0 truncate" :class="modelValue ? '' : 'text-ink-4'">{{ modelValue ? fmtShort(modelValue) : placeholder }}</span>
    </div>
    <input
      type="date"
      class="date-overlay"
      :value="modelValue || ''"
      :min="min || undefined"
      :max="max || undefined"
      :title="placeholder"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<script setup>
import Icon from './Icon.vue';
import { fmtShort } from '@/utils/planner';

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '選擇日期' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  icon: { type: Boolean, default: false },
  displayClass: { type: [String, Array, Object], default: '' },
});
const emit = defineEmits(['update:modelValue']);
</script>
