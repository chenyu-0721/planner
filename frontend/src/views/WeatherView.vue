<template>
  <div class="flex-1 min-h-0 overflow-y-auto thin-scroll">
    <div class="max-w-[1280px] mx-auto px-3 sm:px-6 py-3 sm:py-5">
      <div class="flex flex-wrap items-end justify-between gap-2 sm:gap-3 mb-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 sm:gap-3">
            <Icon name="cloud" :size="24" class="text-accent shrink-0" />
            <h1 class="text-xl sm:text-2xl font-semibold">我的天氣</h1>
          </div>
          <p class="text-xs sm:text-sm text-ink-3 mt-1">颱風路徑、暴風圈與各地預報。官方優先，AI 僅供對照。</p>
        </div>
        <button v-if="snapshot" class="text-left rounded-md px-3 py-2 bg-white card-shadow hover:bg-hover cursor-pointer shrink-0" @click="tab = 'forecast'">
          <div class="text-[11px] text-ink-3">{{ place.name }}現在</div>
          <div class="text-sm font-semibold">{{ snapshot.icon }} {{ snapshot.temp }}° {{ snapshot.text }}</div>
        </button>
      </div>

      <div v-if="storms.length" class="mb-3 rounded-md px-3 py-2 text-xs sm:text-sm" :class="banner.box">
        <span class="font-semibold">{{ banner.title }}</span>
        <span class="text-ink-2"> {{ banner.text }}</span>
      </div>

      <div class="flex gap-1 border-b border-line mb-4">
        <button
          v-for="item in tabs"
          :key="item.id"
          class="h-9 px-3 text-sm font-semibold border-b-2 -mb-px cursor-pointer"
          :class="tab === item.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink'"
          @click="tab = item.id"
        >{{ item.label }}</button>
      </div>

      <TyphoonDesk
        v-show="tab === 'typhoon'"
        ref="typhoonDesk"
        :storms="storms"
        :typhoon-error="typhoonError"
        :pressure="pressure"
        :ai-paths="aiPaths"
        :wind="wind"
        :wind-index="windIndex"
        :wind-playing="windPlaying"
        :wind-label="windLabel"
        :radar="radarFrame"
        :layers="layers"
        @toggle-wind="toggleWind"
        @update:windIndex="windIndex = $event"
      />

      <ForecastDesk
        v-show="tab === 'forecast'"
        :place="place"
        :forecast="forecast"
        :forecast-error="forecastError"
        @select-city="selectCity"
        @locate="locate"
      />

      <p class="text-xs text-ink-4 pt-6 pb-4">
        颱風：中央氣象署、日本氣象廳。預報與風場：Open-Meteo。雷達：RainViewer。底圖：Esri、CARTO／OpenStreetMap。
        AI 路徑依未來 10 天氣壓場每 6 小時重算。僅供對照，仍以官方為準。
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import TyphoonDesk from '@/components/weather/TyphoonDesk.vue';
import ForecastDesk from '@/components/weather/ForecastDesk.vue';
import api from '@/api';
import {
  CITIES, aiTrack, fetchForecast, fetchRadarFrames, intensityClass, taiwanOutlook, warnLevel, weatherOf,
} from '@/utils/weatherDesk';

const tabs = [
  { id: 'typhoon', label: '颱風路徑' },
  { id: 'forecast', label: '天氣預報' },
];
const tab = ref('typhoon');
const saved = localStorage.getItem('planner_weather_city');
const place = ref(CITIES.find((c) => c.id === saved) || CITIES[0]);
const forecast = ref(null);
const forecastError = ref('');
const storms = ref([]);
const typhoonError = ref('');
const pressure = ref({ highs: [], lows: [] });
const wind = ref(null);
const windIndex = ref(0);
const windPlaying = ref(false);
let windTimer = null;
let radarTimer = null;
const layers = ref({
  cwa: true,
  jma: true,
  ai: true,
  impact: true,
  pressure: true,
  wind: true,
  radar: false,
});
const frames = ref([]);
const frameIndex = ref(0);
const typhoonDesk = ref(null);

