<template>
  <!-- 電腦版：從右側滑出的面板，後面的看板仍可操作；手機版改用全螢幕對話框 -->
  <Modal v-if="ui.isMobile" :model-value="modelValue" :width="width" @update:model-value="$emit('update:modelValue', $event)">
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <slot />
  </Modal>
  <Teleport v-else to="body">
    <Transition name="side-panel">
      <aside
        v-if="modelValue"
        class="fixed right-0 bottom-0 top-12 z-30 flex flex-col bg-white border-l border-line shadow-[-8px_0_28px_rgba(0,0,0,.12)]"
        :style="{ width: `min(${width}, 100vw - 320px)` }"
        role="dialog"
      >
        <div class="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 h-12 border-b border-line">
          <div class="min-w-0 flex-1"><slot name="header" /></div>
          <slot name="actions" />
          <button class="icon-btn -mr-2" title="關閉（Esc）" @click="$emit('update:modelValue', false)">
            <Icon name="x" :size="18" />
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto thin-scroll pt-4">
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue';
import Modal, { anyModalOpen } from './Modal.vue';
import Icon from './Icon.vue';
import { useUiStore } from '@/stores/ui';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  width: { type: String, default: '600px' },
});
const emit = defineEmits(['update:modelValue']);
const ui = useUiStore();

function onKey(e) {
  if (e.key !== 'Escape' || ui.isMobile || anyModalOpen() || document.querySelector('.menu')) return;
  // 正在輸入時先離開輸入框，再按一次 Esc 才關閉
  if (document.activeElement?.matches?.('input, textarea, select')) {
    document.activeElement.blur();
    return;
  }
  emit('update:modelValue', false);
}
watch(() => props.modelValue, (v) => {
  if (v) document.addEventListener('keydown', onKey);
  else document.removeEventListener('keydown', onKey);
}, { immediate: true });
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<style scoped>
.side-panel-enter-active,
.side-panel-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.side-panel-enter-from,
.side-panel-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
