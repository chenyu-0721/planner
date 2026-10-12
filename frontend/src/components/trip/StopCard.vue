<template>
  <div
    class="group flex items-start gap-2.5 rounded-md px-2.5 cursor-pointer"
    :class="[
      backup ? 'bg-white/70 border border-dashed border-line-2 py-1.5 hover:bg-white' : 'bg-white card-shadow hover:card-shadow-hover py-2',
      focused ? 'ring-2 ring-accent' : '',
    ]"
    @click="$emit('focus')"
    @dblclick="$emit('edit')"
  >
    <span
      class="mt-0.5 size-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
      :class="backup ? 'border border-dashed bg-white' : 'text-white'"
      :style="backup ? { borderColor: color, color } : { background: color }"
      :title="backup ? '備選' : ''"
    >
      {{ label }}
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="text-sm">{{ stopCategory(stop).emoji }}</span>
        <span class="text-sm truncate" :class="backup ? 'text-ink-2' : 'font-semibold'">{{ stop.title }}</span>
        <span v-if="tag" class="shrink-0 rounded px-1 text-[10px] leading-4 bg-hover text-ink-3">{{ tag }}</span>
      </div>
      <div class="text-xs text-ink-3 flex flex-wrap gap-x-2">
        <span v-if="stop.startTime" class="flex items-center gap-0.5"><Icon name="clock" :size="11" />{{ stop.startTime }}<template v-if="stop.endTime">–{{ stop.endTime }}</template></span>
        <span v-if="weather" class="tabular-nums" :title="`${stop.startTime} 天氣：${weatherInfo(weather.code).label}`">
          {{ weatherInfo(weather.code).emoji }} {{ fmtTemp(weather.temp) }}<span v-if="weather.rain >= 20" :class="weather.rain >= 50 ? 'text-accent font-semibold' : ''"> ☔{{ weather.rain }}%</span>
        </span>
        <span v-if="stop.cost != null">{{ fmtCost(stop.cost) }}</span>
        <span v-if="stop.address" class="truncate max-w-full">{{ stop.address }}</span>
      </div>
      <p v-if="stop.notes && !backup" class="text-xs text-ink-2 mt-0.5 line-clamp-2 whitespace-pre-line">{{ stop.notes }}</p>
    </div>
    <slot name="action" />
    <Popover close-on-click placement="bottom-end" class="no-drag shrink-0">
      <template #trigger>
        <button class="icon-btn !size-7 touch-show opacity-0 group-hover:opacity-100" title="更多動作">
          <Icon name="more" :size="15" />
        </button>
      </template>
      <slot name="menu" />
    </Popover>
  </div>
</template>

<script setup>
import Icon from '@/components/Icon.vue';
import Popover from '@/components/Popover.vue';
import { stopCategory, fmtCost } from '@/utils/trip';
import { weatherInfo, fmtTemp } from '@/utils/weather';

defineProps({
  stop: { type: Object, required: true },
  label: { type: [String, Number], default: '' }, // 圓圈中的序號
  color: { type: String, required: true },
  backup: { type: Boolean, default: false },
  focused: { type: Boolean, default: false },
  tag: { type: String, default: '' }, // 例如備選所屬的日期
  weather: { type: Object, default: null },
});
defineEmits(['focus', 'edit']);
</script>
