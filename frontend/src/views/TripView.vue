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
            <button class="menu-item" @click="budgetOpen = true"><Icon name="wallet" />預算與花費</button>
            <div class="border-t border-line my-1"></div>
            <button v-if="trip.isMember && trip.ownerId !== auth.user?.id" class="menu-item" @click="leave"><Icon name="door" />離開行程</button>
            <button v-if="trip.canManage" class="menu-item !text-[#c50f1f]" @click="removeTrip"><Icon name="trash" />刪除行程</button>
          </Popover>
        </div>
        <div class="text-xs text-ink-3 flex flex-wrap gap-x-3">
          <span>{{ fmtTripRange(trip) }}</span>
          <span>{{ stops.length }} 個地點</span>
          <button type="button" class="hover:underline cursor-pointer" :class="overBudget ? 'text-[#c50f1f] font-semibold' : ''" title="預算與花費統計" @click="budgetOpen = true">
            {{ totalCost ? `預估花費 ${fmtCost(totalCost)}` : '預算' }}<template v-if="trip.budget">／預算 {{ fmtCost(trip.budget) }}</template>
          </button>
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
            <input ref="searchInput" v-model="query" class="input !pl-8" placeholder="搜尋地點，或貼上 Google 地圖連結" maxlength="2000" @input="onQueryInput" />
          </form>
          <div v-if="laneTarget" class="flex items-center gap-2 rounded bg-accent-light text-accent text-xs px-2 py-1.5">
            <Avatar :user="laneTarget.member" :size="20" />
            <span class="flex-1 min-w-0 leading-4">正在加入 <b>{{ laneTarget.member.displayName }}</b> 的{{ laneTarget.phaseLabel }}地點：搜尋地點、貼上 Google 地圖連結或座標</span>
            <button class="shrink-0 hover:underline cursor-pointer" @click="laneTarget = null">取消</button>
          </div>
          <div v-if="searching" class="text-xs text-ink-3 px-1">搜尋中…</div>
          <div v-else-if="results" class="rounded border border-line bg-white max-h-64 overflow-y-auto thin-scroll">
            <div class="flex items-start justify-between gap-2 px-3 py-2 text-xs leading-4 text-ink-3 border-b border-line">
              <span class="min-w-0">{{ results.length ? (searchNote || (laneTarget ? `點選地點加入${laneTarget.member.displayName}的${laneTarget.phaseLabel}路線` : '點選地點加入行程，或按「＋備選」先放著')) : (searchNote || '找不到符合的地點') }}</span>
              <button class="hover:text-ink cursor-pointer shrink-0" @click="results = null"><Icon name="x" :size="13" /></button>
            </div>
            <div v-for="(r, i) in results" :key="i" class="flex items-stretch border-b border-line last:border-0">
              <button class="flex-1 min-w-0 text-left px-3 py-2 hover:bg-hover cursor-pointer" @click="openNewStop(r)">
                <div class="text-sm font-semibold truncate">{{ r.title }}</div>
                <div class="text-xs text-ink-3 line-clamp-2">{{ r.address }}</div>
              </button>
              <button v-if="!laneTarget" class="shrink-0 px-3 text-xs text-accent border-l border-line hover:bg-hover cursor-pointer" title="先放到備選，之後再決定要不要去" @click="openNewStop(r, true)">＋備選</button>
            </div>
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
          <button v-if="allBackups.length" class="chip" :class="selectedDate === 'unscheduled' ? 'chip-on' : ''" title="所有備選地點" @click="selectedDate = 'unscheduled'">🔖 備選 {{ allBackups.length }}</button>
        </div>

        <!-- 每日行程 -->
        <div class="flex-1 min-h-0 overflow-y-auto thin-scroll p-3 space-y-4">
          <section v-for="g in visibleGroups" :key="g.key">
            <header class="flex items-center gap-2 mb-2">
              <span class="w-1 h-5 rounded" :style="{ background: g.color }"></span>
              <h3 class="font-semibold text-sm whitespace-nowrap shrink-0">{{ g.title }}</h3>
              <span class="text-xs text-ink-3 truncate min-w-0">{{ g.subtitle }}</span>
              <div class="flex-1"></div>
              <span v-if="g.distance" class="text-xs text-ink-3 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Icon name="route" :size="12" />{{ fmtDistance(g.distance) }}<template v-if="g.duration">・{{ g.legs?.some((l) => l.estimated) ? '約 ' : '' }}{{ fmtDuration(g.duration) }}</template>
              </span>
              <span v-if="g.cost" class="text-xs text-ink-3 whitespace-nowrap shrink-0">{{ fmtCost(g.cost) }}</span>
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
              <Popover v-if="g.numbered && (g.stops.length > 1 || members.length > 1)" close-on-click placement="bottom-end">
                <template #trigger>
                  <button class="icon-btn !size-7" title="自動排時間、最佳順序、各自出發 / 回程"><Icon name="more" :size="15" /></button>
                </template>
                <template v-if="g.stops.length > 1">
                  <button class="menu-item" @click="scheduleDate = g.date"><Icon name="clock" />自動排時間</button>
                  <button class="menu-item" :disabled="g.stops.length < 3" :class="g.stops.length < 3 ? 'opacity-50 pointer-events-none' : ''" @click="optimizeDate = g.date">
                    <Icon name="route" />最佳順序<span v-if="g.stops.length < 3" class="ml-auto text-xs text-ink-4">需 3 個地點</span>
                  </button>
                </template>
                <template v-if="members.length > 1">
                  <div v-if="g.stops.length > 1" class="border-t border-line my-1"></div>
                  <button class="menu-item" @click="openLanes(g.date, 'depart')"><Icon name="users" />各自出發（從不同地方出發）</button>
                  <button class="menu-item" @click="openLanes(g.date, 'return')"><Icon name="users" />各自回程（散場各自回家）</button>
                </template>
              </Popover>
            </header>
            <div v-if="g.numbered && dayWeather(g)" class="-mt-1 mb-2 pl-3 flex items-center gap-1.5 text-xs text-ink-2" :title="`天氣預報（${dayWeather(g).place}附近，Open-Meteo）`">
              <span class="text-sm leading-none">{{ weatherInfo(dayWeather(g).code).emoji }}</span>
              <span>{{ weatherInfo(dayWeather(g).code).label }}</span>
              <span class="tabular-nums">{{ fmtTemp(dayWeather(g).min) }}–{{ fmtTemp(dayWeather(g).max) }}</span>
              <span v-if="dayWeather(g).rain != null" class="tabular-nums" :class="dayWeather(g).rain >= 50 ? 'text-accent font-semibold' : 'text-ink-3'">☔ 降雨 {{ dayWeather(g).rain }}%</span>
            </div>
            <div v-else-if="g.numbered && g.date > weatherWindow.to" class="-mt-1 mb-2 pl-3 text-[11px] text-ink-4">出發前 {{ FORECAST_DAYS }} 天內會顯示天氣預報</div>

            <DayLanes
              v-if="g.numbered && (g.departLanes.length || laneOpen[`${g.date}|depart`])"
              phase="depart"
              :lanes="g.departLanes"
              :meeting="g.stops[0] || null"
                :members="members"
                :travel-mode="trip.travelMode"
                :focus-stop-id="focusStopId"
                @add="(memberId) => startLaneStop(g.date, 'depart', memberId)"
                @edit="editStop"
                @delete="deleteStop"
                @mode="(stop, m) => setArriveMode(stop, m)"
                @reorder="(stop, sortOrder) => patchStop(stop, { sortOrder })"
                @focus="focusStop"
                @close="laneOpen[`${g.date}|depart`] = false"
            />

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
                  <StopCard
                    :stop="s"
                    :label="g.numbered ? index + 1 : '備'"
                    :color="g.numbered ? g.color : backupColor(s)"
                    :backup="!g.numbered"
                    :tag="!g.numbered && s.date ? `${dayTitle(s.date)}備選` : ''"
                    :focused="focusStopId === s.id"
                    :weather="g.numbered ? stopWeather(s) : null"
                    @focus="focusStop(s)"
                    @edit="editStop(s)"
                  >
                    <template #menu>
                      <button class="menu-item" @click="editStop(s)"><Icon name="pencil" />編輯</button>
                      <template v-if="g.numbered">
                        <button class="menu-item" @click="backupTarget = s"><Icon name="move" />沒開？換成備選…</button>
                        <button class="menu-item" @click="moveToBackup(s)"><Icon name="tag" />移到這天的備選</button>
                      </template>
                      <div v-else class="max-h-64 overflow-y-auto thin-scroll">
                        <button v-for="d in days" :key="d.date" class="menu-item" @click="scheduleBackup(s, d.date)"><Icon name="calendar" />排入{{ d.title }}（{{ d.subtitle }}）</button>
                      </div>
                      <div class="border-t border-line my-1"></div>
                      <button class="menu-item !text-[#c50f1f]" @click="deleteStop(s)"><Icon name="trash" />刪除</button>
                    </template>
                  </StopCard>
                  <SegmentCard
                    v-if="g.numbered && index < g.stops.length - 1"
                    :seg="seg(g, index)"
                    :mode="g.stops[index + 1].arriveMode || null"
                    :default-label="travelModeInfo(trip.travelMode).label"
                    :caption="`這一段前往「${g.stops[index + 1].title}」`"
                    :fare="g.stops[index + 1].arriveCost ?? null"
                    :rail-url="googleSegmentUrl(s, g.stops[index + 1], seg(g, index).info.key)"
                    :color="g.color"
                    @mode="(m) => setArriveMode(g.stops[index + 1], m)"
                    @fare="editStop(g.stops[index + 1], 'arriveCost')"
                  />
                </div>
              </template>
            </draggable>
            <div v-if="!g.stops.length" class="text-xs text-ink-4 px-1 -mt-8 mb-2 h-8 flex items-center pointer-events-none">
              {{ g.numbered ? '拖曳地點到這裡，或搜尋新增' : '還沒有備選。搜尋時按「＋備選」，或拖曳地點到這裡' }}
            </div>

            <DayLanes
              v-if="g.numbered && (g.returnLanes.length || laneOpen[`${g.date}|return`])"
              phase="return"
              :lanes="g.returnLanes"
              :meeting="g.stops[g.stops.length - 1] || null"
                :members="members"
                :travel-mode="trip.travelMode"
                :focus-stop-id="focusStopId"
                @add="(memberId) => startLaneStop(g.date, 'return', memberId)"
                @edit="editStop"
                @delete="deleteStop"
                @mode="(stop, m) => setArriveMode(stop, m)"
                @reorder="(stop, sortOrder) => patchStop(stop, { sortOrder })"
                @focus="focusStop"
                @close="laneOpen[`${g.date}|return`] = false"
            />

            <!-- 這天的備選：不排序號、不連線、不計入時間與預算 -->
            <div v-if="g.numbered && g.backups.length" class="mt-2">
              <button type="button" class="flex items-center gap-1 h-6 px-1 text-xs text-ink-3 hover:text-ink cursor-pointer" @click="collapsedBackups[g.date] = !collapsedBackups[g.date]">
                <Icon name="chevron-down" :size="12" class="transition-transform" :class="collapsedBackups[g.date] ? '-rotate-90' : ''" />
                🔖 這天的備選（{{ g.backups.length }}）
              </button>
              <draggable
                v-show="!collapsedBackups[g.date]"
                :model-value="g.backups"
                item-key="id"
                group="stops"
                class="space-y-1 mt-1 min-h-6"
                ghost-class="drag-ghost"
                :animation="150"
                :delay="250"
                :delay-on-touch-only="true"
                :force-fallback="true"
                :fallback-on-body="true"
                fallback-class="drag-fallback"
                filter=".no-drag"
                :prevent-on-filter="false"
                @change="(e) => onBackupDragChange(e, g)"
              >
                <template #item="{ element: s }">
                  <div>
                    <StopCard :stop="s" label="備" :color="g.color" backup :focused="focusStopId === s.id" @focus="focusStop(s)" @edit="editStop(s)">
                      <template #action>
                        <button class="no-drag shrink-0 self-center h-7 px-2 rounded text-xs text-accent hover:bg-hover cursor-pointer" title="排入這天的行程（加在最後）" @click.stop="scheduleBackup(s, g.date)">排入</button>
                      </template>
                      <template #menu>
                        <button class="menu-item" @click="editStop(s)"><Icon name="pencil" />編輯</button>
                        <button class="menu-item" @click="scheduleBackup(s, g.date)"><Icon name="calendar" />排入{{ g.title }}</button>
                        <button class="menu-item" @click="patchStop(s, { date: null })"><Icon name="tag" />改為未定日期的備選</button>
                        <div class="border-t border-line my-1"></div>
                        <button class="menu-item !text-[#c50f1f]" @click="deleteStop(s)"><Icon name="trash" />刪除</button>
                      </template>
                    </StopCard>
                  </div>
                </template>
              </draggable>
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
          :lanes="mapLanes"
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
    <BackupPickerDialog
      :target="backupTarget"
      :backups="allBackups"
      :days="days"
      :saving="bulkSaving"
      @close="backupTarget = null"
      @replace="replaceWithBackup"
      @insert="insertBackupAfter"
    />
    <BudgetDialog
      v-model="budgetOpen"
      :trip="trip"
      :stops="stops"
      :days="days"
      :members="members"
      @save-budget="saveBudget"
      @edit="editFromBudget"
    />
    <AutoScheduleDialog
      :group="scheduleGroup"
      :travel-mode="trip.travelMode"
      :routing="routing"
      :saving="bulkSaving"
      @close="scheduleDate = null"
      @apply="applySchedule"
    />
    <OptimizeOrderDialog
      :group="optimizeGroup"
      :travel-mode="trip.travelMode"
      :saving="bulkSaving"
      @close="optimizeDate = null"
      @apply="applyOrder"
    />
  </template>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import TripIcon from '@/components/trip/TripIcon.vue';
