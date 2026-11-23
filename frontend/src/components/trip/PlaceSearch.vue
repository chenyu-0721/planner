<template>
  <div class="relative">
    <form
      class="flex items-center gap-1 h-11 pl-3 pr-1 rounded-full bg-white card-shadow-hover border border-transparent focus-within:border-accent"
      @submit.prevent="active >= 0 && results?.[active] ? pick(results[active]) : search(true)"
    >
      <Icon name="search" :size="17" class="shrink-0 text-ink-3" />
      <input
        ref="inputEl"
        v-model="query"
        class="flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] px-1.5"
        :placeholder="placeholder"
        maxlength="2000"
        enterkeyhint="search"
        @input="onInput"
        @focus="focused = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.esc="clear"
      />
      <button v-if="query" type="button" class="icon-btn !size-9 shrink-0" title="清除" @click="clear"><Icon name="x" :size="16" /></button>
      <slot name="suffix" />
    </form>

    <div
      v-if="focused && (searching || results)"
      class="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl bg-white card-shadow-hover overflow-hidden"
    >
      <div v-if="searching" class="px-4 py-3 text-sm text-ink-3 flex items-center gap-2">
        <span class="size-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin"></span>搜尋中…
      </div>
      <template v-else-if="results">
        <div v-if="note" class="px-4 pt-2.5 pb-1 text-xs text-ink-3 leading-5">{{ note }}</div>
        <div class="max-h-[min(60vh,420px)] overflow-y-auto thin-scroll">
          <button
            v-for="(r, i) in results"
            :key="i"
            type="button"
            class="w-full flex items-start gap-3 px-4 py-2.5 text-left cursor-pointer"
            :class="i === active ? 'bg-hover' : 'hover:bg-hover'"
            @mousedown.prevent
            @click="pick(r)"
          >
            <span class="mt-0.5 size-7 rounded-full bg-[#f1f3f4] flex items-center justify-center shrink-0 text-sm">{{ categoryInfo(guessCategory(r.kind)).emoji }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold truncate">{{ r.title }}</span>
              <span class="block text-xs text-ink-3 truncate">{{ flag(r.country) }}{{ r.address }}</span>
            </span>
            <span v-if="r.distance != null" class="shrink-0 text-[11px] text-ink-4 mt-1">{{ fmtDistance(r.distance) }}</span>
          </button>
        </div>
        <button
          v-if="lastDeep !== query.trim() && !isGoogleMapsUrl(query) && !parseCoordinates(query)"
          type="button"
          class="w-full flex items-center gap-2 px-4 h-10 border-t border-line text-xs text-accent hover:bg-hover cursor-pointer"
          @mousedown.prevent
          @click="search(true)"
        >
          <Icon name="search" :size="13" />沒有想找的？按 Enter 搜尋更多（國外地點可用中文名稱）
        </button>
        <div v-if="!results.length && !isGoogleMapsUrl(query)" class="px-4 py-3 border-t border-line">
          <a :href="googleSearchUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-accent hover:underline">
            在 Google 地圖搜尋「{{ query.trim() }}」<Icon name="external" :size="12" />
          </a>
          <p class="mt-1 text-xs leading-5 text-ink-3">找到後按「分享」→「複製連結」，貼回搜尋框就能加入；也可以直接在地圖上點店家，或長按地圖任意位置。</p>
        </div>
      </template>
    </div>
    <div v-if="focused && (searching || results)" class="fixed inset-0 z-20" @mousedown="focused = false" @touchstart.passive="focused = false"></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import api from '@/api';
import { useUiStore } from '@/stores/ui';
import {
  searchPlaces, parseCoordinates, isGoogleMapsUrl, isShortGoogleUrl, placeFromGoogleUrl, distanceKm, fmtDistance, guessCategory, categoryInfo,
} from '@/utils/trip';

const props = defineProps({
  placeholder: { type: String, default: '搜尋地點、地址，或貼上 Google 地圖連結' },
  center: { type: Function, default: null }, // () => { lat, lng, zoom }：以這裡為中心排序結果
});
const emit = defineEmits(['pick']);

const ui = useUiStore();
const inputEl = ref(null);
const query = ref('');
const results = ref(null);
const searching = ref(false);
const note = ref('');
const focused = ref(false);
const active = ref(-1);
const lastDeep = ref(''); // 已經做過完整搜尋（含 Nominatim）的關鍵字

const googleSearchUrl = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.value.trim())}`);
const canceled = (e) => e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';
// 國碼 → 國旗（台灣以外才顯示）
const flag = (cc) => (cc && cc !== 'TW' && /^[A-Z]{2}$/.test(cc) ? `${String.fromCodePoint(...[...cc].map((ch) => 0x1F1A5 + ch.charCodeAt(0)))} ` : '');

let timer = null;
let abort = null;
let seq = 0;

/**
 * 搜尋順序：
 *  1. 座標（例如 35.6586, 139.7454）
 *  2. Google 地圖連結：從網址讀出名稱與座標；短網址先由後端解析出完整網址
 *  3. 一般文字：OpenStreetMap（Photon），全世界
 */
async function search(pickFirst = false) {
  clearTimeout(timer);
  const q = query.value.trim();
  note.value = '';
  active.value = -1;
  if (q.length < 2) {
    results.value = null;
    return;
  }
  focused.value = true;
  abort?.abort();
  const ac = new AbortController();
  abort = ac;
  const my = ++seq;
  const center = props.center?.() || null;
  const done = (rows, text = '') => {
    if (my !== seq) return;
    results.value = rows.map((r) => ({ ...r, distance: center ? distanceKm(center, r) : null }));
    note.value = text;
    searching.value = false;
    if (pickFirst && rows.length === 1) pick(results.value[0]);
  };

  const coords = parseCoordinates(q);
  if (coords) {
    done([{ title: '座標位置', address: `${coords.lat}, ${coords.lng}`, ...coords }]);
    return;
  }
  searching.value = true;
  try {
    if (isGoogleMapsUrl(q)) {
      const url = isShortGoogleUrl(q) ? (await api.post('/places/resolve', { url: q }, { signal: ac.signal })).url : q;
      const place = placeFromGoogleUrl(url);
      if (place?.lat != null) done([{ title: place.title, address: 'Google 地圖連結', lat: place.lat, lng: place.lng }]);
      else if (place?.title) done(await searchPlaces(place.title, ac.signal, center), `連結沒有座標，改用「${place.title}」搜尋`);
      else done([], '這個連結沒有位置資訊，請在 Google 地圖開啟地點後再按「分享」複製連結');
      return;
    }
    done(await searchPlaces(q, ac.signal, center, { deep: pickFirst }));
    lastDeep.value = pickFirst ? q : '';
  } catch (e) {
    if (my !== seq || canceled(e) || e.status === 401) return;
    searching.value = false;
    ui.error(e);
  }
}

// 邊打字邊搜尋（停止輸入 400ms 後才查詢）
function onInput() {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 400);
}

function move(step) {
  if (!results.value?.length) return;
  const n = results.value.length;
  active.value = (active.value + step + n) % n;
}

function pick(r) {
  emit('pick', r);
  focused.value = false;
  inputEl.value?.blur();
}

function clear() {
  query.value = '';
  results.value = null;
  focused.value = false;
}

defineExpose({
  focus: () => inputEl.value?.focus(),
  clear,
  pickActive: () => (active.value >= 0 && results.value ? pick(results.value[active.value]) : search(true)),
});
</script>
