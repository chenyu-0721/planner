<template>
  <div v-if="error" class="flex-1 flex flex-col items-center justify-center text-center p-8">
    <Icon name="lock" :size="44" class="text-ink-4 mb-3" :stroke="1.3" />
    <div class="text-lg font-semibold mb-1">無法開啟此行程</div>
    <p class="text-sm text-ink-3 mb-4">{{ error }}</p>
    <router-link to="/trips" class="btn btn-primary">回到我的行程</router-link>
  </div>

  <div v-else-if="!trip" class="flex-1 flex items-center justify-center text-ink-3">載入中…</div>

  <div v-else ref="rootEl" class="flex-1 min-h-0 relative overflow-hidden flex">
    <!-- ===== 行程面板：電腦是左側欄，手機是可以上下拉的底部抽屜 ===== -->
    <aside
      class="flex flex-col bg-white min-h-0"
      :class="ui.isMobile
        ? ['absolute inset-x-0 bottom-0 z-30 rounded-t-2xl shadow-[0_-4px_18px_rgba(0,0,0,.16)]', sheetDragging ? '' : 'transition-[height] duration-200 ease-out']
        : 'relative z-10 w-[400px] lg:w-[440px] shrink-0 border-r border-line'"
      :style="ui.isMobile ? { height: `${sheetHeight}px` } : null"
    >
      <!-- 抽屜把手（手機）：拖曳或點一下切換高度 -->
      <div v-if="ui.isMobile" class="shrink-0 touch-none" @pointerdown="onGripDown">
        <div class="pt-2 pb-1 flex justify-center"><span class="w-10 h-1.5 rounded-full bg-line-2"></span></div>
      </div>

      <!-- 行程標頭 -->
      <header class="shrink-0 px-4 pt-2 md:pt-4 pb-2 flex items-start gap-3" :class="ui.isMobile ? 'touch-none' : ''" @pointerdown="ui.isMobile && onGripDown($event)">
        <TripIcon :color="trip.color" :size="ui.isMobile ? 34 : 40" class="shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1 min-w-0">
            <h1 class="text-base md:text-lg font-semibold truncate leading-6">{{ trip.name }}</h1>
          </div>
          <div class="text-xs text-ink-3 flex flex-wrap gap-x-2 leading-5">
            <span>{{ fmtTripRange(trip) }}</span>
            <span v-if="countdown" class="text-accent font-semibold">{{ countdown }}</span>
          </div>
        </div>
        <Popover placement="bottom-end">
          <template #trigger>
            <button class="flex items-center h-8 px-1 rounded hover:bg-hover cursor-pointer shrink-0" title="成員" @pointerdown.stop>
              <div class="flex -space-x-1.5">
                <Avatar v-for="m in members.slice(0, 3)" :key="m.id" :user="m" :size="26" ring />
              </div>
              <span v-if="members.length > 3" class="ml-1 text-xs text-ink-3">+{{ members.length - 3 }}</span>
            </button>
          </template>
          <div class="w-[min(20rem,calc(100vw-2rem))]">
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
        <Popover close-on-click placement="bottom-end">
          <template #trigger>
            <button class="icon-btn shrink-0" title="更多選項" @pointerdown.stop><Icon name="more" :size="18" /></button>
          </template>
          <button class="menu-item" @click="settingsOpen = true"><Icon name="settings" />行程設定（日期、幣別）</button>
          <button class="menu-item" @click="budgetOpen = true"><Icon name="wallet" />預算與花費</button>
          <button class="menu-item" @click="fitMap"><Icon name="fit" />地圖顯示全部地點</button>
          <div class="border-t border-line my-1"></div>
          <button v-if="trip.isMember && trip.ownerId !== auth.user?.id" class="menu-item" @click="leave"><Icon name="door" />離開行程</button>
          <button v-if="trip.canManage" class="menu-item !text-[#c50f1f]" @click="removeTrip"><Icon name="trash" />刪除行程</button>
        </Popover>
      </header>

      <!-- 花費摘要 -->
      <button
        type="button"
        class="shrink-0 mx-4 mb-2 flex items-center gap-2 rounded-lg bg-[#f5f5f5] hover:bg-hover px-3 h-9 text-xs cursor-pointer"
        title="預算與花費統計"
        @pointerdown.stop
        @click="budgetOpen = true"
      >
        <Icon name="wallet" :size="14" class="text-ink-3 shrink-0" />
        <span class="text-ink-2">預估花費</span>
        <span class="font-semibold tabular-nums" :class="overBudget ? 'text-[#c50f1f]' : ''">{{ fmtCost(totalCost) }}</span>
        <span v-if="trip.budget" class="text-ink-3 tabular-nums">／預算 {{ fmtCost(trip.budget) }}</span>
        <span v-if="trip.budget" class="flex-1 h-1.5 rounded-full bg-white overflow-hidden min-w-8">
          <span class="block h-full rounded-full" :class="overBudget ? 'bg-[#c50f1f]' : 'bg-[#107c10]'" :style="{ width: `${Math.min(100, (totalCost / trip.budget) * 100)}%` }"></span>
        </span>
        <span v-else class="flex-1"></span>
        <span v-if="members.length > 1 && totalCost" class="text-ink-3 shrink-0">每人約 {{ fmtCost(Math.round(totalCost / members.length)) }}</span>
      </button>

      <!-- 分頁 -->
      <nav class="shrink-0 flex px-2 border-b border-line" @pointerdown.stop>
        <button
          v-for="t in tabs"
          :key="t.key"
          class="flex-1 h-10 flex items-center justify-center gap-1 text-[13px] border-b-[3px] cursor-pointer whitespace-nowrap"
          :class="tab === t.key ? 'border-brand font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'"
          @click="setTab(t.key)"
        >
          {{ t.label }}<span v-if="t.badge" class="text-[11px] px-1.5 rounded-full" :class="tab === t.key ? 'bg-accent-light text-accent' : 'bg-hover'">{{ t.badge }}</span>
        </button>
      </nav>

      <div ref="scrollEl" class="flex-1 min-h-0 overflow-y-auto thin-scroll bg-[#f7f7f7] overscroll-contain">
        <!-- ===== 行程 ===== -->
        <template v-if="tab === 'plan'">
          <div class="sticky top-0 z-10 bg-white border-b border-line">
            <div class="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
              <button class="chip" :class="selectedDate === null ? 'chip-on' : ''" @click="selectDate(null)">總覽</button>
              <button v-for="d in days" :key="d.date" class="chip" :class="selectedDate === d.date ? 'chip-on' : ''" @click="selectDate(d.date)">
                <span class="size-2 rounded-full" :style="{ background: d.color }"></span>{{ d.title }}
                <span class="font-normal opacity-70">{{ d.subtitle.replace(/（.*）/, '') }}</span>
                <span v-if="dayWeather({ date: d.date })" class="leading-none">{{ weatherInfo(dayWeather({ date: d.date }).code).emoji }}</span>
              </button>
            </div>
          </div>

          <div class="p-3 space-y-5">
            <!-- 預設交通方式 -->
            <div class="flex items-center gap-2 text-xs text-ink-3 whitespace-nowrap" title="兩個地點中間的卡片可以改單一路段的交通方式（例如高鐵、飛機）">
              <span>預設交通</span>
              <Popover close-on-click>
                <template #trigger>
                  <button class="h-7 px-2.5 rounded-full border border-line-2 bg-white text-ink flex items-center gap-1 cursor-pointer hover:bg-hover">
                    {{ travelModeInfo(trip.travelMode).emoji }} {{ travelModeInfo(trip.travelMode).label }}<Icon name="chevron-down" :size="12" />
                  </button>
                </template>
                <button v-for="m in DEFAULT_TRAVEL_MODES" :key="m.key" class="menu-item" @click="setTravelMode(m.key)">
                  <span class="w-4"><Icon v-if="trip.travelMode === m.key" name="check" :size="14" class="text-accent" /></span>{{ m.emoji }} {{ m.label }}
                </button>
              </Popover>
              <span class="truncate text-ink-4">點兩地中間的卡片可改單一路段</span>
            </div>

            <div v-if="!stops.length" class="rounded-xl border border-dashed border-line-2 bg-white px-4 py-6 text-center">
              <div class="text-2xl mb-1">🗺️</div>
              <div class="text-sm font-semibold mb-1">開始安排行程</div>
              <p class="text-xs leading-5 text-ink-3">在地圖上方搜尋地點（全世界都可以），<br />或直接點地圖上的店家、長按地圖任意位置加入。</p>
              <button class="btn btn-primary !rounded-full mt-3" @click="focusSearch"><Icon name="search" :size="15" />搜尋地點</button>
            </div>

            <section v-for="g in visibleGroups" :key="g.key">
              <header class="flex items-center gap-2 mb-1">
                <span class="w-1 h-5 rounded" :style="{ background: g.color }"></span>
                <h3 class="font-semibold text-sm whitespace-nowrap shrink-0">{{ g.title }}</h3>
                <span class="text-xs text-ink-3 truncate min-w-0">{{ g.subtitle }}</span>
                <div class="flex-1"></div>
                <span v-if="g.cost" class="text-xs text-ink-3 whitespace-nowrap shrink-0">{{ fmtCost(g.cost) }}</span>
                <a
                  v-if="g.stops.length"
                  :href="googleDirectionsUrl(g.stops, trip.travelMode)"
                  target="_blank"
                  rel="noopener"
                  class="icon-btn !size-7"
                  :title="g.stops.length > 1 ? '用 Google 地圖導航這天的路線' : '在 Google 地圖查看'"
                  @click.stop
                >
                  <Icon name="external" :size="14" />
                </a>
                <Popover close-on-click placement="bottom-end">
                  <template #trigger>
                    <button class="icon-btn !size-7" title="自動排時間、最佳順序、各自出發 / 回程"><Icon name="more" :size="15" /></button>
                  </template>
                  <button class="menu-item" :class="g.stops.length < 2 ? 'opacity-50 pointer-events-none' : ''" @click="scheduleDate = g.date"><Icon name="clock" />自動排時間</button>
                  <button class="menu-item" :class="g.stops.length < 3 ? 'opacity-50 pointer-events-none' : ''" @click="optimizeDate = g.date">
                    <Icon name="route" />最佳順序<span v-if="g.stops.length < 3" class="ml-auto text-xs text-ink-4">需 3 個地點</span>
                  </button>
                  <template v-if="members.length > 1">
                    <div class="border-t border-line my-1"></div>
                    <button class="menu-item" @click="openLanes(g.date, 'depart')"><Icon name="users" />各自出發（從不同地方出發）</button>
                    <button class="menu-item" @click="openLanes(g.date, 'return')"><Icon name="users" />各自回程（散場各自回家）</button>
                  </template>
                  <div class="border-t border-line my-1"></div>
                  <button class="menu-item" @click="newBooking('flight', g.date)"><span class="w-4">🎫</span>新增這天的預訂</button>
                </Popover>
              </header>

              <!-- 天氣、時差、距離 -->
              <div class="mb-2 pl-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
                <span v-if="dayWeather(g)" class="flex items-center gap-1 text-ink-2" :title="`天氣預報（${dayWeather(g).place}附近，Open-Meteo）`">
                  <span class="text-sm leading-none">{{ weatherInfo(dayWeather(g).code).emoji }}</span>
                  {{ weatherInfo(dayWeather(g).code).label }}
                  <span class="tabular-nums">{{ fmtTemp(dayWeather(g).min) }}–{{ fmtTemp(dayWeather(g).max) }}</span>
                  <span v-if="dayWeather(g).rain != null" class="tabular-nums" :class="dayWeather(g).rain >= 50 ? 'text-accent font-semibold' : ''">☔ {{ dayWeather(g).rain }}%</span>
                </span>
                <span v-else-if="g.date > weatherWindow.to" class="text-[11px] text-ink-4">出發前 {{ FORECAST_DAYS }} 天內會顯示天氣</span>
                <span v-if="dayOffset(g)" class="text-[11px]">🕐 {{ dayOffset(g) }}</span>
                <span v-if="g.distance" class="flex items-center gap-1 whitespace-nowrap">
                  <Icon name="route" :size="12" />{{ fmtDistance(g.distance) }}<template v-if="g.duration">・{{ g.legs?.some((l) => l.estimated) ? '約 ' : '' }}{{ fmtDuration(g.duration) }}</template>
                </span>
              </div>

              <!-- 這天的預訂（機票、住宿…） -->
              <div v-if="g.bookings.length" class="mb-2 space-y-1">
                <button
                  v-for="row in g.bookings"
                  :key="`${row.booking.id}-${row.role}`"
                  type="button"
                  class="w-full flex items-center gap-2 rounded-lg bg-[#eef4fb] hover:bg-[#e2ecf8] px-2.5 py-1.5 text-left cursor-pointer"
                  @click="bookingEditing = row.booking"
                >
                  <span class="text-sm shrink-0">{{ bookingKind(row.booking.kind).emoji }}</span>
                  <span class="text-xs font-semibold tabular-nums shrink-0 text-accent">{{ bookingRowTime(row) }}</span>
                  <span class="text-xs truncate min-w-0 flex-1">
                    <span class="font-semibold">{{ row.booking.title }}</span>
                    <span class="text-ink-3">{{ bookingRowSub(row) }}</span>
                  </span>
                  <span v-if="row.booking.reference" class="text-[11px] font-mono text-ink-3 shrink-0">{{ row.booking.reference }}</span>
                </button>
              </div>

              <DayLanes
                v-if="g.departLanes.length || laneOpen[`${g.date}|depart`]"
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
                      :label="index + 1"
                      :color="g.color"
                      :focused="focusStopId === s.id"
                      :weather="stopWeather(s)"
                      @focus="openStopCard(s)"
                      @edit="editStop(s)"
                    >
                      <template #menu>
                        <button class="menu-item" @click="editStop(s)"><Icon name="pencil" />編輯</button>
                        <button class="menu-item" @click="backupTarget = s"><Icon name="move" />沒開？換成備選…</button>
                        <button class="menu-item" @click="moveToBackup(s)"><Icon name="tag" />移到這天的備選</button>
                        <div class="border-t border-line my-1"></div>
                        <button class="menu-item !text-[#c50f1f]" @click="deleteStop(s)"><Icon name="trash" />刪除</button>
                      </template>
                    </StopCard>
                    <SegmentCard
                      v-if="index < g.stops.length - 1"
                      :seg="seg(g, index)"
                      :mode="g.stops[index + 1].arriveMode || null"
                      :default-label="travelModeInfo(trip.travelMode).label"
                      :caption="`這一段前往「${g.stops[index + 1].title}」`"
                      :fare="g.stops[index + 1].arriveCost ?? null"
                      :fare-currency="g.stops[index + 1].currency"
                      :rail-url="googleSegmentUrl(s, g.stops[index + 1], seg(g, index).info.key)"
                      :color="g.color"
                      @mode="(m) => setArriveMode(g.stops[index + 1], m)"
                      @fare="editStop(g.stops[index + 1], 'arriveCost')"
                    />
                  </div>
                </template>
              </draggable>
              <div v-if="!g.stops.length" class="text-xs text-ink-4 px-1 -mt-8 mb-2 h-8 flex items-center pointer-events-none">
                搜尋或點地圖加入地點，也可以從其他天拖曳過來
              </div>

              <DayLanes
                v-if="g.returnLanes.length || laneOpen[`${g.date}|return`]"
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
              <div v-if="g.backups.length" class="mt-2 rounded-xl border border-dashed border-line-2 bg-white/60 px-2 pb-1.5">
                <button type="button" class="w-full flex items-center gap-1 h-8 px-1 text-xs text-ink-3 hover:text-ink cursor-pointer" @click="collapsedBackups[g.date] = !collapsedBackups[g.date]">
                  <Icon name="chevron-down" :size="12" class="transition-transform" :class="collapsedBackups[g.date] ? '-rotate-90' : ''" />
                  🔖 這天的備選（{{ g.backups.length }}）
                  <span class="ml-auto text-[11px] text-ink-4">臨時沒開時可以換</span>
                </button>
                <draggable
                  v-show="!collapsedBackups[g.date]"
                  :model-value="g.backups"
                  item-key="id"
                  group="stops"
                  class="space-y-1 min-h-6"
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
                      <StopCard :stop="s" label="備" :color="g.color" backup :focused="focusStopId === s.id" @focus="openStopCard(s)" @edit="editStop(s)">
                        <template #action>
                          <button class="no-drag shrink-0 self-center h-7 px-2.5 rounded-full bg-accent-light text-xs font-semibold text-accent hover:bg-accent hover:text-white cursor-pointer" title="排入這天的行程（加在最後）" @click.stop="scheduleBackup(s, g.date)">排入</button>
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

            <button v-if="undatedBackups.length" type="button" class="w-full rounded-xl border border-dashed border-line-2 bg-white px-3 py-2.5 text-left text-xs text-ink-3 hover:bg-hover cursor-pointer" @click="setTab('backup')">
              🔖 還有 {{ undatedBackups.length }} 個未定日期的備選 →
            </button>
          </div>
        </template>

        <!-- ===== 備選 ===== -->
        <BackupPanel
          v-else-if="tab === 'backup'"
          v-model:filter="backupFilter"
          :backups="allBackups"
          :stops="stops"
          :days="days"
          :focus-stop-id="focusStopId"
          @focus="openStopCard"
          @edit="editStop"
          @schedule="scheduleBackup"
          @set-day="(s, date) => patchStop(s, { date, isBackup: !!date })"
          @delete="deleteStop"
        />

        <!-- ===== 預訂 ===== -->
        <BookingsPanel v-else-if="tab === 'bookings'" :bookings="bookings" :days="days" @add="(kind) => newBooking(kind)" @edit="(b) => (bookingEditing = b)" />

        <!-- ===== 準備 ===== -->
        <ChecklistPanel
          v-else
          :items="checklist"
          :members="members"
          :start-date="trip.startDate"
          @add="addChecklist"
          @update="updateChecklist"
          @delete="deleteChecklist"
        />
        <div v-if="ui.isMobile" class="h-[env(safe-area-inset-bottom)]"></div>
      </div>
    </aside>

    <!-- ===== 地圖 ===== -->
    <div class="min-w-0" :class="ui.isMobile ? 'absolute inset-0' : 'relative flex-1'">
      <TripMap
        ref="mapRef"
        :days="days"
        :stops="stops"
        :routes="routes"
        :lanes="mapLanes"
        :routing="routing"
        :selected-date="mapDate"
        :focus-stop-id="focusStopId"
        :preview="preview"
        :insets="mapInsets"
        :card-pad="cardPad"
        @select="openStopCard"
        @move="onMarkerMove"
        @place="onMapPlace"
        @blank="closeCard"
      />

      <!-- 搜尋列 -->
      <div class="absolute z-20 top-3 left-3 right-3 md:right-auto md:w-[min(400px,calc(100%-180px))] space-y-2">
        <PlaceSearch ref="searchRef" :center="searchCenter" :placeholder="laneTarget ? `搜尋${laneTarget.member.displayName}的${laneTarget.phaseLabel}地點` : undefined" @pick="previewPlace" />
        <div v-if="laneTarget" class="flex items-center gap-2 rounded-xl bg-white card-shadow-hover text-xs px-3 py-2">
          <Avatar :user="laneTarget.member" :size="22" />
          <span class="flex-1 min-w-0 leading-4">正在加入 <b>{{ laneTarget.member.displayName }}</b> 的{{ laneTarget.phaseLabel }}地點：搜尋、點地圖上的店家或長按地圖</span>
          <button class="shrink-0 text-accent hover:underline cursor-pointer" @click="laneTarget = null">取消</button>
        </div>
      </div>

      <!-- 地點卡片（電腦：地圖左下） -->
      <div v-if="!ui.isMobile && (preview || cardStop)" class="absolute z-20 left-3 bottom-8 w-[min(400px,calc(100%-80px))]">
        <PlaceCard v-bind="cardProps" v-on="cardEvents" />
      </div>
    </div>

    <!-- 地點卡片（手機：蓋在抽屜上面） -->
    <Transition name="sheet-up">
      <div v-if="ui.isMobile && (preview || cardStop)" class="absolute z-40 inset-x-0 bottom-0 px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <PlaceCard v-bind="cardProps" sheet-handle v-on="cardEvents" />
      </div>
    </Transition>

    <StopEditor v-model="editing" :days="days" :saving="saving" @save="saveStop" @delete="deleteStop" />
    <BookingEditor v-model="bookingEditing" :saving="saving" @save="saveBooking" @delete="deleteBooking" />
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
      :bookings="bookings"
      @save-budget="saveBudget"
      @edit="editFromBudget"
      @edit-booking="(id) => { budgetOpen = false; bookingEditing = bookings.find((b) => b.id === id) || null; }"
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
  </div>
