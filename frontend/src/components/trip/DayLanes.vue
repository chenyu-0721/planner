<template>
  <div class="rounded-md border border-line bg-white/80" :class="phase === 'depart' ? 'mb-2' : 'mt-2'">
    <div class="flex items-center gap-1 pr-1">
      <button type="button" class="flex-1 min-w-0 flex items-center gap-2 px-2.5 h-9 text-left cursor-pointer" @click="open = !open">
        <span class="text-sm">👥</span>
        <span class="text-xs font-semibold shrink-0">{{ phaseLabel }}</span>
        <span class="text-xs text-ink-3 truncate">{{ headline }}</span>
      </button>
      <button v-if="!lanes.length" class="icon-btn !size-7" title="關閉" @click="$emit('close')"><Icon name="x" :size="14" /></button>
      <button v-else class="icon-btn !size-7" :title="open ? '收合' : '展開'" @click="open = !open">
        <Icon name="chevron-down" :size="14" class="transition-transform" :class="open ? 'rotate-180' : ''" />
      </button>
    </div>

    <!-- 收合：每人一行摘要 -->
    <div v-if="!open && lanes.length" class="px-2.5 pb-2 space-y-1 cursor-pointer" @click="open = true">
      <div v-for="l in lanes" :key="l.key" class="flex items-center gap-1.5 text-xs min-w-0">
        <Avatar :user="l.member" :size="18" />
        <span class="font-semibold shrink-0 max-w-20 truncate">{{ l.member.displayName }}</span>
        <span v-if="summaryTime(l)" class="shrink-0 tabular-nums">{{ summaryTime(l) }}</span>
        <span class="text-ink-3 truncate">{{ chain(l) }}<template v-if="totalSec(l)"> · {{ fmtDuration(totalSec(l)) }}</template><template v-if="fareOf(l)"> · {{ fmtCost(fareOf(l)) }}</template></span>
      </div>
    </div>

    <!-- 展開：每個人的路線 -->
    <div v-else-if="open" class="px-2.5 pb-2.5 space-y-3">
      <p v-if="hint" class="text-[11px] leading-4 text-ink-4">{{ hint }}</p>

      <div v-for="l in lanes" :key="l.key">
        <div class="flex items-center gap-2 mb-1">
          <Avatar :user="l.member" :size="22" />
          <span class="text-sm font-semibold truncate">{{ l.member.displayName }}</span>
          <span class="text-xs text-ink-3 truncate">{{ summaryTime(l) }}</span>
          <div class="flex-1"></div>
          <button class="shrink-0 h-7 px-2 rounded text-xs text-accent hover:bg-hover cursor-pointer" @click="$emit('add', l.member.id)">＋ 加地點</button>
        </div>

        <div v-if="phase === 'return' && l.meeting" class="flex items-center gap-2 pl-1 text-xs text-ink-3">
          <span class="size-6 rounded-full border border-dashed flex items-center justify-center shrink-0" :style="{ borderColor: l.member.color }">🤝</span>
          從「{{ l.meeting.title }}」出發<span v-if="l.times[0] != null" class="tabular-nums">（{{ minToTime(l.times[0]) }}）</span>
        </div>

        <draggable
          :model-value="l.stops"
          item-key="id"
          :group="l.key"
          ghost-class="drag-ghost"
          :animation="150"
          :delay="250"
          :delay-on-touch-only="true"
          filter=".no-drag"
          :prevent-on-filter="false"
          @change="(e) => onReorder(e, l)"
        >
          <template #item="{ element: s, index: i }">
            <div>
              <SegmentCard v-if="phase === 'return' && legIndex(l, i) >= 0" v-bind="segProps(l, legIndex(l, i))" @mode="(m) => $emit('mode', s, m)" @fare="$emit('edit', s, 'arriveCost')" />
              <StopCard
                :stop="s"
                :label="initial(l.member)"
                :color="l.member.color || '#8a8886'"
                :tag="stopTime(l, s, i)"
                :focused="focusStopId === s.id"
                @focus="$emit('focus', s)"
                @edit="$emit('edit', s)"
              >
                <template #menu>
                  <button class="menu-item" @click="$emit('edit', s)"><Icon name="pencil" />編輯</button>
                  <div class="border-t border-line my-1"></div>
                  <button class="menu-item !text-[#c50f1f]" @click="$emit('delete', s)"><Icon name="trash" />刪除</button>
                </template>
              </StopCard>
              <SegmentCard v-if="phase === 'depart' && i < l.seq.length - 1" v-bind="segProps(l, i)" @mode="(m) => $emit('mode', s, m)" @fare="$emit('edit', s, 'arriveCost')" />
            </div>
          </template>
        </draggable>

        <div v-if="phase === 'depart' && l.meeting" class="flex items-center gap-2 pl-1 text-xs text-ink-3">
          <span class="size-6 rounded-full border border-dashed flex items-center justify-center shrink-0" :style="{ borderColor: l.member.color }">🤝</span>
          在「{{ l.meeting.title }}」會合<span v-if="l.meeting.startTime" class="tabular-nums">（{{ l.meeting.startTime }}）</span>
        </div>
      </div>

      <div v-if="others.length" class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-ink-4">{{ lanes.length ? '也要分開：' : `誰要${phase === 'depart' ? '從不同地方出發' : '各自回家'}？` }}</span>
        <button
          v-for="m in others"
          :key="m.id"
          class="flex items-center gap-1 h-7 pl-1 pr-2 rounded-full border border-line-2 text-xs hover:bg-hover cursor-pointer"
          @click="$emit('add', m.id)"
        >
          <Avatar :user="m" :size="20" />＋ {{ m.displayName }}
        </button>
      </div>
      <p v-if="!lanes.length" class="text-[11px] leading-4 text-ink-4">
        {{ phase === 'depart' ? '加入他的出發地點（例如家、車站），會依序連到這天第一個地點會合。' : '加入他回家路上的地點（例如車站、家），會從這天最後一個地點出發。' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import draggable from 'vuedraggable';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import StopCard from './StopCard.vue';
import SegmentCard from './SegmentCard.vue';
import { sortOrderAt, initials } from '@/utils/planner';
import {
  LANE_PHASES, travelModeInfo, segmentInfo, laneLegOwner, legSeconds, minToTime, fmtDuration, fmtCost, googleSegmentUrl,
} from '@/utils/trip';

const props = defineProps({
  phase: { type: String, required: true }, // depart | return
  lanes: { type: Array, required: true }, // TripView 整理好的分頭路線（含 seq、legs、times、meeting）
  meeting: { type: Object, default: null },
  members: { type: Array, required: true },
  travelMode: { type: String, required: true },
  focusStopId: { type: Number, default: null },
});
// add(memberId)、edit(stop, focus?)、delete(stop)、mode(stop, mode)、reorder(stop, sortOrder)、focus(stop)、close
const emit = defineEmits(['add', 'edit', 'delete', 'mode', 'reorder', 'focus', 'close']);

// 還沒設定路線時（從選單打開）直接展開
const open = ref(!props.lanes.length);

const phaseLabel = computed(() => LANE_PHASES.find((p) => p.key === props.phase)?.label);
const others = computed(() => props.members.filter((m) => !props.lanes.some((l) => l.memberId === m.id)));
const initial = (m) => initials(m.displayName || '?').slice(0, 1);

const headline = computed(() => {
  const m = props.meeting;
  if (!m) return '這天還沒有共同地點';
  if (props.phase === 'depart') return `→ ${m.startTime ? `${m.startTime} ` : ''}在「${m.title}」會合`;
  const t = m.endTime || m.startTime;
  return `${t ? `${t} ` : ''}從「${m.title}」各自回家`;
});
const hint = computed(() => {
  const m = props.meeting;
  if (!m || !props.lanes.length) return '';
  if (props.phase === 'depart' && !m.startTime) return `在「${m.title}」設定開始時間，就能算出每個人幾點要出門。`;
  if (props.phase === 'return' && !m.endTime && !m.startTime) return `在「${m.title}」設定結束時間，就能算出每個人幾點到。`;
  return '';
});

// 序列中第 k 段的顯示資料
function segProps(l, k) {
  const owner = laneLegOwner(props.phase, l.stops, l.hasMeeting, k);
  const from = l.seq[k];
  const to = l.seq[k + 1];
  const mode = owner.arriveMode || props.travelMode;
  return {
    seg: segmentInfo(mode, !!owner.arriveMode, l.legs?.[k], from, to, owner.arriveCost),
    mode: owner.arriveMode || null,
    defaultLabel: travelModeInfo(props.travelMode).label,
    caption: `${from.title} → ${to.title}`,
    fare: owner.arriveCost ?? null,
    railUrl: googleSegmentUrl(from, to, mode),
    color: l.member.color || '#8a8886',
    dashed: true,
  };
}
// 回程：第 i 個地點前面那一段在序列中的位置
const legIndex = (l, i) => (l.hasMeeting ? i : i - 1);

function stopTime(l, s, i) {
  if (s.startTime) return props.phase === 'depart' ? `${s.startTime} 出發` : `${s.startTime} 抵達`;
  const t = props.phase === 'depart' ? l.times[i] : l.times[l.hasMeeting ? i + 1 : i];
  if (t == null) return '';
  return props.phase === 'depart' ? `約 ${minToTime(t)} 出發` : `約 ${minToTime(t)} 抵達`;
}
function summaryTime(l) {
  if (props.phase === 'depart') {
    const first = l.stops[0];
    if (first?.startTime) return `${first.startTime} 出門`;
    return l.times[0] != null ? `約 ${minToTime(l.times[0])} 出門` : '';
  }
  const last = l.stops[l.stops.length - 1];
  if (last?.startTime) return `${last.startTime} 抵達`;
  const t = l.times[l.times.length - 1];
  return t != null && l.hasMeeting ? `約 ${minToTime(t)} 抵達` : '';
}
const chain = (l) => {
  const n = l.seq.length - 1;
  return Array.from({ length: Math.max(0, n) }, (_, k) => travelModeInfo(laneLegOwner(props.phase, l.stops, l.hasMeeting, k).arriveMode || props.travelMode).emoji).join('→');
};
const totalSec = (l) => l.seq.slice(1).reduce((sum, to, k) => sum + legSeconds(l.legs?.[k], l.seq[k], to), 0);
const fareOf = (l) => l.stops.reduce((sum, s) => sum + (s.arriveCost || 0), 0);

function onReorder(e, l) {
  if (!e.moved) return;
  const s = e.moved.element;
  emit('reorder', s, sortOrderAt(l.stops.filter((x) => x.id !== s.id), e.moved.newIndex));
}
</script>
