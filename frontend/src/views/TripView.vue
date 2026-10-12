<template>
  <div v-if="error" class="flex-1 flex flex-col items-center justify-center text-center p-8">
    <Icon name="lock" :size="44" class="text-ink-4 mb-3" :stroke="1.3" />
    <div class="text-lg font-semibold mb-1">無法開啟此行程</div>
    <p class="text-sm text-ink-3 mb-4">{{ error }}</p>
    <router-link to="/trips" class="btn btn-primary">回到我的行程</router-link>
  </div>

  <div v-else-if="!trip" class="flex-1 flex items-center justify-center text-ink-3">載入中…</div>

  <template v-else>
    <!-- 標頭 -->
    <div class="bg-white border-b border-line shrink-0 px-3 sm:px-6 py-3 flex items-center gap-3">
      <TripIcon :color="trip.color" :size="36" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1 min-w-0">
          <h1 class="text-base sm:text-lg font-semibold truncate">{{ trip.name }}</h1>
          <Popover close-on-click>
            <template #trigger>
              <button class="icon-btn shrink-0" title="更多選項"><Icon name="more" :size="18" /></button>
            </template>
            <button class="menu-item" @click="settingsOpen = true"><Icon name="settings" />行程設定</button>
            <button class="menu-item" @click="fitMap"><Icon name="fit" />顯示全部地點</button>
            <div class="border-t border-line my-1"></div>
            <button v-if="trip.isMember && trip.ownerId !== auth.user?.id" class="menu-item" @click="leave"><Icon name="door" />離開行程</button>
            <button v-if="trip.canManage" class="menu-item !text-[#c50f1f]" @click="removeTrip"><Icon name="trash" />刪除行程</button>
          </Popover>
        </div>
        <div class="text-xs text-ink-3 flex flex-wrap gap-x-3">
          <span>{{ fmtTripRange(trip) }}</span>
          <span>{{ stops.length }} 個地點</span>
          <span v-if="totalCost">預估花費 {{ fmtCost(totalCost) }}</span>
        </div>
      </div>

      <Popover placement="bottom-end">
        <template #trigger>
          <button class="flex items-center gap-2 h-8 px-2 rounded hover:bg-hover cursor-pointer" title="成員">
            <div class="hidden sm:flex -space-x-1.5">
              <Avatar v-for="m in members.slice(0, 4)" :key="m.id" :user="m" :size="26" ring />
            </div>
            <Icon name="user-plus" :size="16" class="text-ink-2" />
          </button>
        </template>
        <div class="w-80">
          <div class="px-3 pt-2 pb-1 text-sm font-semibold">成員（{{ members.length }}）</div>
          <div class="px-3 pb-2">
            <input v-model="memberKeyword" class="input" placeholder="輸入名稱以新增成員" />
            <div v-if="memberKeyword" class="mt-1 border border-line rounded max-h-48 overflow-y-auto thin-scroll">
              <button v-for="u in memberCandidates" :key="u.id" class="menu-item !h-10" @click="addMember(u)">
                <Avatar :user="u" :size="26" /><span class="flex-1 truncate">{{ u.displayName }}</span><Icon name="plus" :size="14" class="text-accent" />
              </button>
              <div v-if="!memberCandidates.length" class="px-3 py-2 text-sm text-ink-3">找不到可新增的使用者</div>
            </div>
          </div>
          <div class="max-h-72 overflow-y-auto thin-scroll border-t border-line pt-1">
            <div v-for="m in members" :key="m.id" class="group/m flex items-center gap-2.5 px-3 h-11 hover:bg-hover">
              <Avatar :user="m" :size="30" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ m.displayName }}</div>
                <div class="text-xs text-ink-4">{{ m.tripRole === 'owner' ? '擁有者' : '成員' }}</div>
              </div>
              <button
                v-if="m.tripRole !== 'owner' && trip.canManage"
                class="icon-btn !size-7 touch-show opacity-0 group-hover/m:opacity-100"
                title="從行程移除"
                @click="removeMember(m)"
              >
                <Icon name="x" :size="14" />
              </button>
            </div>
          </div>
        </div>
      </Popover>
    </div>

    <!-- 手機：切換清單 / 地圖 -->
    <div class="md:hidden flex bg-white border-b border-line shrink-0">
      <button v-for="t in mobileTabs" :key="t.key" class="flex-1 h-10 flex items-center justify-center gap-1.5 text-sm border-b-[3px] cursor-pointer"
              :class="mobileTab === t.key ? 'border-brand font-semibold' : 'border-transparent text-ink-2'" @click="mobileTab = t.key">
        <Icon :name="t.icon" :size="16" />{{ t.label }}
      </button>
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- 行程清單 -->
      <aside
        class="w-full md:w-[380px] lg:w-[420px] shrink-0 md:border-r border-line bg-[#fafafa] flex-col min-h-0"
        :class="mobileTab === 'list' ? 'flex' : 'hidden md:flex'"
      >
        <!-- 新增地點 -->
        <div class="p-3 border-b border-line bg-white space-y-2">
          <form class="relative" @submit.prevent="search">
            <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input v-model="query" class="input !pl-8" placeholder="搜尋地點，或貼上 Google 地圖連結" maxlength="2000" @input="onQueryInput" />
          </form>
          <div v-if="searching" class="text-xs text-ink-3 px-1">搜尋中…</div>
          <div v-else-if="results" class="rounded border border-line bg-white max-h-64 overflow-y-auto thin-scroll">
            <div class="flex items-start justify-between gap-2 px-3 py-2 text-xs leading-4 text-ink-3 border-b border-line">
              <span class="min-w-0">{{ results.length ? (searchNote || '點選地點加入行程') : (searchNote || '找不到符合的地點') }}</span>
              <button class="hover:text-ink cursor-pointer shrink-0" @click="results = null"><Icon name="x" :size="13" /></button>
            </div>
            <button v-for="(r, i) in results" :key="i" class="w-full text-left px-3 py-2 hover:bg-hover cursor-pointer border-b border-line last:border-0" @click="openNewStop(r)">
              <div class="text-sm font-semibold truncate">{{ r.title }}</div>
              <div class="text-xs text-ink-3 line-clamp-2">{{ r.address }}</div>
            </button>
            <div v-if="!results.length && !isGoogleMapsUrl(query)" class="px-3 py-2 border-t border-line">
              <a :href="googleMapsSearchUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                在 Google 地圖搜尋「{{ query.trim() }}」<Icon name="external" :size="12" />
              </a>
              <p class="mt-1 text-xs leading-5 text-ink-3">找到後按「分享」→「複製連結」，貼回上方搜尋框就能加入行程。</p>
            </div>
          </div>
        </div>

        <!-- 沒指定的路段用這個方式；每一段仍可另外改 -->
        <div class="px-3 pt-2 bg-white">
          <div class="flex items-center gap-2">
            <span class="text-xs text-ink-3 shrink-0">預設</span>
            <div class="flex gap-1 overflow-x-auto no-scrollbar">
              <button v-for="m in DEFAULT_TRAVEL_MODES" :key="m.key" class="chip !h-7" :class="trip.travelMode === m.key ? 'chip-on' : ''" @click="setTravelMode(m.key)">
                <span>{{ m.emoji }}</span>{{ m.label }}
              </button>
            </div>
          </div>
          <p class="mt-1 text-[11px] leading-4 text-ink-4">點兩地中間的卡片，可改那一段。例如上一段高鐵、下一段機車。</p>
        </div>

        <!-- 日期篩選 -->
        <div class="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar shrink-0 border-b border-line bg-white">
          <button class="chip" :class="selectedDate === null ? 'chip-on' : ''" @click="selectedDate = null">全部</button>
          <button v-for="d in days" :key="d.date" class="chip" :class="selectedDate === d.date ? 'chip-on' : ''" @click="selectedDate = d.date">
            <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}
          </button>
          <button v-if="unscheduled.length" class="chip" :class="selectedDate === 'unscheduled' ? 'chip-on' : ''" @click="selectedDate = 'unscheduled'">未排入</button>
        </div>

        <!-- 每日行程 -->
        <div class="flex-1 min-h-0 overflow-y-auto thin-scroll p-3 space-y-4">
          <section v-for="g in visibleGroups" :key="g.key">
            <header class="flex items-center gap-2 mb-2">
              <span class="w-1 h-5 rounded" :style="{ background: g.color }"></span>
              <h3 class="font-semibold text-sm">{{ g.title }}</h3>
              <span class="text-xs text-ink-3">{{ g.subtitle }}</span>
              <div class="flex-1"></div>
              <span v-if="g.distance" class="text-xs text-ink-3 flex items-center gap-1">
                <Icon name="route" :size="12" />{{ fmtDistance(g.distance) }}<template v-if="g.duration">・{{ g.legs?.some((l) => l.estimated) ? '約 ' : '' }}{{ fmtDuration(g.duration) }}</template>
              </span>
              <span v-if="g.cost" class="text-xs text-ink-3">{{ fmtCost(g.cost) }}</span>
              <a
                v-if="g.numbered && g.stops.length"
                :href="googleDirectionsUrl(g.stops, trip.travelMode)"
                target="_blank"
                rel="noopener"
                class="icon-btn !size-7"
                :title="g.stops.length > 1 ? '用 Google 地圖導航這天的路線' : '在 Google 地圖查看'"
                @click.stop
              >
                <Icon name="external" :size="14" />
              </a>
            </header>

            <draggable
              :model-value="g.stops"
              item-key="id"
              group="stops"
              class="space-y-1.5 min-h-10 rounded"
              ghost-class="drag-ghost"
              :animation="150"
              :delay="250"
              :delay-on-touch-only="true"
              :force-fallback="true"
              :fallback-on-body="true"
              fallback-class="drag-fallback"
              filter=".no-drag"
              :prevent-on-filter="false"
              @change="(e) => onDragChange(e, g)"
            >
              <template #item="{ element: s, index }">
                <div>
                  <div
                    class="group flex items-start gap-2.5 bg-white rounded-md card-shadow hover:card-shadow-hover px-2.5 py-2 cursor-pointer"
                    :class="focusStopId === s.id ? 'ring-2 ring-accent' : ''"
                    @click="focusStop(s)"
                    @dblclick="editStop(s)"
                  >
                    <span class="mt-0.5 size-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" :style="{ background: g.color }">
                      {{ g.numbered ? index + 1 : '·' }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm">{{ categoryInfo(s.category).emoji }}</span>
                        <span class="text-sm font-semibold truncate">{{ s.title }}</span>
                      </div>
                      <div class="text-xs text-ink-3 flex flex-wrap gap-x-2">
                        <span v-if="s.startTime" class="flex items-center gap-0.5"><Icon name="clock" :size="11" />{{ s.startTime }}<template v-if="s.endTime">–{{ s.endTime }}</template></span>
                        <span v-if="s.cost != null">{{ fmtCost(s.cost) }}</span>
                        <span v-if="s.address" class="truncate max-w-full">{{ s.address }}</span>
                      </div>
                      <p v-if="s.notes" class="text-xs text-ink-2 mt-0.5 line-clamp-2 whitespace-pre-line">{{ s.notes }}</p>
                    </div>
                    <button class="icon-btn !size-7 touch-show opacity-0 group-hover:opacity-100 shrink-0" title="編輯" @click.stop="editStop(s)">
                      <Icon name="pencil" :size="14" />
                    </button>
                  </div>
                  <div v-if="g.numbered && index < g.stops.length - 1" class="no-drag flex items-stretch gap-2 py-1.5 pl-[21px]">
                    <span class="w-px shrink-0" :style="{ background: g.color }"></span>
                    <Popover close-on-click block class="min-w-0 flex-1">
                      <template #trigger>
                        <button
                          type="button"
                          class="flex w-full items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-left cursor-pointer hover:border-accent"
                          :class="seg(g, index).custom ? 'border-accent' : 'border-line'"
                          title="變更這一段的交通方式"
                        >
                          <span class="text-base leading-none shrink-0">{{ seg(g, index).info.emoji }}</span>
                          <span class="min-w-0 flex-1">
                            <span class="flex items-center gap-1.5">
                              <span class="text-xs font-semibold text-ink">{{ seg(g, index).info.label }}</span>
                              <span v-if="!seg(g, index).custom" class="text-[10px] text-ink-4">預設</span>
                            </span>
                            <span class="block truncate text-[11px]" :class="seg(g, index).failed ? 'text-[#c50f1f]' : 'text-ink-3'">{{ seg(g, index).detail }}</span>
                          </span>
                          <Icon name="chevron-down" :size="14" class="shrink-0 text-ink-3" />
                        </button>
                      </template>
                      <div class="w-64">
                        <div class="px-3 pt-1.5 pb-1 text-xs text-ink-3 truncate">這一段前往「{{ g.stops[index + 1].title }}」</div>
                        <button class="menu-item" @click="setArriveMode(g.stops[index + 1], null)">
                          <span class="w-4"><Icon v-if="!g.stops[index + 1].arriveMode" name="check" :size="14" class="text-accent" /></span>
                          跟隨預設（{{ travelModeInfo(trip.travelMode).label }}）
                        </button>
                        <div class="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-ink-4">沿道路</div>
                        <button v-for="m in roadModes" :key="m.key" class="menu-item" @click="setArriveMode(g.stops[index + 1], m.key)">
                          <span class="w-4"><Icon v-if="g.stops[index + 1].arriveMode === m.key" name="check" :size="14" class="text-accent" /></span>
                          <span>{{ m.emoji }}</span>{{ m.label }}
                        </button>
                        <div class="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-ink-4">軌道 · 依距離估算時間</div>
                        <button v-for="m in railModes" :key="m.key" class="menu-item" @click="setArriveMode(g.stops[index + 1], m.key)">
                          <span class="w-4"><Icon v-if="g.stops[index + 1].arriveMode === m.key" name="check" :size="14" class="text-accent" /></span>
                          <span>{{ m.emoji }}</span>{{ m.label }}
                        </button>
                        <div class="border-t border-line my-1"></div>
                        <button class="menu-item" @click="setArriveMode(g.stops[index + 1], lineMode.key)">
                          <span class="w-4"><Icon v-if="g.stops[index + 1].arriveMode === lineMode.key" name="check" :size="14" class="text-accent" /></span>
                          <span>{{ lineMode.emoji }}</span>{{ lineMode.label }}
                        </button>
                      </div>
                    </Popover>
                    <a
                      v-if="seg(g, index).info.kind === 'rail'"
                      :href="googleSegmentUrl(s, g.stops[index + 1], seg(g, index).info.key)"
                      target="_blank"
                      rel="noopener"
                      class="inline-flex shrink-0 items-center gap-0.5 self-center h-7 px-1.5 rounded text-xs text-accent hover:bg-black/5"
                      title="在 Google 地圖查詢實際班次"
                      @click.stop
                    >
                      查班次<Icon name="external" :size="11" />
                    </a>
                  </div>
                </div>
              </template>
            </draggable>
            <div v-if="!g.stops.length" class="text-xs text-ink-4 px-1 -mt-8 mb-2 h-8 flex items-center pointer-events-none">
              {{ g.numbered ? '拖曳地點到這裡，或搜尋新增' : '沒有未排入日期的地點' }}
            </div>
          </section>
        </div>
      </aside>

      <!-- 地圖 -->
      <div class="flex-1 min-w-0" :class="mobileTab === 'map' ? 'block' : 'hidden md:block'">
        <TripMap
          ref="mapRef"
          :days="days"
          :stops="stops"
          :routes="routes"
          :routing="routing"
          :selected-date="selectedDate"
          :focus-stop-id="focusStopId"
          @select="onMarkerSelect"
          @move="onMarkerMove"
        />
      </div>
    </div>

    <StopEditor v-model="editing" :days="days" :saving="saving" @save="saveStop" @delete="deleteStop" />
    <TripFormDialog v-model="settingsOpen" :trip="trip" @saved="onTripSaved" />
  </template>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import TripIcon from '@/components/trip/TripIcon.vue';
import TripMap from '@/components/trip/TripMap.vue';
import StopEditor from '@/components/trip/StopEditor.vue';
import TripFormDialog from '@/components/trip/TripFormDialog.vue';
import api from '@/api';
import { sortOrderAt } from '@/utils/planner';
import {
  tripDays, fmtTripRange, categoryInfo, distanceKm, fmtDistance, fmtCost, byStopOrder,
  sortOrderForTime, searchPlaces, UNSCHEDULED_COLOR, inTaiwan,
  parseCoordinates, isGoogleMapsUrl, isShortGoogleUrl, placeFromGoogleUrl,
  TRAVEL_MODES, DEFAULT_TRAVEL_MODES, travelModeInfo, planDayRoute, upgradeRailLegs, fmtDuration, googleDirectionsUrl, googleSegmentUrl,
} from '@/utils/trip';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();
const plans = usePlansStore();

const tripId = Number(route.params.id);
const trip = ref(null);
const members = ref([]);
const stops = ref([]);
const error = ref('');

const selectedDate = ref(null);
const focusStopId = ref(null);
const editing = ref(null);
const saving = ref(false);
const settingsOpen = ref(false);
const mapRef = ref(null);
const query = ref('');
const results = ref(null);
const searching = ref(false);
const memberKeyword = ref('');
const mobileTab = ref('list');
const routes = ref({}); // { [date]: { coords, legs } }
const routing = ref(false);
const mobileTabs = [{ key: 'list', label: '行程', icon: 'list' }, { key: 'map', label: '地圖', icon: 'map' }];

const days = computed(() => tripDays(trip.value));
const unscheduled = computed(() => stops.value.filter((s) => !s.date).sort(byStopOrder));
const totalCost = computed(() => stops.value.reduce((sum, s) => sum + (s.cost || 0), 0));

const groups = computed(() => {
  const list = days.value.map((d) => {
    const dayStops = stops.value.filter((s) => s.date === d.date).sort(byStopOrder);
    const route = routes.value[d.date];
    const straight = dayStops.slice(1).reduce((sum, s, i) => sum + distanceKm(dayStops[i], s), 0);
    return {
      key: d.date,
      date: d.date,
      title: d.title,
      subtitle: d.subtitle,
      color: d.color,
      numbered: true,
      stops: dayStops,
      cost: dayStops.reduce((sum, s) => sum + (s.cost || 0), 0),
      legs: route?.legs,
      distance: route ? route.legs.reduce((sum, l) => sum + l.distance, 0) : straight,
      duration: route ? route.legs.reduce((sum, l) => sum + (l.duration || 0), 0) : 0,
    };
  });
  list.push({
    key: 'unscheduled', date: null, title: '未排入日期', subtitle: '', color: UNSCHEDULED_COLOR, numbered: false, stops: unscheduled.value, cost: 0, distance: 0,
  });
  return list;
});
const visibleGroups = computed(() => {
  if (!selectedDate.value) return groups.value.filter((g) => g.date || g.stops.length);
  if (selectedDate.value === 'unscheduled') return groups.value.filter((g) => !g.date);
  return groups.value.filter((g) => g.date === selectedDate.value);
});

const memberCandidates = computed(() => {
  const kw = memberKeyword.value.trim().toLowerCase();
  const ids = new Set(members.value.map((m) => m.id));
  return plans.users.filter((u) => !ids.has(u.id) && (u.displayName.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw)));
});

