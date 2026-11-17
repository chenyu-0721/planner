<template>
  <div>
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="city in CITIES"
        :key="city.id"
        class="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full text-xs sm:text-sm border cursor-pointer"
        :class="place.id === city.id ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 bg-white hover:bg-hover'"
        @click="$emit('select-city', city)"
      >{{ city.name }}</button>
      <button class="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full text-xs sm:text-sm border border-line-2 bg-white hover:bg-hover cursor-pointer" @click="$emit('locate')">我的位置</button>
    </div>

    <div v-if="forecastError" class="mb-4 rounded bg-white card-shadow px-4 py-3 text-sm text-late">{{ forecastError }}</div>

    <section v-if="current" class="bg-white rounded-md card-shadow p-4 mb-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="text-sm text-ink-3">{{ place.name }}・現在</div>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-5xl leading-none">{{ weatherOf(current.weather_code)[1] }}</span>
            <div>
              <div class="text-4xl font-semibold">{{ Math.round(current.temperature_2m) }}°</div>
              <div class="text-sm text-ink-2">{{ weatherOf(current.weather_code)[0] }}・體感 {{ Math.round(current.apparent_temperature) }}°</div>
            </div>
          </div>
          <div v-if="sun" class="mt-2 text-xs text-ink-3">日出 {{ sun.rise }}　日落 {{ sun.set }}</div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-sm w-full sm:flex-1 min-w-0">
          <div v-for="item in metrics" :key="item.label" class="rounded bg-hover px-3 py-2">
            <div class="text-[11px] text-ink-3">{{ item.label }}</div>
            <div class="font-semibold">{{ item.value }}</div>
            <div v-if="item.note" class="text-[11px] text-ink-3">{{ item.note }}</div>
          </div>
        </div>
      </div>
      <p class="mt-3 text-sm text-ink-2">{{ hint }}</p>
      <svg v-if="pressureLine" viewBox="0 0 240 48" class="mt-2 w-full max-w-md h-12">
        <polyline :points="pressureLine" fill="none" stroke="#0f6cbd" stroke-width="2" />
      </svg>
      <p class="text-xs text-ink-4">藍線是未來 48 小時氣壓。明顯下降通常代表低壓或鋒面靠近。</p>
    </section>

    <section v-if="hours.length" class="mb-4">
      <h2 class="text-sm font-semibold mb-2">48 小時逐時預報</h2>
      <div class="flex gap-2 overflow-x-auto thin-scroll pb-1">
        <div v-for="hour in hours" :key="hour.time" class="shrink-0 w-[78px] bg-white rounded card-shadow px-2 py-2 text-center">
          <div class="text-xs text-ink-3">{{ hour.label }}</div>
          <div class="text-lg my-1">{{ hour.icon }}</div>
          <div class="text-sm font-semibold">{{ hour.temp }}°</div>
          <div class="text-[11px] text-accent">{{ hour.rain }}%</div>
          <div class="text-[11px] text-ink-3">{{ hour.mm }} mm</div>
          <div class="text-[11px] text-ink-3">{{ hour.wind }}</div>
        </div>
      </div>
    </section>

    <section v-if="days.length">
      <h2 class="text-sm font-semibold mb-2">10 日預報</h2>
      <div class="bg-white rounded-md card-shadow overflow-hidden">
        <div v-for="day in days" :key="day.time" class="grid grid-cols-[68px_28px_minmax(0,1fr)_48px] md:grid-cols-[110px_40px_minmax(0,1fr)_80px_90px] items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 border-b border-line last:border-0 text-sm">
          <div class="font-semibold truncate text-xs sm:text-sm">{{ day.label }}</div>
          <div class="text-lg sm:text-xl text-center">{{ day.icon }}</div>
          <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span class="text-ink-3 w-7 sm:w-8 text-right shrink-0 text-xs sm:text-sm">{{ day.min }}°</span>
            <div class="flex-1 h-1.5 rounded-full bg-canvas relative overflow-hidden">
              <div class="absolute inset-y-0 rounded-full bg-accent" :style="{ left: `${day.barLeft}%`, width: `${day.barWidth}%` }"></div>
            </div>
            <span class="font-semibold w-7 sm:w-8 shrink-0 text-xs sm:text-sm">{{ day.max }}°</span>
          </div>
          <div class="text-[11px] text-right leading-tight">
            <div class="text-accent">{{ day.rain }}%</div>
            <div class="text-ink-3">{{ day.mm }}mm</div>
          </div>
          <div class="hidden md:block text-xs text-ink-3 truncate">UV {{ day.uv }}</div>
        </div>
      </div>
      <p class="mt-2 text-xs text-ink-3">10 日預報含高溫、低溫、降雨機率與紫外線。風場、雷達與颱風路徑請切到「颱風路徑」。</p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CITIES, pressureHint, uvLabel, visibilityKm, weatherOf, windDir } from '@/utils/weatherDesk';

