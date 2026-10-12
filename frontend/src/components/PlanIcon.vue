<template>
  <span
    class="inline-flex items-center justify-center rounded-[4px] text-white font-semibold shrink-0 select-none"
    :style="{ width: `${size}px`, height: `${size}px`, background: planColor(plan?.color), fontSize: `${Math.round(size * 0.42)}px` }"
  >
    {{ initials(plan?.name || '', true) }}
  </span>
</template>

<script setup>
import { initials, planColor } from '@/utils/planner';

defineProps({
  plan: { type: Object, default: null },
  size: { type: Number, default: 32 },
});
</script>