async function load() {
  try {
    const data = await api.get(`/trips/${tripId}`);
    trip.value = data.trip;
    members.value = data.members;
    stops.value = data.stops;
  } catch (e) {
    error.value = e.message;
  }
}

const upsertStop = (s) => {
  const i = stops.value.findIndex((x) => x.id === s.id);
  if (i >= 0) stops.value[i] = s;
  else stops.value.push(s);
};

/* ---- 新增地點 ---- */
let searchTimer = null;
let searchAbort = null;
let searchSeq = 0;
const googleMapsSearchUrl = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query.value.trim()} 台灣`)}`);
const canceled = (e) => e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';

function searchCenter() {
  const located = stops.value.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const day = selectedDate.value && selectedDate.value !== 'unscheduled'
    ? located.filter((s) => s.date === selectedDate.value)
    : [];
  const pool = day.length ? day : located;
  if (!pool.length) return { lat: 25.047, lng: 121.517 };
  return {
    lat: pool.reduce((sum, s) => sum + s.lat, 0) / pool.length,
    lng: pool.reduce((sum, s) => sum + s.lng, 0) / pool.length,
  };
}

const searchNote = ref('');

/**
 * 搜尋順序：
 *  1. 座標（例如 25.0339, 121.5645）
 *  2. Google 地圖連結：從網址讀出名稱與座標；短網址先由後端解析出完整網址
 *  3. 一般文字：OpenStreetMap（Photon）
 */
