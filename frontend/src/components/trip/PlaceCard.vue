<template>
  <div class="bg-white rounded-2xl card-shadow-hover overflow-hidden">
    <div v-if="sheetHandle" class="pt-2 pb-0.5 flex justify-center md:hidden"><span class="w-9 h-1 rounded-full bg-line-2"></span></div>

    <!-- 還沒加入的地點 -->
    <template v-if="place">
      <div class="px-4 pt-3 pb-2 flex items-start gap-3">
        <span class="size-10 rounded-full bg-[#fce8e6] flex items-center justify-center text-lg shrink-0">{{ categoryInfo(category).emoji }}</span>
        <div class="min-w-0 flex-1">
          <div class="text-base font-semibold leading-6 break-words">{{ place.title }}</div>
          <div class="text-xs text-ink-3 leading-5">{{ place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` }}</div>
          <div v-if="nearText" class="text-xs text-ink-3 leading-5">{{ nearText }}</div>
        </div>
        <button class="icon-btn !size-8 shrink-0 -mr-1" title="關閉" @click="$emit('close')"><Icon name="x" :size="16" /></button>
      </div>

      <div v-if="lane" class="mx-4 mb-2 rounded-lg bg-accent-light text-accent text-xs px-3 py-2">
        加入 <b>{{ lane.member.displayName }}</b> 的{{ lane.phaseLabel }}路線（{{ dayTitle(lane.date) }}）
      </div>
      <template v-else>
        <div class="px-4 text-[11px] text-ink-4 mb-1">加到哪一天</div>
        <div class="flex gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
          <button
            v-for="d in days"
            :key="d.date"
            type="button"
            class="shrink-0 h-9 px-3 rounded-full border text-sm cursor-pointer flex items-center gap-1.5"
            :class="target === d.date ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 hover:bg-hover'"
            @click="target = d.date"
          >
            <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}
            <span class="text-[11px] font-normal opacity-70">{{ d.subtitle.replace(/（.*）/, '') }}</span>
          </button>
        </div>
      </template>

      <div class="flex items-center gap-2 px-4 pb-4 pt-1">
        <button class="btn btn-primary !h-10 !rounded-full flex-1 min-w-0" :disabled="saving" @click="add(false)">
          <Icon name="plus" :size="16" />
          <span class="truncate">{{ lane ? '加入路線' : `加入${dayTitle(target)}` }}</span>
        </button>
        <Popover v-if="!lane" close-on-click placement="bottom-end">
          <template #trigger>
            <button class="btn btn-default !h-10 !rounded-full" :disabled="saving" title="先放著，之後再決定要不要去">🔖 備選</button>
          </template>
          <button class="menu-item" @click="add(true, null)">🔖 備選清單（還沒決定哪天）</button>
          <button v-if="target" class="menu-item" @click="add(true, target)">🔖 {{ dayTitle(target) }}的備選</button>
        </Popover>
        <button class="icon-btn !size-10 !rounded-full border border-line-2 shrink-0" title="填寫時間、花費等詳細資料" @click="$emit('detail', { date: target, category })">
          <Icon name="pencil" :size="16" />
        </button>
        <a :href="googlePlaceUrl(place)" target="_blank" rel="noopener" class="icon-btn !size-10 !rounded-full border border-line-2 shrink-0" title="在 Google 地圖查看（評論、營業時間）">
          <Icon name="external" :size="16" />
        </a>
      </div>
    </template>

    <!-- 已在行程中的地點 -->
    <template v-else-if="stop">
      <div class="px-4 pt-3 pb-2 flex items-start gap-3">
        <span
          class="size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          :class="backup ? 'border-2 border-dashed bg-white' : 'text-white'"
          :style="backup ? { borderColor: color, color } : { background: color }"
        >{{ label }}</span>
        <div class="min-w-0 flex-1">
          <div class="text-base font-semibold leading-6 break-words">{{ stopCategory(stop).emoji }} {{ stop.title }}</div>
          <div class="text-xs text-ink-3 leading-5">
            {{ whenText }}
          </div>
          <div v-if="stop.address" class="text-xs text-ink-3 leading-5 break-words">{{ stop.address }}</div>
          <div v-if="stop.cost != null" class="text-xs text-ink-2 leading-5">花費 {{ fmtStopMoney(stop.cost, stop.currency) }}</div>
          <p v-if="stop.notes" class="mt-1 text-xs text-ink-2 leading-5 whitespace-pre-line line-clamp-4">{{ stop.notes }}</p>
        </div>
        <button class="icon-btn !size-8 shrink-0 -mr-1" title="關閉" @click="$emit('close')"><Icon name="x" :size="16" /></button>
      </div>
      <div class="flex items-center gap-2 px-4 pb-4 pt-1 overflow-x-auto no-scrollbar">
        <button class="btn btn-primary !h-9 !rounded-full shrink-0" @click="$emit('edit', stop)"><Icon name="pencil" :size="15" />編輯</button>
        <Popover v-if="backup" close-on-click>
          <template #trigger>
            <button class="btn btn-default !h-9 !rounded-full shrink-0"><Icon name="calendar" :size="15" />排入行程</button>
          </template>
          <div class="max-h-72 overflow-y-auto thin-scroll">
            <button v-for="d in days" :key="d.date" class="menu-item" @click="$emit('schedule', stop, d.date)">
              <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}（{{ d.subtitle }}）
            </button>
          </div>
        </Popover>
        <a :href="googlePlaceUrl(stop)" target="_blank" rel="noopener" class="btn btn-default !h-9 !rounded-full shrink-0"><Icon name="external" :size="14" />Google 地圖</a>
        <a :href="navUrl" target="_blank" rel="noopener" class="btn btn-default !h-9 !rounded-full shrink-0" title="從目前位置導航到這裡">🧭 導航</a>
        <Popover close-on-click placement="bottom-end">
          <template #trigger>
            <button class="icon-btn !size-9 !rounded-full border border-line-2 shrink-0" title="更多"><Icon name="more" :size="16" /></button>
          </template>
          <template v-if="!backup && !stop.memberId">
            <button class="menu-item" @click="$emit('replace', stop)"><Icon name="move" />沒開？換成備選…</button>
            <button class="menu-item" @click="$emit('backup', stop)"><Icon name="tag" />移到這天的備選</button>
            <template v-if="days.some((x) => x.date !== stop.date)">
              <div class="border-t border-line my-1"></div>
              <div class="px-3 pt-1 pb-0.5 text-[11px] text-ink-4">移到其他天</div>
              <div class="max-h-48 overflow-y-auto thin-scroll">
                <button v-for="d in days.filter((x) => x.date !== stop.date)" :key="d.date" class="menu-item" @click="$emit('schedule', stop, d.date)">
                  <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}（{{ d.subtitle }}）
                </button>
              </div>
            </template>
            <div class="border-t border-line my-1"></div>
          </template>
          <button class="menu-item !text-[#c50f1f]" @click="$emit('delete', stop)"><Icon name="trash" />刪除</button>
        </Popover>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import Popover from '@/components/Popover.vue';
import {
  categoryInfo, stopCategory, guessCategory, googlePlaceUrl, fmtStopMoney, distanceKm, fmtDistance, isBackup,
} from '@/utils/trip';

const props = defineProps({
  place: { type: Object, default: null }, // 還沒加入的地點 { title, address, lat, lng, kind }
  stop: { type: Object, default: null }, // 已在行程中的地點
  days: { type: Array, required: true },
  stops: { type: Array, default: () => [] },
  defaultDate: { type: String, default: null },
  lane: { type: Object, default: null }, // 正在為某位成員加入分頭路線
  label: { type: [String, Number], default: '' },
  color: { type: String, default: '#8a8886' },
  saving: { type: Boolean, default: false },
  sheetHandle: { type: Boolean, default: false },
});
const emit = defineEmits(['add', 'detail', 'close', 'edit', 'schedule', 'backup', 'replace', 'delete']);

const target = ref(null);
watch(() => [props.place, props.defaultDate], () => {
  target.value = props.defaultDate || props.days[0]?.date || null;
}, { immediate: true });

const category = computed(() => (props.place ? guessCategory(props.place.kind) : 'sight'));
const backup = computed(() => !!props.stop && isBackup(props.stop));
const dayTitle = (date) => props.days.find((d) => d.date === date)?.title || '行程';

// 離這天最近的地點多遠（幫忙判斷順不順路）
const nearText = computed(() => {
  if (!props.place || !target.value) return '';
  const list = props.stops.filter((s) => s.date === target.value && !s.isBackup);
  if (!list.length) return '';
  let best = null;
  for (const s of list) {
    const d = distanceKm(props.place, s);
    if (!best || d < best.d) best = { d, s };
  }
  return `離${dayTitle(target.value)}的「${best.s.title}」${fmtDistance(best.d)}`;
});

const whenText = computed(() => {
  const s = props.stop;
  if (!s) return '';
  const day = props.days.find((d) => d.date === s.date);
  const time = s.startTime ? ` ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : '';
  if (!s.date) return '🔖 備選（還沒決定哪天）';
  if (s.isBackup) return `🔖 ${day?.title || s.date}的備選`;
  return `${day ? `${day.title}・${day.subtitle}` : s.date}${time}`;
});

const navUrl = computed(() => (props.stop ? `https://www.google.com/maps/dir/?api=1&destination=${props.stop.lat},${props.stop.lng}` : ''));

function add(asBackup, date = target.value) {
  emit('add', {
    date: asBackup ? date : target.value, backup: asBackup, category: category.value,
  });
}
</script>
