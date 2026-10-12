<template>
  <Modal :model-value="modelValue" title="預算" width="520px" @update:model-value="$emit('update:modelValue', $event)">
    <div v-if="modelValue" class="px-4 sm:px-6 pb-4 space-y-5">
      <!-- 總計與預算 -->
      <div class="rounded-md border border-line p-3">
        <div class="flex items-end justify-between gap-3">
          <div>
            <div class="text-xs text-ink-3">預估總花費</div>
            <div class="text-2xl font-semibold tabular-nums">{{ fmtCost(budget.total) || '$0' }}</div>
            <div v-if="memberCount > 1 && budget.total" class="text-xs text-ink-3">{{ memberCount }} 人平均每人約 {{ fmtCost(Math.round(budget.total / memberCount)) }}</div>
          </div>
          <div class="w-36 shrink-0">
            <label class="text-xs text-ink-3" for="trip-budget">預算上限</label>
            <input
              id="trip-budget"
              v-model="limitInput"
              type="number"
              min="0"
              step="100"
              class="input"
              placeholder="未設定"
              @change="saveLimit"
              @keydown.enter="$event.target.blur()"
            />
          </div>
        </div>
        <template v-if="limit">
          <div class="mt-3 h-2 rounded-full bg-hover overflow-hidden">
            <div class="h-full rounded-full" :class="over ? 'bg-[#c50f1f]' : 'bg-[#107c10]'" :style="{ width: `${Math.min(100, (budget.total / limit) * 100)}%` }"></div>
          </div>
          <div class="mt-1 text-xs" :class="over ? 'text-[#c50f1f] font-semibold' : 'text-ink-3'">
            {{ over ? `超出預算 ${fmtCost(budget.total - limit)}` : `還剩 ${fmtCost(limit - budget.total)}（已用 ${Math.round((budget.total / limit) * 100)}%）` }}
          </div>
        </template>
      </div>

      <p v-if="!budget.total" class="text-sm text-ink-3 leading-6">
        還沒有填任何花費。編輯地點時可以填「預估花費」（依地點類別歸類）與「到這裡的交通費」（車票、油錢等，計入交通）。
      </p>

      <template v-else>
        <!-- 依類別 -->
        <section>
          <h3 class="text-sm font-semibold mb-2">依類別</h3>
          <div class="space-y-1">
            <div v-for="g in budget.groups" :key="g.key">
              <button
                type="button"
                class="w-full flex items-center gap-2 py-1 text-left rounded cursor-pointer hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
                :disabled="!g.items.length"
                @click="toggle(g.key)"
              >
                <span class="w-5 text-center shrink-0">{{ g.emoji }}</span>
                <span class="w-20 shrink-0 text-sm" :class="g.amount ? '' : 'text-ink-4'">{{ g.label }}</span>
                <span class="flex-1 h-2 rounded-full bg-hover overflow-hidden">
                  <span class="block h-full rounded-full" :style="{ width: pct(g.amount), background: g.color }"></span>
                </span>
                <span class="w-20 shrink-0 text-right text-sm tabular-nums" :class="g.amount ? '' : 'text-ink-4'">{{ fmtCost(g.amount) || '—' }}</span>
                <span class="w-9 shrink-0 text-right text-xs text-ink-3 tabular-nums">{{ g.amount ? pct(g.amount) : '' }}</span>
                <Icon name="chevron-down" :size="12" class="shrink-0 text-ink-3 transition-transform" :class="[open[g.key] ? 'rotate-180' : '', g.items.length ? '' : 'invisible']" />
              </button>
              <ul v-if="open[g.key]" class="ml-7 mb-2 border-l border-line pl-3">
                <li v-for="(it, i) in g.items" :key="i">
                  <button type="button" class="w-full flex items-center gap-2 py-1 text-left cursor-pointer hover:bg-hover rounded" @click="$emit('edit', it.id, !!it.fare)">
                    <span class="flex-1 min-w-0">
                      <span class="block truncate text-sm">{{ it.label }}</span>
                      <span class="block text-[11px] text-ink-4">{{ it.sub }}</span>
                    </span>
                    <span class="text-sm tabular-nums shrink-0">{{ fmtCost(it.amount) }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 依日期 -->
        <section>
          <h3 class="text-sm font-semibold mb-2">依日期</h3>
          <div class="space-y-1">
            <div v-for="d in dayRows" :key="d.date || 'none'" class="flex items-center gap-2 py-0.5">
              <span class="size-2 rounded-full shrink-0" :style="{ background: d.color }"></span>
              <span class="w-28 shrink-0 text-sm truncate">{{ d.title }}<span v-if="d.subtitle" class="text-xs text-ink-3 ml-1">{{ d.subtitle.replace(/（.*）/, '') }}</span></span>
              <span class="flex-1 h-2 rounded-full bg-hover overflow-hidden">
                <span class="block h-full rounded-full" :style="{ width: pct(d.amount), background: d.color }"></span>
              </span>
              <span class="w-20 shrink-0 text-right text-sm tabular-nums" :class="d.amount ? '' : 'text-ink-4'">{{ fmtCost(d.amount) || '—' }}</span>
            </div>
          </div>
        </section>
      </template>
      <p v-if="budget.backup" class="text-xs text-ink-4">備選地點的花費（{{ fmtCost(budget.backup) }}）不計入總額。</p>
    </div>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import Icon from '@/components/Icon.vue';
import { computeBudget, fmtCost } from '@/utils/trip';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  trip: { type: Object, required: true },
  stops: { type: Array, required: true },
  days: { type: Array, required: true },
  memberCount: { type: Number, default: 1 },
});
// edit(stopId, isFare)：點明細開啟該地點編輯
const emit = defineEmits(['update:modelValue', 'save-budget', 'edit']);

const budget = computed(() => computeBudget(props.stops, props.days));
const limit = computed(() => props.trip.budget || 0);
const over = computed(() => limit.value > 0 && budget.value.total > limit.value);
const dayRows = computed(() => budget.value.days);
const pct = (v) => (budget.value.total ? `${Math.round((v / budget.value.total) * 100)}%` : '0%');

const open = reactive({});
const toggle = (key) => { open[key] = !open[key]; };

const limitInput = ref('');
watch(() => [props.modelValue, props.trip.budget], () => {
  limitInput.value = props.trip.budget ?? '';
}, { immediate: true });

function saveLimit() {
  const raw = String(limitInput.value).trim();
  const value = raw === '' ? null : Math.max(0, Math.round(Number(raw)));
  if (raw !== '' && !Number.isFinite(value)) return;
  if (value === (props.trip.budget ?? null)) return;
  emit('save-budget', value);
}
</script>
