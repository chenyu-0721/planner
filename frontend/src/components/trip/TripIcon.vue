<template>
  <span
    class="inline-flex items-center justify-center rounded-[4px] text-white shrink-0"
    :style="{ width: `${size}px`, height: `${size}px`, background: planColor(color) }"
  >
    <Icon name="plane" :size="Math.round(size * 0.55)" />
  </span>
</template>

<script setup>
import Icon from '../Icon.vue';
import { planColor } from '@/utils/planner';

defineProps({
  color: { type: Number, default: 0 },
  size: { type: Number, default: 32 },
});
</script>