</template>

<script setup>
import {
  computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import TripIcon from '@/components/trip/TripIcon.vue';
import TripMap from '@/components/trip/TripMap.vue';
import PlaceSearch from '@/components/trip/PlaceSearch.vue';
import PlaceCard from '@/components/trip/PlaceCard.vue';
import StopEditor from '@/components/trip/StopEditor.vue';
import TripFormDialog from '@/components/trip/TripFormDialog.vue';
import BudgetDialog from '@/components/trip/BudgetDialog.vue';
import StopCard from '@/components/trip/StopCard.vue';
import SegmentCard from '@/components/trip/SegmentCard.vue';
import DayLanes from '@/components/trip/DayLanes.vue';
import BackupPanel from '@/components/trip/BackupPanel.vue';
import BookingsPanel from '@/components/trip/BookingsPanel.vue';
import BookingEditor from '@/components/trip/BookingEditor.vue';
import ChecklistPanel from '@/components/trip/ChecklistPanel.vue';
import BackupPickerDialog from '@/components/trip/BackupPickerDialog.vue';
import AutoScheduleDialog from '@/components/trip/AutoScheduleDialog.vue';
import OptimizeOrderDialog from '@/components/trip/OptimizeOrderDialog.vue';
import api, { writes } from '@/api';
import { sortOrderAt, diffDays } from '@/utils/planner';
import {
  tripDays, fmtTripRange, setCustomCategories, distanceKm, fmtDistance, fmtCost, byStopOrder,
  sortOrderForTime, stopTotal, isBackup, isPlanned, isShared, tripMoney, toTripMoney, reversePlace,
  segmentInfo, groupLanes, laneSequence, laneTimes, LANE_PHASES,
  DEFAULT_TRAVEL_MODES, travelModeInfo, planDayRoute, upgradeRailLegs, fmtDuration, googleDirectionsUrl, googleSegmentUrl,
} from '@/utils/trip';
import {
  fetchWeather, weatherKey, weatherInfo, weatherRange, hourlyAt, fmtTemp, offsetText, todayInTaiwan, FORECAST_DAYS,
} from '@/utils/weather';
import { loadRates } from '@/utils/currency';
import { bookingKind, bookingsOnDay, fmtBookingTime } from '@/utils/tripPrep';
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
const bookings = ref([]);
const checklist = ref([]);
const error = ref('');

const selectedDate = ref(null);
const focusStopId = ref(null);
const editing = ref(null);
const saving = ref(false);
const settingsOpen = ref(false);
const mapRef = ref(null);
const searchRef = ref(null);
const scrollEl = ref(null);
const memberKeyword = ref('');
const routes = ref({}); // { [date]: { lines, legs, ids } }
const routing = ref(false);

/* ---- 分頁 ---- */
const tab = ref('plan');
const backupFilter = ref('all');
const days = computed(() => tripDays(trip.value));
const allBackups = computed(() => stops.value.filter(isBackup).sort((a, b) => (a.date || '').localeCompare(b.date || '') || byStopOrder(a, b)));
const undatedBackups = computed(() => allBackups.value.filter((s) => !s.date));
const tabs = computed(() => [
  { key: 'plan', label: '行程' },
  { key: 'backup', label: '🔖 備選', badge: allBackups.value.length || '' },
  { key: 'bookings', label: '🎫 預訂', badge: bookings.value.length || '' },
  { key: 'prep', label: '✅ 準備', badge: checklist.value.length ? `${checklist.value.filter((x) => x.done).length}/${checklist.value.length}` : '' },
]);
function setTab(key) {
  tab.value = key;
  if (key === 'backup' && selectedDate.value) backupFilter.value = selectedDate.value;
  if (ui.isMobile && sheetSnap.value === 0) sheetSnap.value = 1;
  scrollEl.value?.scrollTo({ top: 0 });
}
function selectDate(date) {
  selectedDate.value = date;
  scrollEl.value?.scrollTo({ top: 0 });
}
// 地圖顯示哪一天：備選分頁跟著備選的篩選
const mapDate = computed(() => {
  if (tab.value !== 'backup') return selectedDate.value;
  return backupFilter.value === 'all' || backupFilter.value === 'undated' ? 'unscheduled' : backupFilter.value;
});

const collapsedBackups = reactive({});
const dayTitle = (date) => days.value.find((d) => d.date === date)?.title || date;
const bookingCost = computed(() => bookings.value.reduce((sum, b) => sum + toTripMoney(b.cost, b.currency), 0));
const totalCost = computed(() => stops.value.filter(isPlanned).reduce((sum, s) => sum + stopTotal(s), 0) + bookingCost.value); // 備選不計入
const overBudget = computed(() => !!trip.value?.budget && totalCost.value > trip.value.budget);
const budgetOpen = ref(false);
const countdown = computed(() => {
  if (!trip.value) return '';
  const today = todayInTaiwan();
  const n = diffDays(trip.value.startDate, today);
  if (n > 0) return `${n} 天後出發`;
  if (today <= trip.value.endDate) return '旅行中';
  return '';
});

/* ---- 手機底部抽屜 ---- */
const rootEl = ref(null);
const rootHeight = ref(640);
const sheetSnap = ref(1); // 0 = 只露出標題、1 = 一半、2 = 全螢幕
const sheetDrag = ref(null);
const sheetDragging = computed(() => sheetDrag.value != null);
const PEEK = 150;
const snaps = computed(() => [PEEK, Math.round(rootHeight.value * 0.52), rootHeight.value - 8]);
const sheetHeight = computed(() => sheetDrag.value ?? snaps.value[sheetSnap.value]);
let rootObserver = null;

function onGripDown(e) {
  if (!ui.isMobile || e.button > 0) return;
  if (e.target.closest('button, a, input, select, textarea')) return; // 標頭上的按鈕照常點
  const y0 = e.clientY;
  const h0 = sheetHeight.value;
  let last = { y: y0, t: performance.now() };
  let velocity = 0;
  let moved = false;
  const onMove = (ev) => {
    const dy = ev.clientY - y0;
    if (Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const now = performance.now();
    velocity = (ev.clientY - last.y) / Math.max(1, now - last.t);
    last = { y: ev.clientY, t: now };
    sheetDrag.value = Math.min(snaps.value[2], Math.max(PEEK - 30, h0 - dy));
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (!moved) {
      sheetSnap.value = sheetSnap.value === 0 ? 1 : sheetSnap.value === 1 ? 2 : 1;
      return;
    }
    const h = sheetDrag.value;
    // 快速滑動：往滑的方向切一格；慢慢拖：停在最近的高度
    let next;
    const list = snaps.value;
    if (velocity > 0.5) next = Math.max(0, list.findLastIndex((v) => v < h)); // 往下甩：下一個比現在低的高度
    else if (velocity < -0.5) next = list.findIndex((v) => v > h); // 往上甩：下一個比現在高的高度
    if (next === -1) next = 2;
    if (next == null) next = list.reduce((best, v, i) => (Math.abs(v - h) < Math.abs(list[best] - h) ? i : best), 0);
    sheetSnap.value = next;
    sheetDrag.value = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

// 地圖被蓋住的範圍：讓「顯示全部」與聚焦時避開搜尋列和抽屜
const mapInsets = computed(() => (ui.isMobile
  ? { top: laneTarget.value ? 116 : 64, bottom: Math.min(sheetHeight.value, snaps.value[1]), left: 0 }
  : { top: laneTarget.value ? 110 : 60, bottom: 0, left: 0 }));
// 地點卡片蓋住的高度（電腦在地圖左下、手機比抽屜高一些）：聚焦時往上避開
const cardPad = computed(() => (preview.value || cardStopId.value ? (ui.isMobile ? 90 : 220) : 0));

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
    const saved = laneRoutes.value[l.key]?.sig === sig ? laneRoutes.value[l.key] : null;
    return {
      ...l, member: memberOf(l.memberId), meeting, hasMeeting: !!meeting, seq, sig, legs: saved?.legs, lines: saved?.lines, times: laneTimes(phase, seq, saved?.legs, meeting),
    };
  });
}

const groups = computed(() => days.value.map((d) => {
  const dayStops = stops.value.filter((s) => s.date === d.date && isShared(s)).sort(byStopOrder);
  // 路線是依哪個順序算的；順序剛改、還沒重算完時先不用舊的路段
  const saved = routes.value[d.date];
  const dayRoute = saved?.ids === dayStops.map((s) => s.id).join(',') ? saved : null;
  const straight = dayStops.slice(1).reduce((sum, s, i) => sum + distanceKm(dayStops[i], s), 0);
  return {
    key: d.date,
    date: d.date,
    title: d.title,
    subtitle: d.subtitle,
    color: d.color,
    stops: dayStops,
    backups: stops.value.filter((s) => s.date === d.date && s.isBackup).sort(byStopOrder),
    bookings: bookingsOnDay(bookings.value, d.date),
    departLanes: lanesFor(d.date, 'depart', dayStops),
    returnLanes: lanesFor(d.date, 'return', dayStops),
    cost: dayStops.reduce((sum, s) => sum + stopTotal(s), 0),
    legs: dayRoute?.legs,
    distance: dayRoute ? dayRoute.legs.reduce((sum, l) => sum + l.distance, 0) : straight,
    duration: dayRoute ? dayRoute.legs.reduce((sum, l) => sum + (l.duration || 0), 0) : 0,
  };
}));
const visibleGroups = computed(() => (selectedDate.value ? groups.value.filter((g) => g.date === selectedDate.value) : groups.value));

const memberCandidates = computed(() => {
  const kw = memberKeyword.value.trim().toLowerCase();
  const ids = new Set(members.value.map((m) => m.id));
  return plans.users.filter((u) => !ids.has(u.id) && (u.displayName.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw)));
});