async function search() {
  clearTimeout(searchTimer);
  const q = query.value.trim();
  searchNote.value = '';
  if (q.length < 2) {
    results.value = null;
    return;
  }
  searchAbort?.abort();
  const ac = new AbortController();
  searchAbort = ac;
  const seq = ++searchSeq;
  const done = (rows, note = '') => {
    if (seq !== searchSeq) return;
    results.value = rows;
    searchNote.value = note;
    searching.value = false;
  };
  const outside = (p) => !inTaiwan(p.lat, p.lng);

  const coords = parseCoordinates(q);
  if (coords) {
    if (outside(coords)) done([], '這個座標不在台灣範圍內');
    else done([{ title: '座標位置', address: `${coords.lat}, ${coords.lng}`, ...coords }]);
    return;
  }

  searching.value = true;
  try {
    if (isGoogleMapsUrl(q)) {
      const url = isShortGoogleUrl(q) ? (await api.post('/places/resolve', { url: q }, { signal: ac.signal })).url : q;
      const place = placeFromGoogleUrl(url);
      if (place?.lat != null) {
        if (outside(place)) done([], '這個地點不在台灣範圍內');
        else done([{ title: place.title, address: 'Google 地圖連結', lat: place.lat, lng: place.lng }]);
      } else if (place?.title) {
        done(await searchPlaces(place.title, ac.signal, searchCenter()), `連結沒有座標，改用「${place.title}」搜尋`);
      } else {
        done([], '這個連結沒有位置資訊，請在 Google 地圖開啟地點後再按「分享」複製連結');
      }
      return;
    }
    done(await searchPlaces(q, ac.signal, searchCenter()));
  } catch (e) {
    if (seq !== searchSeq || canceled(e) || e.status === 401) return;
    searching.value = false;
    ui.error(e);
  }
}
// 邊打字邊搜尋（停止輸入 400ms 後才查詢）
function onQueryInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(search, 400);
}

