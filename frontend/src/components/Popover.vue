<template>
  <span ref="triggerEl" class="inline-flex" :class="block ? 'w-full' : ''" @click.stop="toggle">
    <slot name="trigger" :open="open" />
  </span>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelEl"
      class="menu fixed"
      :class="panelClass"
      :style="style"
      @click.stop="onPanelClick"
      @mousedown.stop
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps({
  placement: { type: String, default: 'bottom-start' }, // bottom-start | bottom-end
  panelClass: { type: String, default: '' },
  closeOnClick: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
});
const emit = defineEmits(['open', 'close']);

const open = ref(false);
const triggerEl = ref(null);
const panelEl = ref(null);
const style = ref({});

function position() {
  const t = triggerEl.value?.getBoundingClientRect();
  const p = panelEl.value?.getBoundingClientRect();
  if (!t || !p) return;
  let left = props.placement === 'bottom-end' ? t.right - p.width : t.left;
  left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8));
  let top = t.bottom + 4;
  if (top + p.height > window.innerHeight - 8) {
    top = t.top - p.height - 4 >= 8 ? t.top - p.height - 4 : Math.max(8, window.innerHeight - p.height - 8);
  }
  style.value = { left: `${left}px`, top: `${top}px` };
}

function onDocDown() {
  close();
}
function onKey(e) {
  if (e.key === 'Escape') close();
}

async function show() {
  open.value = true;
  style.value = { left: '-9999px', top: '0px' };
  emit('open');
  await nextTick();
  position();
  document.addEventListener('mousedown', onDocDown);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', close);
}
function close() {
  if (!open.value) return;
  open.value = false;
  emit('close');
  document.removeEventListener('mousedown', onDocDown);
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', close);
}
function toggle() {
  if (open.value) close();
  else show();
}
function onPanelClick() {
  if (props.closeOnClick) close();
}

onBeforeUnmount(close);
defineExpose({ close, show, reposition: () => nextTick(position) });
</script>
