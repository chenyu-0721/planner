<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="c in COLORS"
      :key="c"
      type="button"
      class="size-6 rounded-full cursor-pointer ring-offset-1"
      :class="c === value ? 'ring-2 ring-accent' : ''"
      :style="{ background: c }"
      :title="c"
      @click="emit('update:modelValue', c)"
    ></button>
    <!-- 自訂：瀏覽器內建的取色器，可選任何顏色 -->
    <label
      class="relative size-6 rounded-full cursor-pointer ring-offset-1 overflow-hidden flex items-center justify-center"
      :class="custom ? 'ring-2 ring-accent' : 'border border-dashed border-line-2'"
      :style="custom ? { background: value } : { background: 'conic-gradient(#d13438, #ca5010, #c19c00, #107c10, #038387, #0078d4, #8764b8, #c239b3, #d13438)' }"
      title="自訂顏色"
    >
      <input type="color" class="absolute inset-0 opacity-0 cursor-pointer" :value="value || '#0078d4'" @input="emit('update:modelValue', $event.target.value.toLowerCase())" />
    </label>
    <input
      class="input !h-7 !w-24 font-mono text-xs"
      :value="value"
      maxlength="7"
      placeholder="#0078d4"
      title="色碼"
      @change="onHex"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);

const COLORS = ['#0078d4', '#004e8c', '#038387', '#498205', '#107c10', '#986f0b', '#ca5010', '#d13438', '#c239b3', '#8764b8', '#5c2e91', '#69797e'];
const value = computed(() => (props.modelValue || '').toLowerCase());
const custom = computed(() => !!value.value && !COLORS.includes(value.value));

function onHex(e) {
  let v = e.target.value.trim().toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${[...v.slice(1)].map((ch) => ch + ch).join('')}`;
  if (/^#[0-9a-f]{6}$/.test(v)) emit('update:modelValue', v);
  else e.target.value = props.modelValue; // 格式不對就還原
}
</script>