import TripMap from '@/components/trip/TripMap.vue';
import StopEditor from '@/components/trip/StopEditor.vue';
import TripFormDialog from '@/components/trip/TripFormDialog.vue';
import BudgetDialog from '@/components/trip/BudgetDialog.vue';
import StopCard from '@/components/trip/StopCard.vue';
import SegmentCard from '@/components/trip/SegmentCard.vue';
import DayLanes from '@/components/trip/DayLanes.vue';
import BackupPickerDialog from '@/components/trip/BackupPickerDialog.vue';
import AutoScheduleDialog from '@/components/trip/AutoScheduleDialog.vue';
import OptimizeOrderDialog from '@/components/trip/OptimizeOrderDialog.vue';
import api from '@/api';
import { sortOrderAt } from '@/utils/planner';
import {
  tripDays, fmtTripRange, stopCategory, setCustomCategories, distanceKm, fmtDistance, fmtCost, byStopOrder,
  sortOrderForTime, searchPlaces, stopTotal, isBackup, isPlanned, isShared,
  segmentInfo, groupLanes, laneSequence, laneTimes, LANE_PHASES, UNSCHEDULED_COLOR, inTaiwan,
  parseCoordinates, isGoogleMapsUrl, isShortGoogleUrl, placeFromGoogleUrl,
  DEFAULT_TRAVEL_MODES, travelModeInfo, planDayRoute, upgradeRailLegs, fmtDuration, googleDirectionsUrl, googleSegmentUrl,
} from '@/utils/trip';
import {
  fetchWeather, weatherKey, weatherInfo, weatherRange, hourlyAt, fmtTemp, FORECAST_DAYS,
} from '@/utils/weather';
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
// 備選：未定日期的放在「備選清單」，有日期的顯示在那天下方
const allBackups = computed(() => stops.value.filter(isBackup).sort((a, b) => (a.date || '').localeCompare(b.date || '') || byStopOrder(a, b)));
const undatedBackups = computed(() => allBackups.value.filter((s) => !s.date));
const collapsedBackups = reactive({});
const dayTitle = (date) => days.value.find((d) => d.date === date)?.title || date;
const backupColor = (s) => days.value.find((d) => d.date === s.date)?.color || UNSCHEDULED_COLOR;
const totalCost = computed(() => stops.value.filter(isPlanned).reduce((sum, s) => sum + stopTotal(s), 0)); // 備選不計入
const overBudget = computed(() => !!trip.value?.budget && totalCost.value > trip.value.budget);
const budgetOpen = ref(false);

