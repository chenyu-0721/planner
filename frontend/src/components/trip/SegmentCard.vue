<template>
  <div class="no-drag flex items-stretch gap-2 py-1.5" :class="indent ? 'pl-[21px]' : ''">
    <span class="w-px shrink-0" :class="dashed ? 'border-l border-dashed' : ''" :style="dashed ? { borderColor: color } : { background: color }"></span>
    <Popover close-on-click block class="min-w-0 flex-1">
      <template #trigger>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-left cursor-pointer hover:border-accent"
          :class="seg.custom ? 'border-accent' : 'border-line'"
          title="變更這一段的交通方式"
        >
          <span class="text-base leading-none shrink-0">{{ seg.info.emoji }}</span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="text-xs font-semibold text-ink">{{ seg.info.label }}</span>
              <span v-if="!seg.custom" class="text-[10px] text-ink-4">預設</span>
            </span>
            <span class="block truncate text-[11px]" :class="seg.failed ? 'text-[#c50f1f]' : 'text-ink-3'">{{ seg.detail }}</span>
          </span>
          <Icon name="chevron-down" :size="14" class="shrink-0 text-ink-3" />
        </button>
      </template>
      <div class="w-64">
        <div class="px-3 pt-1.5 pb-1 text-xs text-ink-3 truncate">{{ caption }}</div>
        <button class="menu-item" @click="$emit('mode', null)">
          <span class="w-4"><Icon v-if="!mode" name="check" :size="14" class="text-accent" /></span>
          跟隨預設（{{ defaultLabel }}）
        </button>
        <div class="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-ink-4">沿道路</div>
        <button v-for="m in roadModes" :key="m.key" class="menu-item" @click="$emit('mode', m.key)">
          <span class="w-4"><Icon v-if="mode === m.key" name="check" :size="14" class="text-accent" /></span>
          <span>{{ m.emoji }}</span>{{ m.label }}
        </button>
        <div class="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-ink-4">軌道 · 依距離估算時間</div>
        <button v-for="m in railModes" :key="m.key" class="menu-item" @click="$emit('mode', m.key)">
          <span class="w-4"><Icon v-if="mode === m.key" name="check" :size="14" class="text-accent" /></span>
          <span>{{ m.emoji }}</span>{{ m.label }}
        </button>
        <div class="border-t border-line my-1"></div>
        <button class="menu-item" @click="$emit('mode', lineMode.key)">
          <span class="w-4"><Icon v-if="mode === lineMode.key" name="check" :size="14" class="text-accent" /></span>
          <span>{{ lineMode.emoji }}</span>{{ lineMode.label }}
        </button>
        <div class="border-t border-line my-1"></div>
        <button class="menu-item" @click="$emit('fare')">
          <span class="w-4"><Icon name="wallet" :size="14" /></span>
          {{ fare ? `交通費 ${fmtCost(fare)}` : '填寫這段交通費' }}
        </button>
      </div>
    </Popover>
    <a
      v-if="seg.info.kind === 'rail' && railUrl"
      :href="railUrl"
      target="_blank"
      rel="noopener"
      class="inline-flex shrink-0 items-center gap-0.5 self-center h-7 px-1.5 rounded text-xs text-accent hover:bg-black/5"
      title="在 Google 地圖查詢實際班次"
      @click.stop
    >
      查班次<Icon name="external" :size="11" />
    </a>
  </div>
</template>

<script setup>
import Icon from '@/components/Icon.vue';
import Popover from '@/components/Popover.vue';
import { TRAVEL_MODES, fmtCost } from '@/utils/trip';

defineProps({
  seg: { type: Object, required: true }, // segmentInfo() 的結果
  mode: { type: String, default: null }, // 這段自己設定的交通方式（null = 跟隨預設）
  defaultLabel: { type: String, required: true },
  caption: { type: String, default: '' }, // 選單上方的說明，例如「這一段前往「X」」
  fare: { type: Number, default: null },
  railUrl: { type: String, default: '' },
  color: { type: String, required: true },
  indent: { type: Boolean, default: true },
  dashed: { type: Boolean, default: false },
});
defineEmits(['mode', 'fare']);

const roadModes = TRAVEL_MODES.filter((m) => m.kind === 'road');
const railModes = TRAVEL_MODES.filter((m) => m.kind === 'rail');
const lineMode = TRAVEL_MODES.find((m) => m.kind === 'line');
</script>
