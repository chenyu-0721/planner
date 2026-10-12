<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 flex items-start justify-center bg-black/40 overflow-y-auto"
        :style="{ zIndex }"
        :class="fullOnMobile ? 'p-0 sm:py-10 sm:px-4' : 'py-10 px-4'"
        @mousedown.self="onBackdrop"
      >
        <div
          class="relative bg-white shadow-[0_25.6px_57.6px_rgba(0,0,0,.22),0_4.8px_14.4px_rgba(0,0,0,.18)] w-full"
          :class="fullOnMobile ? 'min-h-full sm:min-h-0 rounded-none sm:rounded-lg' : 'rounded-lg'"
          :style="{ maxWidth: width }"
        >
          <div v-if="title || $slots.header" class="sticky top-0 z-10 bg-white sm:rounded-t-lg flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
            <slot name="header">
              <h2 class="text-xl font-semibold text-ink">{{ title }}</h2>
            </slot>
            <button class="icon-btn -mr-2" title="關閉" @click="$emit('update:modelValue', false)">
              <Icon name="x" :size="18" />
            </button>
          </div>
          <slot />
          <div v-if="$slots.footer" class="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
// 同時開啟的對話框（確認框疊在編輯框上）。後開的在最上層，Esc 只關最上面那個。
const modalStack = [];
let modalSeq = 0;
</script>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '480px' },
  closeOnBackdrop: { type: Boolean, default: true },
  zIndex: { type: Number, default: 40 },
});
const emit = defineEmits(['update:modelValue']);
const id = ++modalSeq;
// 較寬的對話框在手機上改為全螢幕
const fullOnMobile = computed(() => parseInt(props.width, 10) > 480);

function isTop() {
  return modalStack[modalStack.length - 1] === id;
}
function onBackdrop() {
  if (props.closeOnBackdrop && isTop()) emit('update:modelValue', false);
}
function onKey(e) {
  if (e.key === 'Escape' && isTop() && !document.querySelector('.menu')) emit('update:modelValue', false);
}
watch(
  () => props.modelValue,
  (v) => {
    const i = modalStack.lastIndexOf(id);
    if (v) {
      if (i === -1) modalStack.push(id);
      document.addEventListener('keydown', onKey);
    } else {
      if (i !== -1) modalStack.splice(i, 1);
      document.removeEventListener('keydown', onKey);
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  const i = modalStack.lastIndexOf(id);
  if (i !== -1) modalStack.splice(i, 1);
  document.removeEventListener('keydown', onKey);
});
</script>