/* ---- 分頭路線（各自出發 / 各自回程） ---- */
const laneRoutes = ref({}); // { [lane.key]: { lines, legs, sig } }
const laneOpen = reactive({}); // 從選單打開、還沒有地點的分頭路線
const allLanes = computed(() => groupLanes(stops.value, members.value));
const laneSig = (seq) => seq.map((x) => `${x.id}:${x.lat},${x.lng}:${x.arriveMode || ''}`).join('|');
// 分頭路線依成員順序配色（不用頭像顏色：頭像顏色可能重複，也可能跟當天路線同色）
const LANE_COLORS = ['#ca5010', '#107c10', '#c239b3', '#8764b8', '#038387', '#986f0b', '#d13438', '#004e8c'];
const memberOf = (id) => {
  const i = members.value.findIndex((m) => m.id === id);
  return i >= 0 ? { ...members.value[i], color: LANE_COLORS[i % LANE_COLORS.length] } : { id, displayName: '成員', color: '#8a8886' };
};
function lanesFor(date, phase, shared) {
  const meeting = phase === 'depart' ? shared[0] : shared[shared.length - 1];
  return allLanes.value.filter((l) => l.date === date && l.phase === phase).map((l) => {
    const seq = laneSequence(phase, l.stops, meeting);
    const sig = laneSig(seq);
    const route = laneRoutes.value[l.key]?.sig === sig ? laneRoutes.value[l.key] : null;
    return {
      ...l, member: memberOf(l.memberId), meeting, hasMeeting: !!meeting, seq, sig, legs: route?.legs, lines: route?.lines, times: laneTimes(phase, seq, route?.legs, meeting),
    };
  });
}