function applyTripData(data) {
  trip.value = data.trip;
  members.value = data.members;
  stops.value = data.stops;
  bookings.value = data.bookings || [];
  checklist.value = data.checklist || [];
  setCustomCategories(data.categories || []);
}

async function load() {
  try {
    applyTripData(await api.get(`/trips/${tripId}`));
    version = null;
  } catch (e) {
    error.value = e.message;
  }
}

// 行程幣別：金額顯示與換算都用它
watch(() => trip.value?.currency, (c) => {
  tripMoney.currency = c || 'TWD';
  loadRates(tripMoney.currency);
}, { immediate: true });

/* ---- 自動同步：其他成員的變更不用重新整理就會出現 ----
 * 每 10 秒查一次版本碼（只有幾個彙總數字），變了才重新載入完整資料；分頁在背景時暫停，切回來立刻檢查。
 * 自己正在儲存時先不套用，避免畫面閃回舊資料。
 */
const SYNC_MS = 10000;
let version = null;
let syncTimer = null;
let syncing = false;
async function syncNow() {
  if (syncing || document.hidden || !trip.value || error.value) return;
  syncing = true;
  try {
    const { v } = await api.get(`/trips/${tripId}/version`);
    if (version === null) {
      version = v;
      return;
    }
    if (v === version || writes.pending) return;
    const data = await api.get(`/trips/${tripId}`);
    if (writes.pending) return; // 等自己的儲存完成後下次再同步
    applyTripData(data);
    // 距離自己上次修改超過 15 秒，才可能是其他成員的變更
    if (Date.now() - writes.lastAt > 15000) ui.toast('行程已更新（其他成員的變更）', 'info');
    version = v;
  } catch (e) {
    if (e.status === 404 || e.status === 403) error.value = e.message; // 行程被刪除或被移出
  } finally {
    syncing = false;
  }
}
const onVisible = () => { if (!document.hidden) syncNow(); };
onMounted(() => {
  syncTimer = setInterval(syncNow, SYNC_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
});
onBeforeUnmount(() => {
  clearInterval(syncTimer);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
  rootObserver?.disconnect();
});
watch(rootEl, (el) => {
  rootObserver?.disconnect();
  if (!el) return;
  rootObserver = new ResizeObserver(() => { rootHeight.value = el.clientHeight; });
  rootObserver.observe(el);
  rootHeight.value = el.clientHeight;
});

const upsertStop = (s) => {
  const i = stops.value.findIndex((x) => x.id === s.id);
  if (i >= 0) stops.value[i] = s;
  else stops.value.push(s);
};

/* ---- 搜尋與地點卡片 ---- */
const preview = ref(null); // 還沒加入的地點
const cardStopId = ref(null); // 正在看的行程地點
const cardStop = computed(() => (cardStopId.value ? stops.value.find((s) => s.id === cardStopId.value) || null : null));
let reverseSeq = 0;

// 搜尋以地圖目前位置為中心；地圖還沒準備好時用行程地點的中心
function searchCenter() {
  const c = mapRef.value?.getCenter();
  if (c) return c;
  const located = stops.value.filter((s) => Number.isFinite(s.lat));
  return located.length ? { ...centerOf(located), zoom: 12 } : null;
}
function focusSearch() {
  if (ui.isMobile) sheetSnap.value = 0;
  searchRef.value?.focus();
}

function previewPlace(place) {
  cardStopId.value = null;
  preview.value = place;
  if (ui.isMobile) sheetSnap.value = 0;
}

async function onMapPlace(p) {
  const my = ++reverseSeq;
  if (!p.reverse) {
    // 地圖上的店家：名稱已知，背景補上地址
    previewPlace(p);
    if (p.address) return;
    const found = await reversePlace(p.lat, p.lng);
    if (my === reverseSeq && preview.value?.title === p.title && found.address && !/^-?\d/.test(found.address)) {
      preview.value = { ...preview.value, address: found.address };
    }
    return;
  }
  // 長按 / 右鍵：先放圖釘，再查這裡的地址
  previewPlace({ title: '地圖上的位置', address: '查詢地址中…', lat: p.lat, lng: p.lng });
  const found = await reversePlace(p.lat, p.lng);
  if (my === reverseSeq && preview.value) preview.value = { ...found, lat: p.lat, lng: p.lng };
}

function openStopCard(s) {
  preview.value = null;
  cardStopId.value = s.id;
  focusStop(s);
  if (ui.isMobile) sheetSnap.value = 0;
}
function closeCard() {
  preview.value = null;
  cardStopId.value = null;
}

const cardLabel = computed(() => {
  const s = cardStop.value;
  if (!s) return '';
  if (isBackup(s)) return '備';
  if (s.memberId) return memberOf(s.memberId).displayName.slice(0, 1);
  const i = groups.value.find((g) => g.date === s.date)?.stops.findIndex((x) => x.id === s.id);
  return i >= 0 ? i + 1 : '';
});
const cardColor = computed(() => {
  const s = cardStop.value;
  if (!s) return '#8a8886';
  if (s.memberId) return memberOf(s.memberId).color;
  return days.value.find((d) => d.date === s.date)?.color || '#8a8886';
});
const cardProps = computed(() => ({
  place: preview.value,
  stop: preview.value ? null : cardStop.value,
  days: days.value,
  stops: stops.value,
  defaultDate: selectedDate.value || days.value[0]?.date || null,
  lane: laneTarget.value,
  label: cardLabel.value,
  color: cardColor.value,
  saving: saving.value,
}));
const cardEvents = {
  close: closeCard,
  add: quickAdd,
  detail: openDetail,
  edit: (s) => editStop(s),
  schedule: (s, date) => {
    scheduleBackup(s, date);
    ui.toast(`已排入${dayTitle(date)}`, 'success');
  },
  backup: (s) => moveToBackup(s),
  replace: (s) => { backupTarget.value = s; },
  delete: (s) => deleteStop(s),
};

// 從卡片直接加入（不用開編輯視窗）
async function quickAdd({ date, backup, category }) {
  const place = preview.value;
  if (!place) return;
  const lane = laneTarget.value;
  if (lane) {
    laneTarget.value = null;
    preview.value = null;
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
  saving.value = true;
  try {
    const stop = await api.post(`/trips/${tripId}/stops`, {
      title: place.title.slice(0, 100),
      address: (place.address && place.address !== '查詢地址中…' ? place.address : '').slice(0, 200) || null,
      lat: place.lat,
      lng: place.lng,
      category,
      date: date || null,
      isBackup: !!backup,
    });
    upsertStop(stop);
    preview.value = null;
    searchRef.value?.clear();
    ui.toast(backup ? `已將「${stop.title}」放到${date ? `${dayTitle(date)}的` : ''}備選` : `已將「${stop.title}」加入${dayTitle(date)}`, 'success');
    if (!backup && date && selectedDate.value && selectedDate.value !== date) selectedDate.value = date;
    openStopCard(stop);
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}

function openDetail({ date, category }) {
  const place = preview.value;
  if (!place) return;
  preview.value = null;
  editing.value = {
    title: place.title,
    address: place.address === '查詢地址中…' ? '' : place.address,
    lat: place.lat,
    lng: place.lng,
    category,
    date: date || days.value[0]?.date || null,
    isBackup: false,
  };
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
        const r = await planDayRoute(dayStops, mode);
        if (r) {
          next[d.date] = { ...r, ids: dayStops.map((s) => s.id).join(',') };
          pendingRail.push({ date: d.date, stops: dayStops });
          // 每天算好就先顯示（機車路線需要排隊查詢，不用等全部完成）
          if (seq === routeSeq) routes.value = { ...routes.value, [d.date]: next[d.date] };
        }
      } catch {
        // 路線服務失敗時以直線顯示
      }
    }));
    if (seq !== routeSeq) return;
    routes.value = next; // 拿掉已經不需要路線的日子
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