const props = defineProps({
  place: { type: Object, required: true },
  forecast: { type: Object, default: null },
  forecastError: { type: String, default: '' },
});

defineEmits(['select-city', 'locate']);

const current = computed(() => props.forecast?.current || null);
const hourly = computed(() => props.forecast?.hourly || null);
const daily = computed(() => props.forecast?.daily || null);

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const sun = computed(() => {
  if (!daily.value?.sunrise?.[0]) return null;
  return { rise: clock(daily.value.sunrise[0]), set: clock(daily.value.sunset[0]) };
});

const hint = computed(() => {
  const values = hourly.value?.pressure_msl;
  if (!values?.length) return '';
  return pressureHint(values[0], values[Math.min(24, values.length - 1)]);
});

const nowUv = computed(() => hourly.value?.uv_index?.[0]);
const nowDew = computed(() => hourly.value?.dew_point_2m?.[0]);

const metrics = computed(() => {
  const now = current.value;
  if (!now) return [];
  const vis = visibilityKm(now.visibility);
  return [
    { label: '風', value: `${windDir(now.wind_direction_10m)} ${Math.round(now.wind_speed_10m)} km/h`, note: now.wind_gusts_10m != null ? `陣風 ${Math.round(now.wind_gusts_10m)} km/h` : '' },
    { label: '濕度', value: `${now.relative_humidity_2m}%`, note: nowDew != null ? `露點 ${Math.round(nowDew)}°` : '' },
    { label: '氣壓', value: `${Math.round(now.pressure_msl)} hPa` },
    { label: '降雨', value: `${Number(now.precipitation || 0).toFixed(1)} mm` },
    { label: '雲量', value: `${now.cloud_cover}%` },
    { label: '能見度', value: vis != null ? `${vis} km` : '—' },
    { label: '紫外線', value: nowUv != null ? `${Math.round(nowUv)}` : '—', note: uvLabel(nowUv) },
    { label: '體感', value: `${Math.round(now.apparent_temperature)}°` },
  ];
});

const pressureLine = computed(() => {
  const values = (hourly.value?.pressure_msl || []).slice(0, 48).filter((n) => n != null);
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return values.map((n, i) => {
    const x = (i / (values.length - 1)) * 240;
    const y = 44 - ((n - min) / span) * 40;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});

const hours = computed(() => {
  const data = hourly.value;
  if (!data?.time) return [];
  return data.time.slice(0, 48).map((time, i) => ({
    time,
    label: `${new Date(time).getHours()}時`,
    icon: weatherOf(data.weather_code[i])[1],
    temp: Math.round(data.temperature_2m[i]),
    rain: data.precipitation_probability[i] ?? 0,
    mm: Number(data.precipitation[i] || 0).toFixed(1),
    wind: `${windDir(data.wind_direction_10m[i])} ${Math.round(data.wind_speed_10m[i])}`,
  }));
});

const days = computed(() => {
  const data = daily.value;
  if (!data?.time) return [];
  const week = '日一二三四五六';
  const mins = data.temperature_2m_min.filter((n) => n != null);
  const maxs = data.temperature_2m_max.filter((n) => n != null);
  const lo = Math.min(...mins);
  const hi = Math.max(...maxs);
  const span = Math.max(1, hi - lo);
  return data.time.map((time, i) => {
    const date = new Date(`${time}T00:00:00`);
    const min = Math.round(data.temperature_2m_min[i]);
    const max = Math.round(data.temperature_2m_max[i]);
    return {
      time,
      label: i === 0 ? '今天' : `${date.getMonth() + 1}/${date.getDate()} 週${week[date.getDay()]}`,
      icon: weatherOf(data.weather_code[i])[1],
      text: weatherOf(data.weather_code[i])[0],
      min,
      max,
      barLeft: Math.round(((min - lo) / span) * 100),
      barWidth: Math.max(8, Math.round(((max - min) / span) * 100)),
      rain: data.precipitation_probability_max[i] ?? 0,
      mm: Math.round(data.precipitation_sum[i] || 0),
      uv: data.uv_index_max?.[i] != null ? `${Math.round(data.uv_index_max[i])}（${uvLabel(data.uv_index_max[i])}）` : '—',
      wind: data.wind_speed_10m_max?.[i] != null ? `${Math.round(data.wind_speed_10m_max[i])} km/h` : '—',
    };
  });
});
</script>