/* ---- 道路路線 ---- */
let routeTimer = null;
let routeSeq = 0;
async function computeRoutes() {
  if (!trip.value) return;
  const seq = ++routeSeq;
  const mode = trip.value.travelMode;
  const next = {};
  const pendingRail = [];
  routing.value = true;
  try {
    await Promise.all(days.value.map(async (d) => {
      const dayStops = stops.value.filter((s) => s.date === d.date).sort(byStopOrder);
      if (dayStops.length < 2) return;
      try {
        const route = await planDayRoute(dayStops, mode);
        if (route) {
          next[d.date] = route;
          pendingRail.push({ date: d.date, stops: dayStops });
        }
      } catch {
        // 路線服務失敗時以直線顯示
      }
    }));
    if (seq !== routeSeq) return;
    routes.value = next;
    for (const item of pendingRail) {
      upgradeRailLegs(item.stops, mode, (index, leg) => {
        if (seq !== routeSeq) return;
        const current = routes.value[item.date];
        if (!current?.legs?.[index]) return;
        const legs = current.legs.slice();
        legs[index] = leg;
        const lines = current.lines.map((line) => (line.segIndex === index ? { ...line, coords: leg.coords } : line));
        routes.value = { ...routes.value, [item.date]: { lines, legs } };
      });
    }
  } finally {
    if (seq === routeSeq) routing.value = false;
  }
}
// 地點、順序或交通方式改變時重新規劃（只看會影響路線的欄位）
const routeKey = computed(() => (trip.value ? [
  trip.value.travelMode,
  ...stops.value.filter((s) => s.date).sort(byStopOrder).map((s) => `${s.date}:${s.lat},${s.lng}:${s.arriveMode || ''}`),
].join('|') : ''));
watch(routeKey, () => {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(computeRoutes, 300);
});

