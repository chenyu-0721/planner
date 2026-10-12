<template>
  <Modal :model-value="!!target" title="找備選" width="480px" @update:model-value="$emit('close')">
    <div v-if="target" class="px-4 sm:px-6 pb-4">
      <p class="text-xs text-ink-3 leading-5 mb-3">
        「{{ target.title }}」沒開或不想去了？以下是所有備選地點，離它最近的排在前面。
        <span class="whitespace-nowrap">出發前可以點「Google 地圖」確認營業時間。</span>
      </p>

      <div v-if="!rows.length" class="rounded-md bg-hover px-3 py-4 text-sm text-ink-3 leading-6">
        還沒有備選地點。搜尋地點時按「＋備選」，或在地點的「⋯」選單選「移到備選」，就會出現在這裡。
      </div>

      <ul v-else class="rounded border border-line divide-y divide-line">
        <li v-for="r in rows" :key="r.stop.id" class="px-3 py-2">
          <div class="flex items-center gap-2">
            <span class="text-base shrink-0">{{ stopCategory(r.stop).emoji }}</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold truncate">{{ r.stop.title }}</div>
              <div class="text-[11px] text-ink-3 flex flex-wrap gap-x-2">
                <span>距離 {{ fmtDistance(r.km) }}</span>
                <span>{{ r.tag }}</span>
                <span v-if="r.stop.cost != null">{{ fmtCost(r.stop.cost) }}</span>
                <a :href="googlePlaceUrl(r.stop)" target="_blank" rel="noopener" class="text-accent hover:underline">Google 地圖</a>
              </div>
            </div>
          </div>
          <div class="mt-1.5 flex gap-1.5 pl-7">
            <button class="btn btn-primary !h-7 !px-2.5 !text-xs" :disabled="saving" @click="$emit('replace', r.stop)">替換「{{ shortTitle }}」</button>
            <button class="btn btn-default !h-7 !px-2.5 !text-xs" :disabled="saving" @click="$emit('insert', r.stop)">加在這站後面</button>
          </div>
        </li>
      </ul>
      <p v-if="rows.length" class="mt-2 text-[11px] text-ink-4 leading-4">替換後，「{{ target.title }}」會移到這天的備選，之後還可以換回來。</p>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import Modal from '@/components/Modal.vue';
import {
  stopCategory, distanceKm, fmtDistance, fmtCost, googlePlaceUrl,
} from '@/utils/trip';

const props = defineProps({
  target: { type: Object, default: null }, // 要被替換的地點
  backups: { type: Array, required: true },
  days: { type: Array, required: true },
  saving: { type: Boolean, default: false },
});
defineEmits(['close', 'replace', 'insert']);

const shortTitle = computed(() => {
  const t = props.target?.title || '';
  return t.length > 8 ? `${t.slice(0, 8)}…` : t;
});

const rows = computed(() => {
  if (!props.target) return [];
  const dayTitle = Object.fromEntries(props.days.map((d) => [d.date, d.title]));
  return props.backups
    .filter((s) => s.id !== props.target.id)
    .map((s) => ({
      stop: s,
      km: distanceKm(props.target, s),
      tag: s.date ? `${dayTitle[s.date] || s.date}的備選${s.date === props.target.date ? '（同一天）' : ''}` : '未定日期',
    }))
    .sort((a, b) => a.km - b.km);
});
</script>
