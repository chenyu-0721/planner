<template>
  <span
    class="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none ring-white"
    :class="ring ? 'ring-2' : ''"
    :style="{ width: px, height: px, fontSize: fontPx, background: user?.color || '#8a8886' }"
    :title="user?.displayName"
  >
    <template v-if="user">{{ initials(user.displayName) }}</template>
    <Icon v-else name="user" :size="size * 0.55" />
  </span>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import { initials } from '@/utils/planner';

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: Number, default: 28 },
  ring: { type: Boolean, default: false },
});
const px = computed(() => `${props.size}px`);
const fontPx = computed(() => `${Math.max(9, Math.round(props.size * 0.38))}px`);
</script>
