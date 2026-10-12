<template>
  <span v-if="value === 1" class="inline-flex text-[#c50f1f]" title="緊急"><Icon name="bell" :size="size" :stroke="2" /></span>
  <span v-else-if="value === 3" class="inline-flex text-[#c50f1f]" title="重要"><Icon name="exclamation" :size="size" :stroke="2.6" /></span>
  <span v-else-if="value === 9" class="inline-flex text-[#0f6cbd]" title="低"><Icon name="arrow-down" :size="size" :stroke="2" /></span>
  <span v-else-if="showMedium" class="inline-flex text-ink-3" title="中">
    <svg :width="size" :height="size" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor" /></svg>
  </span>
</template>

<script setup>
import Icon from './Icon.vue';

defineProps({
  value: { type: Number, default: 5 },
  size: { type: Number, default: 14 },
  showMedium: { type: Boolean, default: false },
});
</script>
