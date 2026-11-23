<template>
  <div class="p-3 space-y-3">
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3">
      <button class="chip" :class="filter === 'all' ? 'chip-on' : ''" @click="filter = 'all'">全部 {{ backups.length }}</button>
      <button class="chip" :class="filter === 'undated' ? 'chip-on' : ''" @click="filter = 'undated'">未定日期 {{ count(null) }}</button>
      <button v-for="d in days" :key="d.date" class="chip" :class="filter === d.date ? 'chip-on' : ''" @click="filter = d.date">
        <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}<span v-if="count(d.date)" class="opacity-70">{{ count(d.date) }}</span>
      </button>
    </div>
    <p v-if="dayFilter" class="text-[11px] leading-4 text-ink-4 -mt-1">
      依離{{ dayOf(dayFilter)?.title }}路線的距離排序，臨時沒開時可以從最近的開始找。包含未定日期的備選。
    </p>

    <div v-if="!list.length" class="rounded-xl border border-dashed border-line-2 bg-white px-4 py-6 text-center">
      <div class="text-2xl mb-1">🔖</div>
      <div class="text-sm font-semibold mb-1">{{ backups.length ? '這裡沒有備選' : '還沒有備選地點' }}</div>
      <p class="text-xs leading-5 text-ink-3">搜尋地點或點地圖上的店家，按「🔖 備選」先放著。<br />行程當天臨時沒開，就能從這裡找附近的替代地點。</p>
    </div>

    <div v-else class="space-y-1.5">
      <div
        v-for="r in list"
        :key="r.stop.id"
        class="group flex items-center gap-2.5 rounded-xl bg-white border px-3 py-2 cursor-pointer"
        :class="focusStopId === r.stop.id ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-2'"
        @click="$emit('focus', r.stop)"
      >
        <span class="text-lg shrink-0">{{ stopCategory(r.stop).emoji }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm font-semibold truncate">{{ r.stop.title }}</span>
            <span v-if="r.stop.date && filter !== r.stop.date" class="shrink-0 rounded px-1 text-[10px] leading-4" :style="{ background: `${dayOf(r.stop.date)?.color}1a`, color: dayOf(r.stop.date)?.color }">
              {{ dayOf(r.stop.date)?.title }}
            </span>
          </div>
          <div class="text-xs text-ink-3 truncate">
            <template v-if="r.distance != null">📍 {{ fmtDistance(r.distance) }}・</template>
            <template v-if="r.stop.cost != null">{{ fmtStopMoney(r.stop.cost, r.stop.currency) }}・</template>{{ r.stop.address || r.stop.notes || '' }}
          </div>
        </div>
        <Popover close-on-click placement="bottom-end">
          <template #trigger>
            <button class="shrink-0 h-8 px-3 rounded-full bg-accent-light text-accent text-xs font-semibold hover:bg-accent hover:text-white cursor-pointer" title="排入行程">
              排入{{ dayFilter ? dayOf(dayFilter)?.title : '' }}
            </button>
          </template>
          <div class="max-h-72 overflow-y-auto thin-scroll">
            <div class="px-3 pt-1 pb-0.5 text-[11px] text-ink-4">排入哪一天（加在最後）</div>
            <button v-for="d in sortedDays" :key="d.date" class="menu-item" @click="$emit('schedule', r.stop, d.date)">
              <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}（{{ d.subtitle }}）
              <span class="ml-auto text-xs text-ink-4">{{ plannedCount(d.date) }} 個地點</span>
            </button>
          </div>
        </Popover>
        <Popover close-on-click placement="bottom-end">
          <template #trigger>
            <button class="icon-btn !size-8 shrink-0" title="更多動作"><Icon name="more" :size="15" /></button>
          </template>
          <button class="menu-item" @click="$emit('edit', r.stop)"><Icon name="pencil" />編輯</button>
          <a :href="googlePlaceUrl(r.stop)" target="_blank" rel="noopener" class="menu-item"><Icon name="external" />Google 地圖</a>
          <div class="border-t border-line my-1"></div>
          <div class="px-3 pt-1 pb-0.5 text-[11px] text-ink-4">當作哪一天的備選</div>
          <button class="menu-item" @click="$emit('set-day', r.stop, null)">
            <span class="w-4"><Icon v-if="!r.stop.date" name="check" :size="14" class="text-accent" /></span>還沒決定
          </button>
          <div class="max-h-48 overflow-y-auto thin-scroll">
            <button v-for="d in days" :key="d.date" class="menu-item" @click="$emit('set-day', r.stop, d.date)">
              <span class="w-4"><Icon v-if="r.stop.date === d.date" name="check" :size="14" class="text-accent" /></span>{{ d.title }}（{{ d.subtitle }}）
            </button>
          </div>
          <div class="border-t border-line my-1"></div>
          <button class="menu-item !text-[#c50f1f]" @click="$emit('delete', r.stop)"><Icon name="trash" />刪除</button>
        </Popover>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import Popover from '@/components/Popover.vue';
import {
  stopCategory, distanceKm, fmtDistance, fmtStopMoney, googlePlaceUrl, isPlanned, byStopOrder,
} from '@/utils/trip';

const props = defineProps({
  backups: { type: Array, required: true },
  stops: { type: Array, required: true },
  days: { type: Array, required: true },
  filter: { type: String, default: 'all' }, // all | undated | YYYY-MM-DD（v-model:filter，地圖跟著顯示那天）
  focusStopId: { type: Number, default: null },
});
const emit = defineEmits(['focus', 'edit', 'schedule', 'set-day', 'delete', 'update:filter']);

const filter = computed({
  get: () => props.filter,
  set: (v) => emit('update:filter', v),
});

const dayFilter = computed(() => (filter.value !== 'all' && filter.value !== 'undated' ? filter.value : null));
const dayOf = (date) => props.days.find((d) => d.date === date);
const count = (date) => props.backups.filter((s) => (s.date || null) === date).length;
const plannedCount = (date) => props.stops.filter((s) => s.date === date && isPlanned(s) && !s.memberId).length;
// 「排入」選單：目前篩選的那天排第一個
const sortedDays = computed(() => (dayFilter.value ? [dayOf(dayFilter.value), ...props.days.filter((d) => d.date !== dayFilter.value)] : props.days));

const list = computed(() => {
  let rows = props.backups;
  if (filter.value === 'undated') rows = rows.filter((s) => !s.date);
  else if (dayFilter.value) rows = rows.filter((s) => !s.date || s.date === dayFilter.value);
  rows = [...rows].sort(byStopOrder);
  if (!dayFilter.value) return rows.map((stop) => ({ stop, distance: null }));
  // 跟這天每個地點的最短距離
  const planned = props.stops.filter((s) => s.date === dayFilter.value && isPlanned(s));
  return rows.map((stop) => ({
    stop,
    distance: planned.length ? Math.min(...planned.map((p) => distanceKm(p, stop))) : null,
  })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
});
</script>

