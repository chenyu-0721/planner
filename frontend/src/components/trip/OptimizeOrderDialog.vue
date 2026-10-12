<template>
  <Modal :model-value="!!group" title="最佳順序" width="520px" @update:model-value="close">
    <div v-if="group" class="px-4 sm:px-6 pb-2 space-y-4">
      <p class="text-xs text-ink-3 leading-5">
        {{ group.title }}（{{ group.subtitle }}）從第一個地點「{{ group.stops[0].title }}」出發，重新排列中間的地點，讓總移動時間最短。
      </p>

      <label class="flex items-start gap-2 text-sm cursor-pointer">
        <input v-model="fixEnd" type="checkbox" class="mt-1" :disabled="group.stops.length < 4" />
        <span>最後一站也固定（「{{ group.stops[group.stops.length - 1].title }}」，例如回到住宿）</span>
      </label>

      <div v-if="loading" class="py-6 text-center text-sm text-ink-3">計算各地點之間的移動時間…</div>
      <template v-else-if="result">
        <div class="rounded-md px-3 py-2 text-sm" :class="saved > 0 ? 'bg-[#dff6dd] text-[#0e700e]' : 'bg-hover text-ink-2'">
          <template v-if="saved > 0">
            移動時間 {{ fmtDuration(result.before) }} → <b>{{ fmtDuration(result.after) }}</b>，約省 {{ fmtDuration(saved) }}
          </template>
          <template v-else>目前的順序已經是最順的了</template>
        </div>
        <p class="text-[11px] leading-4 text-ink-4">
          {{ result.byRoad ? `以「${modeLabel}」的道路時間比較` : '以直線距離估算' }}；高鐵、火車等個別路段不列入計算。
        </p>

        <ol class="rounded border border-line">
          <li v-for="(s, i) in ordered" :key="s.id" class="flex items-center gap-2 px-3 py-1.5 border-b border-line last:border-0">
            <span class="size-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" :style="{ background: group.color }">{{ i + 1 }}</span>
            <span class="flex-1 min-w-0 truncate text-sm">{{ categoryInfo(s.category).emoji }} {{ s.title }}</span>
            <span v-if="moved(s, i)" class="text-[11px] text-accent shrink-0">原第 {{ group.stops.indexOf(s) + 1 }} 站</span>
          </li>
        </ol>

        <ul v-if="saved > 0 && (resetModes.length || hasTimes)" class="text-xs text-ink-3 leading-5 list-disc pl-4">
          <li v-if="resetModes.length">前後站改變的 {{ resetModes.length }} 段，交通方式會改回預設、交通費會清除。</li>
          <li v-if="hasTimes">這天已經排了時間，套用後會開啟「自動排時間」重新計算。</li>
        </ul>
      </template>
      <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>
    </div>
    <template #footer>
      <button class="btn btn-default" @click="close">取消</button>
      <button class="btn btn-primary" :disabled="saving || loading || !(saved > 0)" @click="apply">套用新順序</button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import {
  categoryInfo, travelModeInfo, travelMatrix, bestOrder, orderCost, fmtDuration,
} from '@/utils/trip';

const props = defineProps({
  group: { type: Object, default: null },
  travelMode: { type: String, default: 'car' },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'apply']);

const fixEnd = ref(false);
const loading = ref(false);
const error = ref('');
const matrix = ref(null);
let abort = null;

const modeLabel = computed(() => travelModeInfo(props.travelMode === 'scooter' ? 'car' : props.travelMode).label);

// 開啟時取得移動時間矩陣（一次查詢），之後切換選項只在本機重算
watch(() => props.group?.date, async (date) => {
  abort?.abort();
  matrix.value = null;
  error.value = '';
  if (!date) return;
  const stops = props.group.stops;
  fixEnd.value = stops.length >= 4 && stops[stops.length - 1].category === 'hotel';
  const ac = new AbortController();
  abort = ac;
  loading.value = true;
  try {
    const m = await travelMatrix(props.travelMode, stops, ac.signal);
    if (!ac.signal.aborted) matrix.value = { ...m, ids: stops.map((s) => s.id) };
  } catch (e) {
    if (e.name !== 'AbortError') error.value = '無法計算移動時間，請稍後再試';
  } finally {
    if (abort === ac) loading.value = false;
  }
}, { immediate: true });

const result = computed(() => {
  const m = matrix.value;
  if (!m || !props.group) return null;
  const n = m.ids.length;
  const order = bestOrder(m.durations, { fixEnd: fixEnd.value && n >= 4 });
  return {
    order, byRoad: m.byRoad, before: orderCost(m.durations, [...Array(n).keys()]), after: orderCost(m.durations, order),
  };
});
// 差不到 1 分鐘就當作沒有改善
const saved = computed(() => (result.value && result.value.before - result.value.after >= 60 ? result.value.before - result.value.after : 0));
const ordered = computed(() => (result.value ? result.value.order.map((i) => props.group.stops[i]) : props.group?.stops || []));
const moved = (s, i) => props.group.stops[i]?.id !== s.id;
const hasTimes = computed(() => props.group?.stops.some((s) => s.startTime));
// 前一站換了的地點，原本指定的交通方式（例如高鐵）與交通費就不再適用
const resetModes = computed(() => ordered.value.filter((s, i) => {
  if (i === 0 || !(s.arriveMode || s.arriveCost)) return false;
  const oldIndex = props.group.stops.indexOf(s);
  return props.group.stops[oldIndex - 1]?.id !== ordered.value[i - 1].id;
}));

function close() {
  abort?.abort();
  emit('close');
}

function apply() {
  const base = Math.min(...props.group.stops.map((s) => s.sortOrder));
  const reset = new Set(resetModes.value.map((s) => s.id));
  // 第一站的交通方式沒有意義，順便清掉
  const updates = ordered.value.map((s, i) => ({
    id: s.id,
    sortOrder: base + i,
    ...(reset.has(s.id) ? { arriveMode: null, arriveCost: null } : {}),
    ...(i === 0 && s.arriveMode ? { arriveMode: null } : {}),
  }));
  emit('apply', updates, { reschedule: hasTimes.value });
}
</script>
