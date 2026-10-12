<template>
  <div class="flex-1 overflow-y-auto thin-scroll">
    <div class="max-w-[1280px] mx-auto px-4 sm:px-8 py-4 sm:py-6">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <Icon name="plane" :size="26" class="text-brand" />
          <h1 class="text-xl sm:text-2xl font-semibold">我的行程</h1>
        </div>
        <button class="btn btn-primary" @click="formOpen = true">
          <Icon name="plus" :size="16" :stroke="2.2" />新增行程
        </button>
      </div>

      <div v-if="loading && !loaded" class="py-16 text-center text-ink-3">載入中…</div>
      <div v-else-if="!trips.length" class="py-20 flex flex-col items-center text-center">
        <Icon name="map" :size="48" class="text-ink-4 mb-3" :stroke="1.2" />
        <div class="text-lg font-semibold mb-1">還沒有任何行程</div>
        <p class="text-sm text-ink-3 mb-4">建立行程，在地圖上規劃每天要去的地點，依時程自動連成路線。</p>
        <button class="btn btn-primary" @click="formOpen = true">新增行程</button>
      </div>

      <template v-else>
        <section v-for="g in groups" :key="g.key" class="mb-8">
          <h2 class="text-sm font-semibold text-ink-3 mb-3">{{ g.label }}（{{ g.trips.length }}）</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <router-link
              v-for="t in g.trips"
              :key="t.id"
              :to="`/trips/${t.id}`"
              class="group bg-white rounded-md card-shadow hover:card-shadow-hover overflow-hidden transition-shadow"
            >
              <div class="h-2" :style="{ background: planColor(t.color) }"></div>
              <div class="p-4">
                <div class="flex items-start gap-3">
                  <TripIcon :color="t.color" :size="40" />
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold truncate group-hover:underline">{{ t.name }}</div>
                    <div class="text-xs text-ink-3 mt-0.5">{{ fmtTripRange(t) }}</div>
                  </div>
                  <span class="shrink-0 text-xs font-semibold rounded-full px-2 h-5 inline-flex items-center" :class="statusClass(t)">{{ statusLabel(t) }}</span>
                </div>
                <p v-if="t.description" class="mt-2 text-sm text-ink-2 line-clamp-2">{{ t.description }}</p>
                <div class="mt-3 flex items-center gap-4 text-xs text-ink-3">
                  <span class="flex items-center gap-1"><Icon name="pin" :size="13" />{{ t.stopCount }} 個地點</span>
                  <span class="flex items-center gap-1"><Icon name="users" :size="13" />{{ t.memberCount }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </template>
    </div>

    <TripFormDialog v-model="formOpen" @saved="onCreated" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import TripIcon from '@/components/trip/TripIcon.vue';
import TripFormDialog from '@/components/trip/TripFormDialog.vue';
import api from '@/api';
import { planColor, todayStr } from '@/utils/planner';
import { fmtTripRange } from '@/utils/trip';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const trips = ref([]);
const loading = ref(false);
const loaded = ref(false);
const formOpen = ref(false);

const status = (t) => {
  const today = todayStr();
  if (t.endDate < today) return 'past';
  if (t.startDate <= today) return 'ongoing';
  return 'upcoming';
};
const statusLabel = (t) => ({ past: '已結束', ongoing: '進行中', upcoming: '即將出發' }[status(t)]);
const statusClass = (t) => ({
  past: 'bg-hover text-ink-3',
  ongoing: 'bg-brand-light text-brand-dark',
  upcoming: 'bg-accent-light text-accent',
}[status(t)]);

const groups = computed(() => {
  const active = trips.value.filter((t) => status(t) !== 'past');
  const past = trips.value.filter((t) => status(t) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));
  return [
    { key: 'active', label: '即將出發與進行中', trips: active },
    { key: 'past', label: '已結束', trips: past },
  ].filter((g) => g.trips.length);
});

async function load() {
  loading.value = true;
  try {
    trips.value = await api.get('/trips');
    loaded.value = true;
  } catch (e) {
    ui.error(e);
  } finally {
    loading.value = false;
  }
}

function onCreated(trip) {
  router.push(`/trips/${trip.id}`);
}

load();
</script>