watch(tab, (id) => {
  if (id !== 'typhoon') return;
  requestAnimationFrame(() => typhoonDesk.value?.resize?.());
});

const aiPaths = computed(() => {
  const samples = pressure.value?.samples;
  if (!samples?.length) return [];
  const ordered = [...storms.value].sort((a, b) => Number(b.source === 'cwa') - Number(a.source === 'cwa'));
  const storm = ordered.find((item) => item.center);
  if (!storm) return [];
  const others = ordered.filter((item) => item !== storm && item.center);
  const track = aiTrack(storm, samples, others, pressure.value);
  return track ? [{ id: `${storm.source}-${storm.id}`, ...track }] : [];
});

const radarFrame = computed(() => {
  const frame = frames.value[frameIndex.value];
  return frame ? { host: frame.host, path: frame.path } : null;
});

const windLabel = computed(() => {
  const time = wind.value?.times?.[windIndex.value];
  if (!time) return '風場載入中';
  const date = new Date(time.length === 16 ? `${time}:00+08:00` : time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
});

const snapshot = computed(() => {
  const now = forecast.value?.current;
  if (!now) return null;
  const [text, icon] = weatherOf(now.weather_code);
  return { text, icon, temp: Math.round(now.temperature_2m) };
});

const banner = computed(() => {
  const storm = storms.value.find((item) => item.source === 'cwa') || storms.value[0];
  if (!storm) return { box: '', title: '', text: '' };
  const warn = warnLevel(storm);
  const grade = intensityClass(storm);
  return {
    box: warn.level === 'land' ? 'bg-[#c50f1f]/10 text-late' : warn.level === 'sea' ? 'bg-[#c45911]/10 text-[#c45911]' : 'bg-accent-light text-ink-2',
    title: grade.text,
    text: taiwanOutlook(storm) || warn.text,
  };
});

watch(() => layers.value.radar, (on) => {
  clearInterval(radarTimer);
  if (!on || frames.value.length < 2) return;
  radarTimer = setInterval(() => {
    frameIndex.value = (frameIndex.value + 1) % frames.value.length;
  }, 600);
});

async function loadForecast() {
  forecastError.value = '';
  try {
    forecast.value = await fetchForecast(place.value.lat, place.value.lng);
  } catch (err) {
    forecast.value = null;
    forecastError.value = err.message;
  }
}

function selectCity(city) {
  place.value = city;
  localStorage.setItem('planner_weather_city', city.id);
  loadForecast();
}

function locate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    place.value = { id: 'here', name: '我的位置', lat: pos.coords.latitude, lng: pos.coords.longitude };
    localStorage.removeItem('planner_weather_city');
    loadForecast();
  });
}

function toggleWind() {
  windPlaying.value = !windPlaying.value;
  clearInterval(windTimer);
  if (!windPlaying.value || !wind.value?.times?.length) return;
  windTimer = setInterval(() => {
    windIndex.value = (windIndex.value + 1) % wind.value.times.length;
  }, 700);
}

onMounted(async () => {
  loadForecast();
  try {
    const radar = await fetchRadarFrames();
    frames.value = radar.frames.map((frame) => ({ ...frame, host: radar.host }));
    frameIndex.value = Math.max(0, radar.frames.length - 3);
  } catch {
    frames.value = [];
  }
  try {
    const data = await api.get('/weather/typhoons');
    storms.value = data.storms || [];
    if (!storms.value.length) tab.value = 'forecast';
  } catch (err) {
    typhoonError.value = err.message;
    tab.value = 'forecast';
  }
  try {
    pressure.value = await api.get('/weather/pressure');
  } catch {
    pressure.value = { highs: [], lows: [] };
  }
  try {
    wind.value = await api.get('/weather/wind');
    windIndex.value = 0;
  } catch {
    wind.value = null;
  }
});

onBeforeUnmount(() => {
  clearInterval(windTimer);
  clearInterval(radarTimer);
});
</script>
