<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2">
      <div class="text-xs text-ink-3 flex-1 min-w-0 leading-5">
        機票、住宿、車票、租車、門票集中放在這裡，訂位代號一鍵複製。<template v-if="total">合計 {{ fmtCost(total) }}（已計入花費）</template>
      </div>
      <Popover close-on-click placement="bottom-end">
        <template #trigger>
          <button class="btn btn-primary !h-8 !rounded-full shrink-0"><Icon name="plus" :size="15" />新增</button>
        </template>
        <button v-for="k in BOOKING_KINDS" :key="k.key" class="menu-item" @click="$emit('add', k.key)"><span class="w-4">{{ k.emoji }}</span>{{ k.label }}</button>
      </Popover>
    </div>

    <div v-if="!bookings.length" class="rounded-xl border border-dashed border-line-2 bg-white px-4 py-6 text-center">
      <div class="text-2xl mb-1">🎫</div>
      <div class="text-sm font-semibold mb-1">還沒有預訂</div>
      <p class="text-xs leading-5 text-ink-3 mb-3">新增機票、住宿等預訂後，會顯示在當天行程的最上面。</p>
      <div class="flex flex-wrap justify-center gap-1.5">
        <button v-for="k in BOOKING_KINDS.slice(0, 4)" :key="k.key" class="btn btn-default !h-8 !rounded-full" @click="$emit('add', k.key)">{{ k.emoji }} {{ k.label }}</button>
      </div>
    </div>

    <section v-for="g in groups" :key="g.key">
      <h4 class="text-xs font-semibold text-ink-3 mb-1.5 px-1">{{ g.title }}</h4>
      <div class="space-y-1.5">
        <div
          v-for="b in g.items"
          :key="b.id"
          class="rounded-xl bg-white border border-line hover:border-line-2 px-3 py-2.5 cursor-pointer"
          @click="$emit('edit', b)"
        >
          <div class="flex items-start gap-2.5">
            <span class="text-lg leading-6 shrink-0">{{ bookingKind(b.kind).emoji }}</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold leading-6 break-words">{{ b.title }}</div>
              <div v-if="b.fromPlace || b.toPlace" class="text-xs text-ink-2 leading-5 break-words">
                {{ b.fromPlace }}<template v-if="b.toPlace"> → {{ b.toPlace }}</template>
              </div>
              <div v-if="b.startAt || b.endAt" class="text-xs text-ink-3 leading-5 tabular-nums">
                <template v-if="b.startAt">{{ bookingKind(b.kind).start }} {{ fmtBookingTime(b.startAt) }}</template>
                <template v-if="b.endAt">{{ b.startAt ? '　' : '' }}{{ bookingKind(b.kind).end }} {{ fmtBookingTime(b.endAt, b.endAt.slice(0, 10) !== b.startAt?.slice(0, 10)) }}</template>
                <template v-if="nights(b)">・{{ nights(b) }} 晚</template>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <button
                  v-if="b.reference"
                  class="inline-flex items-center gap-1 h-6 px-2 rounded bg-hover text-xs font-mono cursor-pointer hover:bg-[#e1e1e1]"
                  title="複製訂位代號"
                  @click.stop="copy(b.reference)"
                >
                  {{ b.reference }}<Icon name="copy" :size="11" />
                </button>
                <span v-if="b.cost != null" class="text-xs text-ink-2">{{ fmtStopMoney(b.cost, b.currency) }}</span>
                <a v-if="b.url" :href="b.url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline" @click.stop>
                  開啟連結<Icon name="external" :size="11" />
                </a>
              </div>
              <p v-if="b.notes" class="mt-1 text-xs text-ink-3 leading-5 whitespace-pre-line line-clamp-3">{{ b.notes }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import Popover from '@/components/Popover.vue';
import { useUiStore } from '@/stores/ui';
import { diffDays } from '@/utils/planner';
import { fmtCost, fmtStopMoney, toTripMoney } from '@/utils/trip';
import { BOOKING_KINDS, bookingKind, fmtBookingTime } from '@/utils/tripPrep';

const props = defineProps({
  bookings: { type: Array, required: true },
  days: { type: Array, required: true },
});
defineEmits(['add', 'edit']);

const ui = useUiStore();
const total = computed(() => props.bookings.reduce((sum, b) => sum + toTripMoney(b.cost, b.currency), 0));
const nights = (b) => (b.kind === 'hotel' && b.startAt && b.endAt ? diffDays(b.endAt.slice(0, 10), b.startAt.slice(0, 10)) : 0);

// 依開始日期分組：行程前、每一天、行程後、未設定時間
const groups = computed(() => {
  const first = props.days[0]?.date;
  const last = props.days[props.days.length - 1]?.date;
  const map = new Map();
  const push = (key, title, b) => {
    if (!map.has(key)) map.set(key, { key, title, items: [] });
    map.get(key).items.push(b);
  };
  const sorted = [...props.bookings].sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999') || a.id - b.id);
  for (const b of sorted) {
    const date = b.startAt?.slice(0, 10);
    if (!date) push('z', '未設定時間', b);
    else if (first && date < first) push('a', '行程開始前', b);
    else if (last && date > last) push('y', '行程結束後', b);
    else {
      const d = props.days.find((x) => x.date === date);
      push(`d${date}`, d ? `${d.title}・${d.subtitle}` : date, b);
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
});

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    ui.toast(`已複製「${text}」`, 'success');
  } catch {
    ui.toast('無法複製，請手動選取', 'error');
  }
}
</script>