/* ---- 天氣預報（每個地點用當地時間） ---- */
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
// 當地時差（出國時才顯示）
function dayOffset(g) {
  const center = dayCenters.value[g.date];
  return center ? offsetText(weather.value.get(weatherKey(center))?.offset) : '';
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
      const r = await planDayRoute(l.seq, mode);
      if (r) next[l.key] = { ...r, sig: l.sig };
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

// 地圖只在選了某一天時畫分頭路線，避免「總覽」時太亂
const mapLanes = computed(() => {
  const g = groups.value.find((x) => x.date && x.date === mapDate.value);
  if (!g) return [];
  return [...g.departLanes, ...g.returnLanes].map((l) => ({
    key: l.key, color: l.member.color || '#8a8886', name: l.member.displayName, stops: l.stops, seq: l.seq, lines: l.lines,
  }));
});

const laneTarget = ref(null); // 正在為誰加入分頭路線的地點
function openLanes(date, phase) {
  laneOpen[`${date}|${phase}`] = true;
}
function startLaneStop(date, phase, memberId) {
  laneTarget.value = {
    date, phase, member: memberOf(memberId), phaseLabel: LANE_PHASES.find((p) => p.key === phase).label,
  };
  focusSearch();
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
    currency: form.currency || null,
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
    searchRef.value?.clear();
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
    if (cardStopId.value === s.id) cardStopId.value = null;
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
  patchStop(s, { date: g.date, isBackup: false, sortOrder: sortOrderAt(list, evt.newIndex) });
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
    openStopCard(b);
  }
}

