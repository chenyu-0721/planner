<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 h-5 text-xs font-semibold max-w-full truncate leading-none"
    :style="{ background: info.bg, color: info.fg }"
    :title="text"
  >
    <span class="truncate">{{ text }}</span>
    <button v-if="removable" class="opacity-70 hover:opacity-100 cursor-pointer" @click.stop="$emit('remove')">
      <Icon name="x" :size="11" :stroke="2.4" />
    </button>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import { labelInfo, labelName } from '@/utils/planner';

const props = defineProps({
  id: { type: Number, required: true },
  labelNames: { type: Object, default: () => ({}) },
  removable: { type: Boolean, default: false },
});
defineEmits(['remove']);
const info = computed(() => labelInfo(props.id));
const text = computed(() => labelName(props.labelNames, props.id));
</script>