/* ---- 路段交通方式 ---- */
const roadModes = TRAVEL_MODES.filter((m) => m.kind === 'road');
const railModes = TRAVEL_MODES.filter((m) => m.kind === 'rail');
const lineMode = TRAVEL_MODES.find((m) => m.kind === 'line');
// 第 index 段：第 index 個地點 → 第 index+1 個地點（交通方式記在抵達的地點上）
function seg(g, index) {
  const info = travelModeInfo(g.stops[index + 1].arriveMode || trip.value.travelMode);
  const custom = !!g.stops[index + 1].arriveMode;
  const leg = g.legs?.[index];
  const straight = fmtDistance(distanceKm(g.stops[index], g.stops[index + 1]));
  if (!leg) return { info, custom, detail: '計算路線中…', failed: false };
  if (info.kind === 'line') return { info, custom, detail: `直線 ${straight}`, failed: false };
  if (leg.failed) return { info, custom, detail: `無法規劃道路，改顯示直線 ${straight}`, failed: true };
  if (info.kind === 'rail') {
    const dist = leg.alongTrack ? `軌道 ${fmtDistance(leg.distance)}` : `直線 ${straight}`;
    return { info, custom, detail: `約 ${fmtDuration(leg.duration)} · ${dist}`, failed: false };
  }
  return { info, custom, detail: `${fmtDuration(leg.duration)} · ${fmtDistance(leg.distance)}`, failed: false };
}
function setArriveMode(stop, mode) {
  if ((stop.arriveMode || null) === mode) return;
  patchStop(stop, { arriveMode: mode });
}

