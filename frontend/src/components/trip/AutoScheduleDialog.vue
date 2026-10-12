<template>
  <Modal :model-value="!!group" title="自動排時間" width="520px" @update:model-value="close">
    <div v-if="group" class="px-4 sm:px-6 pb-2 space-y-4">
      <p class="text-xs text-ink-3 leading-5">
        {{ group.title }}（{{ group.subtitle }}）依目前順序，從出發時間開始，加上每段交通時間與停留時間，算出每個地點的時間。
      </p>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">出發時間</label>
          <input v-model="start" type="time" class="input" />
        </div>
        <div>
          <label class="field-label">每段交通多留</label>
          <select v-model.number="buffer" class="input select">
            <option v-for="m in BUFFERS" :key="m" :value="m">{{ m ? `${m} 分鐘` : '不用' }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="field-label">停留時間（分鐘）</label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <label v-for="c in usedCategories" :key="c.key" class="flex items-center gap-1.5 text-sm">
            <span class="shrink-0">{{ c.emoji }}</span>
            <span class="shrink-0 w-8">{{ c.label }}</span>
            <input v-model.number="stays[c.key]" type="number" min="0" max="720" step="15" class="input !h-7 min-w-0" />
          </label>
        </div>
        <label class="mt-2 flex items-start gap-2 text-sm cursor-pointer">
          <input v-model="keepStay" type="checkbox" class="mt-1" />
          <span>已設定開始與結束時間的地點，沿用原本的停留時間</span>
        </label>
      </div>

      <div class="rounded border border-line">
        <div class="flex items-center justify-between px-3 h-8 border-b border-line text-xs text-ink-3">
          <span>預覽</span>
          <span v-if="estimated" class="text-[#986f0b]">{{ routing ? '路線計算中，' : '' }}部分路段以直線距離估算</span>
        </div>
        <ol>
          <li v-for="(r, i) in preview" :key="r.stop.id" class="border-b border-line last:border-0">
            <div v-if="i > 0" class="px-3 pt-1 text-[11px] text-ink-4 pl-11">
              {{ modeOf(r.stop).emoji }} 交通約 {{ r.travel }} 分<template v-if="buffer">，多留 {{ buffer }} 分</template>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5">
              <span class="size-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" :style="{ background: group.color }">{{ i + 1 }}</span>
              <span class="flex-1 min-w-0 truncate text-sm">{{ stopCategory(r.stop).emoji }} {{ r.stop.title }}</span>
              <span v-if="r.overflow" class="text-xs text-[#c50f1f] shrink-0">超過當天，不排時間</span>
              <span v-else class="text-sm tabular-nums shrink-0" :class="changed(r) ? 'font-semibold text-accent' : 'text-ink-2'">
                {{ r.startTime }}<template v-if="r.endTime">–{{ r.endTime }}</template>
              </span>
            </div>
          </li>
        </ol>
      </div>
    </div>
    <template #footer>
      <button class="btn btn-default" @click="close">取消</button>
      <button class="btn btn-primary" :disabled="saving || !updates.length" @click="apply">
        {{ updates.length ? `套用（${updates.length} 個地點）` : '時間沒有變動' }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import {
  CATEGORIES, DEFAULT_STAY, stopCategory, planSchedule, travelModeInfo,
} from '@/utils/trip';

const props = defineProps({
  group: { type: Object, default: null }, // 當天資料（stops、legs、title…）
  travelMode: { type: String, default: 'car' },
  routing: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'apply']);

const BUFFERS = [0, 5, 10, 15, 20, 30];
const PREF_KEY = 'planner_auto_schedule';
const start = ref('09:00');
const buffer = ref(10);
const keepStay = ref(true);
const stays = reactive({ ...DEFAULT_STAY });

// 記住這台裝置上次的設定（只是方便，讀不到就用預設值）
try {
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (saved) {
    if (BUFFERS.includes(saved.buffer)) buffer.value = saved.buffer;
    if (typeof saved.keepStay === 'boolean') keepStay.value = saved.keepStay;
    for (const c of CATEGORIES) if (Number.isFinite(saved.stays?.[c.key])) stays[c.key] = saved.stays[c.key];
  }
} catch {
  // 無法使用瀏覽器儲存空間時忽略
}

watch(() => props.group?.date, (date) => {
  if (date) start.value = props.group.stops[0]?.startTime || '09:00';
}, { immediate: true });

const usedCategories = computed(() => CATEGORIES.filter((c) => props.group?.stops.some((s) => s.category === c.key)));
const modeOf = (stop) => travelModeInfo(stop.arriveMode || props.travelMode);
const estimated = computed(() => {
  const g = props.group;
  if (!g || g.stops.length < 2) return false;
  return g.stops.slice(1).some((s, i) => !g.legs?.[i]?.duration);
});

const cleanStays = computed(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, Math.min(720, Math.max(0, Math.round(Number(stays[c.key]) || 0)))])));
const preview = computed(() => (props.group ? planSchedule(props.group.stops, props.group.legs, {
  start: start.value || '09:00', buffer: buffer.value, keepStay: keepStay.value, stays: cleanStays.value,
}) : []));

const changed = (r) => !r.overflow && ((r.stop.startTime || null) !== r.startTime || (r.stop.endTime || null) !== r.endTime);
const updates = computed(() => preview.value.filter(changed).map((r) => ({ id: r.stop.id, startTime: r.startTime, endTime: r.endTime })));

function close() {
  emit('close');
}

function apply() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ buffer: buffer.value, keepStay: keepStay.value, stays: cleanStays.value }));
  } catch {
    // 忽略
  }
  emit('apply', updates.value);
}
</script>
