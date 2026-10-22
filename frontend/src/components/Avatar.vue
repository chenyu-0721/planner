<template>
  <span
    class="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none ring-white"
    :class="ring ? 'ring-2' : ''"
    :style="{ width: px, height: px, fontSize: fontPx, background: bg, color: textColor }"
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
const bg = computed(() => props.user?.color || '#8a8886');
// 自訂成淺色（例如黃色）時改用深色字，名字才看得清楚
const textColor = computed(() => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(bg.value);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#242424' : '#fff';
});
</script>
