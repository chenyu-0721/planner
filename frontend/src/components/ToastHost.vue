<template>
  <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
    <TransitionGroup name="fade">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white card-shadow-hover"
        :class="t.type === 'error' ? 'bg-[#c50f1f]' : t.type === 'success' ? 'bg-[#107c10]' : 'bg-[#323130]'"
      >
        <Icon :name="t.type === 'error' ? 'info' : 'check'" :size="16" />
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import Icon from './Icon.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>
