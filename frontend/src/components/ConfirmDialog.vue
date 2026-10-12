<template>
  <Modal :model-value="!!state" :title="state?.title" width="440px" :z-index="80" @update:model-value="ui.resolveConfirm(false)">
    <p class="px-6 pb-4 text-sm text-ink-2 whitespace-pre-line">{{ state?.message }}</p>
    <template #footer>
      <button :class="['btn', state?.danger ? 'btn-danger' : 'btn-primary']" @click="ui.resolveConfirm(true)">
        {{ state?.okText }}
      </button>
      <button class="btn btn-default" @click="ui.resolveConfirm(false)">取消</button>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import Modal from './Modal.vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const state = computed(() => ui.confirmState);
</script>
