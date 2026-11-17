<template>
  <div>
    <div class="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px] gap-3 sm:gap-4">
      <div class="rounded-xl overflow-hidden card-shadow bg-[#0b1220] min-w-0">
        <div class="relative h-[min(58vh,380px)] sm:h-[480px] lg:h-[600px] xl:h-[680px]">
          <WeatherMap
            ref="weatherMap"
            :radar="radar"
            :storms="storms"
            :pressure="pressure"
            :ai-paths="aiPaths"
            :wind="wind"
            :wind-index="windIndex"
            :layers="layers"
          />
          <div class="absolute top-2 left-2 z-[1000] w-[132px] sm:w-[148px] rounded-md bg-[#0b1220]/88 border border-white/10 px-1.5 py-1.5 text-[11px] text-white/90 backdrop-blur-sm">
            <div class="flex gap-1 mb-1">
              <button class="flex-1 h-6 rounded bg-white/10 hover:bg-white/20 cursor-pointer" @click="focusTaiwan">看台灣</button>
              <button class="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer" :title="layersOpen ? '收合圖層' : '展開圖層'" @click="layersOpen = !layersOpen">{{ layersOpen ? '收合' : '圖層' }}</button>
            </div>
            <div v-show="layersOpen" class="space-y-px">
              <label v-for="item in allLayers" :key="item.key" class="flex items-center gap-1.5 h-5 cursor-pointer">
                <input v-model="layers[item.key]" type="checkbox" class="accent-accent scale-75">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: item.color }"></span>
                {{ item.label }}
              </label>
            </div>
          </div>
          <div class="absolute left-2 right-2 bottom-2 z-[1000] rounded-lg bg-[#0b1220]/90 border border-white/10 px-2 py-1.5 sm:px-3 sm:py-2 backdrop-blur-sm">
            <div class="flex items-center gap-1.5 sm:gap-2">
              <button class="h-6 sm:h-7 px-2 sm:px-3 rounded-md text-[11px] sm:text-xs bg-white/10 text-white hover:bg-white/20 cursor-pointer shrink-0" :disabled="!wind" @click="emit('toggle-wind')">{{ windPlaying ? '暫停' : '播放' }}</button>
              <input :value="windIndex" class="flex-1 min-w-0 accent-accent" type="range" min="0" :max="Math.max(0, (wind?.times?.length || 1) - 1)" :disabled="!wind" @input="emit('update:windIndex', Number($event.target.value))">
              <span class="hidden sm:block text-xs text-white/80 w-[118px] text-right shrink-0">{{ windLabel }}</span>
            </div>
            <div class="sm:hidden text-[10px] text-white/70 mt-0.5 truncate">{{ windLabel }}</div>
            <div class="mt-1 h-1.5 rounded-full" style="background: linear-gradient(90deg, #1c2840, #1c6bb0, #2cb8b0, #3aba68, #d6c84a, #e07a28, #d03a3a, #9a2888)"></div>
            <div class="flex justify-between text-[10px] text-white/50 mt-0.5">
              <span>弱</span><span>40</span><span>80</span><span>120 km/h</span>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-3 lg:max-h-[600px] xl:max-h-[680px] overflow-y-auto thin-scroll min-w-0">
        <div v-if="typhoonError" class="bg-white rounded-md card-shadow p-3 text-sm text-late">{{ typhoonError }}</div>
        <div v-else-if="!storms.length" class="bg-white rounded-md card-shadow p-4 text-sm text-ink-3">
          目前中央氣象署和日本氣象廳都沒有發布中的颱風。圖上仍可看高低氣壓、風場與雷達。
        </div>
        <template v-else>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="item in visibleStorms"
              :key="item.source + item.id"
              class="h-8 px-3 rounded-full text-xs border cursor-pointer"
              :class="selectedId === item.source + item.id ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 bg-white hover:bg-hover'"
              @click="selectedId = item.source + item.id"
            >{{ item.sourceLabel }} {{ item.title }}</button>
          </div>

          <article v-if="storm" class="bg-white rounded-md card-shadow p-3 sm:p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-xs font-semibold" :class="storm.source === 'cwa' ? 'text-done' : 'text-late'">{{ storm.sourceLabel }}</div>
                <h3 class="text-lg font-semibold mt-0.5">{{ storm.title }}</h3>
                <div class="text-xs text-ink-3 mt-1">分析時間 {{ storm.time || storm.issue || '—' }}</div>
              </div>
              <span class="shrink-0 text-xs font-semibold px-2 py-1 rounded" :class="toneClass">{{ grade.text }}</span>
            </div>

            <div class="mt-3 rounded-md px-3 py-2 text-xs" :class="warnBox">{{ warn.text }}</div>
            <p class="mt-2 text-xs text-ink-2">{{ taiwanOutlook(storm) }}</p>

            <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt class="text-[11px] text-ink-3">中心位置</dt>
                <dd class="font-semibold leading-snug">{{ formatLatLng(storm.center) }}</dd>
                <dd v-if="storm.location" class="text-xs text-ink-3">{{ storm.location }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">移動</dt>
                <dd class="font-semibold">{{ storm.course ? `朝${storm.course}` : '—' }} {{ storm.speed ? `${storm.speed} km/h` : '' }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">中心氣壓</dt>
                <dd class="font-semibold">{{ storm.pressure ? `${storm.pressure} hPa` : '—' }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">最大風速</dt>
                <dd class="font-semibold">{{ storm.wind ? `${storm.wind} m/s` : '—' }}</dd>
                <dd v-if="storm.wind" class="text-xs text-ink-3">約 {{ msToKmh(storm.wind) }} km/h</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">最大陣風</dt>
                <dd class="font-semibold">{{ storm.gust ? `${storm.gust} m/s` : '—' }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">七級風半徑</dt>
                <dd class="font-semibold">{{ impact.galeKm ? `${impact.galeKm} km` : '—' }}</dd>
                <dd v-if="impact.areaKm2" class="text-xs text-ink-3">約 {{ formatArea(impact.areaKm2) }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">十級風半徑</dt>
                <dd class="font-semibold">{{ impact.stormKm ? `${impact.stormKm} km` : '—' }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-3">資料來源</dt>
                <dd class="font-semibold">{{ storm.sourceLabel }}</dd>
              </div>
            </dl>
            <p v-if="guide" class="mt-3 text-xs text-ink-2 leading-relaxed">{{ guide.text }}</p>
          </article>

          <article v-if="storm" class="bg-white rounded-md card-shadow p-3 sm:p-4">
            <h4 class="text-sm font-semibold mb-2">各地風圈距離</h4>
            <div class="space-y-1">
              <div v-for="city in threats" :key="city.id" class="flex items-center justify-between gap-2 text-xs py-1 border-b border-line last:border-0">
                <span class="font-semibold w-10">{{ city.name }}</span>
                <span class="text-ink-3 flex-1 text-right">{{ city.dist }} km</span>
                <span class="w-[88px] text-right font-semibold" :class="city.level === 'storm' ? 'text-late' : city.level === 'gale' ? 'text-[#c45911]' : city.level === 'watch' ? 'text-accent' : 'text-ink-4'">{{ threatLabel(city.level) }}</span>
              </div>
            </div>
          </article>
        </template>
      </div>
    </div>

    <section v-if="storm" class="mt-4 bg-white rounded-md card-shadow overflow-hidden">
      <div class="px-3 sm:px-4 py-3 border-b border-line">
        <h4 class="text-sm font-semibold">路徑預報對照</h4>
        <p class="text-xs text-ink-3 mt-0.5">近程貼近官方，之後依氣壓場延伸。仍以官方為準。</p>
      </div>
      <div class="overflow-x-auto thin-scroll">
        <table class="w-full text-xs min-w-[560px] sm:min-w-[720px]">
          <thead class="bg-canvas text-ink-3">
            <tr>
              <th class="text-left font-semibold px-3 py-2">時間</th>
              <th class="text-left font-semibold px-3 py-2">中央氣象署</th>
              <th class="text-left font-semibold px-3 py-2">日本氣象廳</th>
              <th class="text-left font-semibold px-3 py-2">AI 判斷</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.hours" class="border-t border-line">
              <td class="px-3 py-2 font-semibold whitespace-nowrap">{{ hourLabel(row.hours) }}</td>
              <td class="px-3 py-2">{{ posText(row.cwa) }}</td>
              <td class="px-3 py-2">{{ posText(row.jma) }}</td>
              <td class="px-3 py-2" style="color:#5c2e91">{{ posText(row.ai) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="storm?.forecast?.length" class="mt-4 bg-white rounded-md card-shadow overflow-hidden">
      <div class="px-4 py-3 border-b border-line">
        <h4 class="text-sm font-semibold">官方預報點</h4>
      </div>
      <div class="overflow-x-auto thin-scroll">
        <table class="w-full text-xs min-w-[520px] sm:min-w-[640px]">
          <thead class="bg-canvas text-ink-3">
            <tr>
              <th class="text-left font-semibold px-3 py-2">預報時</th>
              <th class="text-left font-semibold px-3 py-2">中心位置</th>
              <th class="text-left font-semibold px-3 py-2">氣壓</th>
              <th class="text-left font-semibold px-3 py-2">風速</th>
              <th class="text-left font-semibold px-3 py-2">機率圓／半徑</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(point, index) in storm.forecast" :key="index" class="border-t border-line">
              <td class="px-3 py-2 whitespace-nowrap">{{ point.time || `${point.hours} 小時後` }}</td>
              <td class="px-3 py-2">{{ formatLatLng(point.center) }}</td>
              <td class="px-3 py-2">{{ point.pressure ? `${point.pressure} hPa` : '—' }}</td>
              <td class="px-3 py-2">{{ point.wind ? `${point.wind} m/s` : '—' }}</td>
              <td class="px-3 py-2">{{ point.radiusKm ? `${point.radiusKm} km` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import WeatherMap from '@/components/weather/WeatherMap.vue';
import {
  cityThreats, formatArea, formatLatLng, historyPoints, impactOf, intensityClass, msToKmh,
  steerStorm, taiwanOutlook, trackCompare, warnLevel,
} from '@/utils/weatherDesk';

const props = defineProps({
  storms: { type: Array, default: () => [] },
  typhoonError: { type: String, default: '' },
  pressure: { type: Object, default: () => ({}) },
  aiPaths: { type: Array, default: () => [] },
  wind: { type: Object, default: null },
  windIndex: { type: Number, default: 0 },
  windPlaying: { type: Boolean, default: false },
  windLabel: { type: String, default: '' },
  radar: { type: Object, default: null },
  layers: { type: Object, required: true },
});

const emit = defineEmits(['toggle-wind', 'update:windIndex']);
const weatherMap = ref(null);
const selectedId = ref('');
const layersOpen = ref(typeof window === 'undefined' || window.innerWidth >= 768);
const allLayers = [
  { key: 'cwa', label: '氣象署', color: '#3ee07a' },
  { key: 'jma', label: '日本', color: '#ff6b6b' },
  { key: 'ai', label: 'AI', color: '#c9a0ff' },
  { key: 'impact', label: '風圈', color: '#ffb347' },
  { key: 'pressure', label: '氣壓', color: '#8ec8ff' },
  { key: 'wind', label: '風場', color: '#2cb8b0' },
  { key: 'radar', label: '雷達', color: '#5aa2ff' },
];

const visibleStorms = computed(() => props.storms.filter((storm) => (
  (storm.source === 'cwa' && props.layers.cwa) || (storm.source === 'jma' && props.layers.jma)
)));

watch(visibleStorms, (list) => {
  if (!list.length) {
    selectedId.value = '';
    return;
  }
  if (!list.some((storm) => storm.source + storm.id === selectedId.value)) {
    selectedId.value = list[0].source + list[0].id;
  }
}, { immediate: true });

const storm = computed(() => visibleStorms.value.find((item) => item.source + item.id === selectedId.value) || null);
const grade = computed(() => intensityClass(storm.value));
const impact = computed(() => impactOf(storm.value));
const warn = computed(() => (storm.value ? warnLevel(storm.value) : { level: 'none', text: '' }));
const threats = computed(() => (storm.value ? cityThreats(storm.value) : []));
const guide = computed(() => (storm.value ? steerStorm(storm.value, props.pressure) : null));
const toneClass = computed(() => ({
  severe: 'bg-late text-white',
  strong: 'bg-[#c45911] text-white',
  mild: 'bg-accent text-white',
  td: 'bg-ink-3 text-white',
}[grade.value.tone] || 'bg-ink-3 text-white'));
const warnBox = computed(() => ({
  land: 'bg-[#c50f1f]/10 text-late',
  sea: 'bg-[#c45911]/10 text-[#c45911]',
  none: 'bg-accent-light text-accent',
}[warn.value.level] || 'bg-canvas text-ink-3'));

function withTrack(item) {
  if (!item) return [];
  return [...historyPoints(item), ...(item.forecast || []).filter((point) => point.center)];
}

const compareRows = computed(() => {
  const cwa = props.storms.find((item) => item.source === 'cwa');
  const jma = props.storms.find((item) => item.source === 'jma');
  const ai = props.aiPaths[0]?.points || [];
  return trackCompare(withTrack(cwa), withTrack(jma), ai);
});

function hourLabel(hours) {
  if (hours === 0) return '現在';
  if (hours < 0) return `${Math.abs(hours)} 小時前`;
  return `${hours} 小時後`;
}

function posText(point) {
  if (!point?.center) return '—';
  const extra = [
    point.pressure ? `${point.pressure} hPa` : '',
    point.wind ? `${point.wind} m/s` : '',
  ].filter(Boolean).join('・');
  const lat = Number(point.center[0]).toFixed(1);
  const lng = Number(point.center[1]).toFixed(1);
  return `${lat}°N ${lng}°E${extra ? `（${extra}）` : ''}`;
}

function threatLabel(level) {
  if (level === 'storm') return '十級風圈內';
  if (level === 'gale') return '七級風圈內';
  if (level === 'watch') return '接近警戒';
  return '暫無影響';
}

function focusTaiwan() {
  weatherMap.value?.focusTaiwan();
}

function resize() {
  weatherMap.value?.resize?.();
}

defineExpose({ focusTaiwan, resize });
</script>
