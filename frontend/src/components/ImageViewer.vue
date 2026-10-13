<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="current" class="fixed inset-0 z-[90] flex flex-col bg-black/90 select-none" @click.self="close">
        <!-- 上方：檔名、開新分頁、關閉 -->
        <div class="flex items-center gap-2 h-12 px-3 text-white shrink-0">
          <span class="flex-1 min-w-0 truncate text-sm">{{ current.name }}</span>
          <span v-if="images.length > 1" class="text-xs text-white/70 tabular-nums">{{ index + 1 }} / {{ images.length }}</span>
          <a :href="current.url" target="_blank" rel="noopener" class="h-8 px-2.5 rounded text-sm flex items-center gap-1 hover:bg-white/15" title="在新分頁開啟原始圖片">
            <Icon name="external" :size="15" /><span class="hidden sm:inline">原始檔</span>
          </a>
          <button class="size-8 rounded flex items-center justify-center hover:bg-white/15 cursor-pointer" title="關閉（Esc）" @click="close">
            <Icon name="x" :size="18" />
          </button>
        </div>

        <!-- 圖片：預設縮放到畫面內，點一下看原始大小（可捲動），再點一下縮回 -->
        <div
          class="relative flex-1 min-h-0"
          :class="actual ? 'overflow-auto' : 'flex items-center justify-center p-2 sm:p-6'"
          @click.self="close"
        >
          <img
            :key="current.url"
            :src="current.url"
            :alt="current.name"
            class="block"
            :class="actual ? 'max-w-none m-auto cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'"
            @click="actual = !actual"
          />
        </div>

        <template v-if="images.length > 1">
          <button class="nav-btn left-2 sm:left-4" title="上一張（←）" @click="go(-1)"><Icon name="chevron-left" :size="22" /></button>
          <button class="nav-btn right-2 sm:right-4" title="下一張（→）" @click="go(1)"><Icon name="chevron-right" :size="22" /></button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Icon from './Icon.vue';

// images: [{ url, name }]；v-model:index 為目前顯示第幾張（null = 關閉）
const props = defineProps({
  images: { type: Array, default: () => [] },
  index: { type: Number, default: null },
});
const emit = defineEmits(['update:index']);

const actual = ref(false);
const current = computed(() => (props.index == null ? null : props.images[props.index] || null));

function close() {
  emit('update:index', null);
}
function go(step) {
  const n = props.images.length;
  emit('update:index', (props.index + step + n) % n);
}

// 用 capture 先攔下鍵盤，避免 Esc 連同後面的工作視窗一起關掉
function onKey(e) {
  if (!current.value) return;
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowLeft' && props.images.length > 1) go(-1);
  else if (e.key === 'ArrowRight' && props.images.length > 1) go(1);
  else return;
  e.preventDefault();
  e.stopPropagation();
}
watch(current, (img, old) => {
  actual.value = false;
  if (img && !old) window.addEventListener('keydown', onKey, true);
  if (!img) window.removeEventListener('keydown', onKey, true);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true));
</script>

<style scoped>
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
}
.nav-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