async function insertBackupAfter(b) {
  const t = backupTarget.value;
  backupTarget.value = null;
  const list = dayStopsOf(t.date).sort(byStopOrder);
  const sortOrder = sortOrderAt(list, list.findIndex((x) => x.id === t.id) + 1);
  if (await bulkUpdate([{ id: b.id, date: t.date, isBackup: false, sortOrder }])) {
    ui.toast(`已將「${b.title}」加在「${t.title}」後面`, 'success');
    openStopCard(b);
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

/* ---- 預訂 ---- */
const bookingEditing = ref(null);
function newBooking(kind, date) {
  bookingEditing.value = { kind, startDate: date || '' };
}
function bookingRowTime(row) {
  const b = row.booking;
  if (row.role === 'stay') return '續住';
  const v = row.role === 'end' ? b.endAt : b.startAt;
  const t = fmtBookingTime(v, false);
  const label = row.role === 'end' ? bookingKind(b.kind).end : bookingKind(b.kind).start;
  return t && t !== '00:00' ? `${t} ${label}` : label;
}
function bookingRowSub(row) {
  const b = row.booking;
  if (b.kind === 'hotel') return b.fromPlace ? `・${b.fromPlace}` : '';
  if (b.fromPlace || b.toPlace) return `・${b.fromPlace || ''}${b.toPlace ? ` → ${b.toPlace}` : ''}`;
  return '';
}
async function saveBooking(form) {
  saving.value = true;
  try {
    const { id, ...payload } = form;
    const row = id ? await api.put(`/trips/${tripId}/bookings/${id}`, payload) : await api.post(`/trips/${tripId}/bookings`, payload);
    const i = bookings.value.findIndex((b) => b.id === row.id);
    if (i >= 0) bookings.value[i] = row;
    else bookings.value.push(row);
    bookingEditing.value = null;
    ui.toast(id ? '已儲存預訂' : `已新增「${row.title}」`, 'success');
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}
async function deleteBooking(b) {
  const ok = await ui.confirm({ title: '刪除預訂', message: `確定要刪除「${b.title}」嗎？` });
  if (!ok) return;
  try {
    await api.delete(`/trips/${tripId}/bookings/${b.id}`);
    bookings.value = bookings.value.filter((x) => x.id !== b.id);
    bookingEditing.value = null;
  } catch (e) {
    ui.error(e);
  }
}

/* ---- 出發前準備 ---- */
async function addChecklist(items, templateLabel) {
  if (!items.length) {
    ui.toast(`「${templateLabel}」的項目都已經在清單裡了`, 'info');
    return;
  }
  try {
    const rows = await api.post(`/trips/${tripId}/checklist`, { items });
    checklist.value.push(...rows);
    if (templateLabel) ui.toast(`已加入 ${rows.length} 個「${templateLabel}」項目`, 'success');
  } catch (e) {
    ui.error(e);
  }
}
async function updateChecklist(item, patch) {
  const i = checklist.value.findIndex((x) => x.id === item.id);
  const old = { ...item };
  if (i >= 0) checklist.value[i] = { ...item, ...patch };
  try {
    const row = await api.put(`/trips/${tripId}/checklist/${item.id}`, patch);
    const j = checklist.value.findIndex((x) => x.id === row.id);
    if (j >= 0) checklist.value[j] = row;
  } catch (e) {
    const j = checklist.value.findIndex((x) => x.id === item.id);
    if (j >= 0) checklist.value[j] = old;
    ui.error(e);
  }
}
async function deleteChecklist(item) {
  const before = checklist.value;
  checklist.value = checklist.value.filter((x) => x.id !== item.id);
  try {
    await api.delete(`/trips/${tripId}/checklist/${item.id}`);
  } catch (e) {
    checklist.value = before;
    ui.error(e);
  }
}

/* ---- 地圖互動 ---- */
function focusStop(s) {
  focusStopId.value = null;
  requestAnimationFrame(() => { focusStopId.value = s.id; });
}

function onMarkerMove(s, latlng) {
  patchStop(s, latlng);
}

function fitMap() {
  selectedDate.value = null;
  nextTick(() => mapRef.value?.fit());
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
    checklist.value = checklist.value.map((x) => (x.assigneeId === m.id ? { ...x, assigneeId: null } : x));
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
  const ok = await ui.confirm({ title: '刪除行程', message: `確定要刪除「${trip.value.name}」嗎？\n所有地點、預訂與準備清單都會一併刪除，無法復原。` });
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