async function setTravelMode(mode) {
  if (trip.value.travelMode === mode) return;
  const old = trip.value.travelMode;
  trip.value.travelMode = mode;
  try {
    await api.put(`/trips/${tripId}`, { travelMode: mode });
  } catch (e) {
    trip.value.travelMode = old;
    ui.error(e);
  }
}

const defaultDate = () => (selectedDate.value && selectedDate.value !== 'unscheduled' ? selectedDate.value : days.value[0]?.date ?? null);

function openNewStop(place) {
  results.value = null;
  query.value = '';
  editing.value = {
    title: place.title, address: place.address, lat: place.lat, lng: place.lng, category: 'sight', date: defaultDate(),
  };
}

/* ---- 編輯 / 儲存地點 ---- */
const dayStopsOf = (date) => stops.value.filter((s) => s.date === date);

function editStop(s) {
  editing.value = { ...s };
}

async function saveStop(form) {
  const original = form.id ? stops.value.find((s) => s.id === form.id) : null;
  const payload = {
    title: form.title,
    category: form.category,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    address: form.address,
    cost: form.cost,
    notes: form.notes,
    lat: form.lat,
    lng: form.lng,
  };
  // 依時間排序；換到別天且沒有時間時放到該天最後
  const dateChanged = !original || original.date !== form.date;
  const timeChanged = !original || original.startTime !== form.startTime;
  if (form.date && form.startTime && (dateChanged || timeChanged)) {
    payload.sortOrder = sortOrderForTime(dayStopsOf(form.date), { id: form.id ?? -1, sortOrder: Infinity }, form.startTime);
  } else if (dateChanged) {
    const max = Math.max(0, ...stops.value.filter((s) => s.date === form.date && s.id !== form.id).map((s) => s.sortOrder));
    payload.sortOrder = max + 1;
  }

  saving.value = true;
  try {
    const stop = form.id
      ? await api.put(`/trips/${tripId}/stops/${form.id}`, payload)
      : await api.post(`/trips/${tripId}/stops`, payload);
    upsertStop(stop);
    editing.value = null;
    results.value = null;
    query.value = '';
    focusStopId.value = stop.id;
    if (!form.id) ui.toast(`已將「${stop.title}」加入行程`, 'success');
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}

async function deleteStop(s) {
  const ok = await ui.confirm({ title: '刪除地點', message: `確定要從行程中刪除「${s.title}」嗎？` });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}/stops/${s.id}`);
    stops.value = stops.value.filter((x) => x.id !== s.id);
    editing.value = null;
  } catch (e) {
    ui.error(e);
  }
}

async function patchStop(s, patch) {
  const backup = { ...s };
  upsertStop({ ...s, ...patch });
  try {
    upsertStop(await api.put(`/trips/${tripId}/stops/${s.id}`, patch));
  } catch (e) {
    upsertStop(backup);
    ui.error(e);
  }
}

// 拖曳排序 / 換天
function onDragChange(e, g) {
  const evt = e.added || e.moved;
  if (!evt) return;
  const s = evt.element;
  const list = g.stops.filter((x) => x.id !== s.id);
  patchStop(s, { date: g.date, sortOrder: sortOrderAt(list, evt.newIndex) });
}

/* ---- 地圖互動 ---- */
function focusStop(s) {
  focusStopId.value = null;
  requestAnimationFrame(() => { focusStopId.value = s.id; });
}

function onMarkerSelect(s) {
  focusStopId.value = s.id;
  editStop(s);
}

function onMarkerMove(s, latlng) {
  patchStop(s, latlng);
}

function fitMap() {
  selectedDate.value = null;
  mapRef.value?.fit();
}

/* ---- 行程與成員 ---- */
function onTripSaved(t) {
  const shrunk = t.startDate > trip.value.startDate || t.endDate < trip.value.endDate;
  trip.value = { ...trip.value, ...t };
  if (shrunk) load();
  ui.toast('已儲存行程設定', 'success');
}

async function addMember(u) {
  try {
    const m = await api.post(`/trips/${tripId}/members`, { userId: u.id });
    if (!members.value.find((x) => x.id === m.id)) members.value.push(m);
    memberKeyword.value = '';
    ui.toast(`已將 ${u.displayName} 加入行程`, 'success');
  } catch (e) {
    ui.error(e);
  }
}

async function removeMember(m) {
  const ok = await ui.confirm({ title: '移除成員', message: `確定要將 ${m.displayName} 從行程中移除嗎？`, okText: '移除' });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}/members/${m.id}`);
    members.value = members.value.filter((x) => x.id !== m.id);
  } catch (e) {
    ui.error(e);
  }
}

async function leave() {
  const ok = await ui.confirm({ title: '離開行程', message: '確定要離開此行程嗎？', okText: '離開' });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}/members/${auth.user.id}`);
    router.push('/trips');
  } catch (e) {
    ui.error(e);
  }
}

async function removeTrip() {
  const ok = await ui.confirm({ title: '刪除行程', message: `確定要刪除「${trip.value.name}」嗎？\n所有地點都會一併刪除，無法復原。` });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}`);
    ui.toast('已刪除行程', 'success');
    router.push('/trips');
  } catch (e) {
    ui.error(e);
  }
}

load();
</script>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--color-line-2);
  background: #fff;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.chip:hover {
  background: var(--color-hover);
}
.chip-on {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-weight: 600;
}
</style>