const groups = computed(() => {
  const list = days.value.map((d) => {
    const dayStops = stops.value.filter((s) => s.date === d.date && isShared(s)).sort(byStopOrder);
    // 路線是依哪個順序算的；順序剛改、還沒重算完時先不用舊的路段
    const saved = routes.value[d.date];
    const route = saved?.ids === dayStops.map((s) => s.id).join(',') ? saved : null;
    const straight = dayStops.slice(1).reduce((sum, s, i) => sum + distanceKm(dayStops[i], s), 0);
    return {
      key: d.date,
      date: d.date,
      title: d.title,
      subtitle: d.subtitle,
      color: d.color,
      numbered: true,
      stops: dayStops,
      backups: stops.value.filter((s) => s.date === d.date && s.isBackup).sort(byStopOrder),
      departLanes: lanesFor(d.date, 'depart', dayStops),
      returnLanes: lanesFor(d.date, 'return', dayStops),
      cost: dayStops.reduce((sum, s) => sum + stopTotal(s), 0),
      legs: route?.legs,
      distance: route ? route.legs.reduce((sum, l) => sum + l.distance, 0) : straight,
      duration: route ? route.legs.reduce((sum, l) => sum + (l.duration || 0), 0) : 0,
    };
  });
  list.push({
    key: 'unscheduled',
    date: null,
    title: '🔖 備選清單',
    subtitle: selectedDate.value === 'unscheduled' ? '全部備選' : '未定日期',
    color: UNSCHEDULED_COLOR,
    numbered: false,
    stops: selectedDate.value === 'unscheduled' ? allBackups.value : undatedBackups.value,
    backups: [],
    departLanes: [],
    returnLanes: [],
    cost: 0,
    distance: 0,
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
    setCustomCategories(data.categories || []);
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
      const dayStops = stops.value.filter((s) => s.date === d.date && isShared(s)).sort(byStopOrder);
      if (dayStops.length < 2) return;
      try {
        const route = await planDayRoute(dayStops, mode);
        if (route) {
          next[d.date] = { ...route, ids: dayStops.map((s) => s.id).join(',') };
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
        routes.value = { ...routes.value, [item.date]: { ...current, lines, legs } };
      });
    }
  } finally {
    if (seq === routeSeq) routing.value = false;
  }
}
// 地點、順序或交通方式改變時重新規劃（只看會影響路線的欄位）
const routeKey = computed(() => (trip.value ? [
  trip.value.travelMode,
  ...stops.value.filter(isShared).sort(byStopOrder).map((s) => `${s.date}:${s.lat},${s.lng}:${s.arriveMode || ''}`),
].join('|') : ''));
watch(routeKey, () => {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(computeRoutes, 300);
});

/* ---- 天氣預報 ---- */
const weather = ref(new Map());
const weatherWindow = ref(weatherRange());
const centerOf = (list) => ({
  lat: list.reduce((sum, s) => sum + s.lat, 0) / list.length,
  lng: list.reduce((sum, s) => sum + s.lng, 0) / list.length,
});
// 每天以當天地點的中心查詢；沒有地點的日子用整個行程的中心
const dayCenters = computed(() => {
  const dated = stops.value.filter(isShared);
  const tripCenter = dated.length ? centerOf(dated) : null;
  const map = {};
  for (const d of days.value) {
    const list = dated.filter((s) => s.date === d.date);
    const center = list.length ? centerOf(list) : tripCenter;
    if (center) map[d.date] = { ...center, place: list.length ? (list.length === 1 ? `「${list[0].title}」` : '當天地點') : '行程地點' };
  }
  return map;
});
function dayWeather(g) {
  const center = dayCenters.value[g.date];
  const daily = center && weather.value.get(weatherKey(center))?.daily[g.date];
  return daily ? { ...daily, place: center.place } : null;
}
const stopWeather = (s) => (s.date && s.startTime ? hourlyAt(weather.value.get(weatherKey(s)), s.date, s.startTime) : null);

let weatherTimer = null;
let weatherAbort = null;
async function loadWeather() {
  if (!trip.value) return;
  weatherWindow.value = weatherRange();
  const points = [...Object.values(dayCenters.value), ...stops.value.filter((s) => s.date)];
  weatherAbort?.abort();
  const ac = new AbortController();
  weatherAbort = ac;
  try {
    weather.value = await fetchWeather(points, trip.value.startDate, trip.value.endDate, ac.signal);
  } catch {
    // 天氣只是輔助資訊，查不到就不顯示
  }
}
const weatherQuery = computed(() => (trip.value ? [
  trip.value.startDate, trip.value.endDate,
  ...Object.values(dayCenters.value).map(weatherKey),
  ...stops.value.filter((s) => s.date).map(weatherKey),
].join('|') : ''));
watch(weatherQuery, () => {
  clearTimeout(weatherTimer);
  weatherTimer = setTimeout(loadWeather, 500);
});

let laneRouteTimer = null;
let laneRouteSeq = 0;
const visibleLaneList = computed(() => groups.value.flatMap((g) => [...g.departLanes, ...g.returnLanes]));
async function computeLaneRoutes() {
  if (!trip.value) return;
  const seq = ++laneRouteSeq;
  const mode = trip.value.travelMode;
  const list = visibleLaneList.value.filter((l) => l.seq.length >= 2);
  const next = {};
  await Promise.all(list.map(async (l) => {
    try {
      const route = await planDayRoute(l.seq, mode);
      if (route) next[l.key] = { ...route, sig: l.sig };
    } catch {
      // 路線服務失敗時以直線顯示
    }
  }));
  if (seq !== laneRouteSeq) return;
  laneRoutes.value = next;
  for (const l of list) {
    upgradeRailLegs(l.seq, mode, (index, leg) => {
      const current = laneRoutes.value[l.key];
      if (seq !== laneRouteSeq || current?.sig !== l.sig || !current.legs[index]) return;
      const legs = current.legs.slice();
      legs[index] = leg;
      const lines = current.lines.map((line) => (line.segIndex === index ? { ...line, coords: leg.coords } : line));
      laneRoutes.value = { ...laneRoutes.value, [l.key]: { ...current, lines, legs } };
    });
  }
}
const laneRouteKey = computed(() => (trip.value ? [trip.value.travelMode, ...visibleLaneList.value.map((l) => l.sig)].join('#') : ''));
watch(laneRouteKey, () => {
  clearTimeout(laneRouteTimer);
  laneRouteTimer = setTimeout(computeLaneRoutes, 300);
});

// 地圖只在選了某一天時畫分頭路線，避免「全部」時太亂
const mapLanes = computed(() => {
  const g = groups.value.find((x) => x.date && x.date === selectedDate.value);
  if (!g) return [];
  return [...g.departLanes, ...g.returnLanes].map((l) => ({
    key: l.key, color: l.member.color || '#8a8886', name: l.member.displayName, stops: l.stops, seq: l.seq, lines: l.lines,
  }));
});

const laneTarget = ref(null); // 正在為誰加入分頭路線的地點
const searchInput = ref(null);
function openLanes(date, phase) {
  laneOpen[`${date}|${phase}`] = true;
}
function startLaneStop(date, phase, memberId) {
  laneTarget.value = {
    date, phase, member: memberOf(memberId), phaseLabel: LANE_PHASES.find((p) => p.key === phase).label,
  };
  mobileTab.value = 'list';
  requestAnimationFrame(() => searchInput.value?.focus());
}
const laneInfo = (s) => (s.memberId ? { name: memberOf(s.memberId).displayName, phase: s.phase, phaseLabel: LANE_PHASES.find((p) => p.key === s.phase)?.label } : null);

/* ---- 路段交通方式 ---- */
// 第 index 段：第 index 個地點 → 第 index+1 個地點（交通方式記在抵達的地點上）
function seg(g, index) {
  const to = g.stops[index + 1];
  return segmentInfo(to.arriveMode || trip.value.travelMode, !!to.arriveMode, g.legs?.[index], g.stops[index], to, to.arriveCost);
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

function openNewStop(place, asBackup = false) {
  results.value = null;
  query.value = '';
  const day = selectedDate.value && selectedDate.value !== 'unscheduled' ? selectedDate.value : null;
  const lane = laneTarget.value;
  laneTarget.value = null;
  if (lane) {
    editing.value = {
      title: place.title,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: 'transport',
      date: lane.date,
      isBackup: false,
      memberId: lane.member.id,
      phase: lane.phase,
      lane: { name: lane.member.displayName, phase: lane.phase, phaseLabel: lane.phaseLabel },
    };
    return;
  }
  editing.value = {
    title: place.title,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    category: 'sight',
    date: asBackup ? day : defaultDate(),
    isBackup: asBackup,
  };
}

/* ---- 編輯 / 儲存地點 ---- */
const dayStopsOf = (date) => stops.value.filter((s) => s.date === date && isShared(s));
// 某天最後面的 sortOrder（排入時加在最後）
const endOfDay = (date, exceptId) => Math.max(0, ...stops.value.filter((s) => s.date === date && s.id !== exceptId).map((s) => s.sortOrder)) + 1;

function editStop(s, focus) {
  editing.value = { ...s, focus, lane: laneInfo(s) };
}

async function saveStop(form) {
  const original = form.id ? stops.value.find((s) => s.id === form.id) : null;
  const payload = {
    title: form.title,
    category: form.category,
    customCategoryId: form.customCategoryId,
    isBackup: form.isBackup,
    memberId: form.memberId || null,
    phase: form.memberId ? form.phase : null,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    address: form.address,
    cost: form.cost,
    arriveCost: form.arriveCost,
    notes: form.notes,
    lat: form.lat,
    lng: form.lng,
  };
  // 依時間排序；換到別天且沒有時間時放到該天最後
  const dateChanged = !original || original.date !== form.date || !!original.isBackup !== !!form.isBackup;
  const timeChanged = !original || original.startTime !== form.startTime;
  if (form.date && !form.isBackup && !form.memberId && form.startTime && (dateChanged || timeChanged)) {
    payload.sortOrder = sortOrderForTime(dayStopsOf(form.date), { id: form.id ?? -1, sortOrder: Infinity }, form.startTime);
  } else if (dateChanged) {
    payload.sortOrder = endOfDay(form.date, form.id);
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
    if (!form.id) {
      const msg = stop.memberId ? `已加入${laneInfo(stop).name}的${laneInfo(stop).phaseLabel}路線` : stop.isBackup || !stop.date ? `已將「${stop.title}」放到備選` : `已將「${stop.title}」加入行程`;
      ui.toast(msg, 'success');
    }
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

// 拖曳排序 / 換天 / 拖進或拖出備選
function onDragChange(e, g) {
  const evt = e.added || e.moved;
  if (!evt) return;
  const s = evt.element;
  const list = g.stops.filter((x) => x.id !== s.id);
  const sortOrder = sortOrderAt(list, evt.newIndex);
  if (g.date) patchStop(s, { date: g.date, isBackup: false, sortOrder });
  // 備選清單：拖進來變成未定日期；在「全部備選」裡調整順序時保留原本的日期
  else patchStop(s, e.added ? { date: null, isBackup: false, sortOrder } : { sortOrder });
}
function onBackupDragChange(e, g) {
  const evt = e.added || e.moved;
  if (!evt) return;
  const s = evt.element;
  const list = g.backups.filter((x) => x.id !== s.id);
  patchStop(s, { date: g.date, isBackup: true, sortOrder: sortOrderAt(list, evt.newIndex) });
}

/* ---- 備選 ---- */
const backupTarget = ref(null);

function moveToBackup(s) {
  patchStop(s, { isBackup: true });
  ui.toast(`「${s.title}」已移到${dayTitle(s.date)}的備選`, 'success');
}

function scheduleBackup(s, date) {
  patchStop(s, { date, isBackup: false, sortOrder: endOfDay(date, s.id) });
}

// 用備選取代原本的地點：接手它的位置、時間與交通方式，原本的地點移到這天的備選
async function replaceWithBackup(b) {
  const t = backupTarget.value;
  backupTarget.value = null;
  const ok = await bulkUpdate([
    {
      id: b.id,
      date: t.date,
      isBackup: false,
      sortOrder: t.sortOrder,
      startTime: t.startTime || null,
      endTime: t.endTime || null,
      arriveMode: t.arriveMode || null,
      arriveCost: null,
    },
    { id: t.id, isBackup: true },
  ]);
  if (ok) {
    ui.toast(`已換成「${b.title}」，「${t.title}」移到備選`, 'success');
    focusStop(b);
  }
}

async function insertBackupAfter(b) {
  const t = backupTarget.value;
  backupTarget.value = null;
  const list = dayStopsOf(t.date).sort(byStopOrder);
  const sortOrder = sortOrderAt(list, list.findIndex((x) => x.id === t.id) + 1);
  if (await bulkUpdate([{ id: b.id, date: t.date, isBackup: false, sortOrder }])) {
    ui.toast(`已將「${b.title}」加在「${t.title}」後面`, 'success');
    focusStop(b);
  }
}

/* ---- 自動排時間 / 最佳順序 ---- */
const scheduleDate = ref(null);
const optimizeDate = ref(null);
const bulkSaving = ref(false);
const scheduleGroup = computed(() => (scheduleDate.value ? groups.value.find((g) => g.date === scheduleDate.value) : null));
const optimizeGroup = computed(() => (optimizeDate.value ? groups.value.find((g) => g.date === optimizeDate.value) : null));

// 先更新畫面，再一次送出；失敗時還原
async function bulkUpdate(updates) {
  const backup = stops.value.map((s) => ({ ...s }));
  for (const u of updates) {
    const s = stops.value.find((x) => x.id === u.id);
    if (s) upsertStop({ ...s, ...u });
  }
  bulkSaving.value = true;
  try {
    (await api.patch(`/trips/${tripId}/stops`, { updates })).forEach(upsertStop);
    return true;
  } catch (e) {
    stops.value = backup;
    ui.error(e);
    return false;
  } finally {
    bulkSaving.value = false;
  }
}

async function applySchedule(updates) {
  scheduleDate.value = null;
  if (await bulkUpdate(updates)) ui.toast(`已更新 ${updates.length} 個地點的時間`, 'success');
}

async function applyOrder(updates, { reschedule }) {
  const date = optimizeDate.value;
  optimizeDate.value = null;
  if (!(await bulkUpdate(updates))) return;
  ui.toast('已改為最佳順序', 'success');
  if (reschedule) scheduleDate.value = date; // 順序變了，時間也要重算
}

/* ---- 預算 ---- */
async function saveBudget(value) {
  const old = trip.value.budget;
  trip.value.budget = value;
  try {
    await api.put(`/trips/${tripId}`, { budget: value });
  } catch (e) {
    trip.value.budget = old;
    ui.error(e);
  }
}

function editFromBudget(id, fare) {
  const s = stops.value.find((x) => x.id === id);
  if (!s) return;
  budgetOpen.value = false;
  editStop(s, fare ? 'arriveCost' : undefined);
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
  const ok = await ui.confirm({ title: '移除成員', message: `確定要將 ${m.displayName} 從行程中移除嗎？\n他的各自出發 / 回程路線也會一併刪除。`, okText: '移除' });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}/members/${m.id}`);
    members.value = members.value.filter((x) => x.id !== m.id);
    stops.value = stops.value.filter((x) => x.memberId !== m.id);
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
