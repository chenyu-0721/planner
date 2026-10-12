<template>
  <Modal :model-value="modelValue" :title="trip ? '行程設定' : '新增行程'" width="520px" @update:model-value="$emit('update:modelValue', $event)">
    <form class="px-4 sm:px-6 pb-2 space-y-4" @submit.prevent="save">
      <div class="flex items-center gap-4">
        <TripIcon :color="form.color" :size="56" />
        <div class="flex-1">
          <label class="field-label">行程名稱</label>
          <input ref="nameEl" v-model="form.name" class="input" maxlength="100" placeholder="例如：東京五日遊" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">開始日期</label>
          <input v-model="form.startDate" type="date" class="input" />
        </div>
        <div>
          <label class="field-label">結束日期</label>
          <input v-model="form.endDate" type="date" class="input" :min="form.startDate || undefined" />
        </div>
      </div>
      <p v-if="trip && shrinking" class="text-xs text-[#986f0b] bg-[#fff8e5] rounded px-2.5 py-1.5">
        縮短日期後，超出範圍的地點會移到「備選清單」，不會被刪除。
      </p>
      <div>
        <label class="field-label">描述（選用）</label>
        <textarea v-model="form.description" rows="3" maxlength="500" class="input !h-auto py-1.5 resize-none"></textarea>
      </div>
      <div>
        <label class="field-label">色彩</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(c, i) in PLAN_COLORS"
            :key="c"
            type="button"
            class="size-7 rounded cursor-pointer flex items-center justify-center text-white"
            :style="{ background: c }"
            @click="form.color = i"
          >
            <Icon v-if="form.color === i" name="check" :size="16" :stroke="2.5" />
          </button>
        </div>
      </div>
      <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>
    </form>
    <template #footer>
      <button class="btn btn-default" @click="$emit('update:modelValue', false)">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ trip ? '儲存' : '建立行程' }}</button>
    </template>
  </Modal>
</template>

<script setup>
import {
  computed, nextTick, reactive, ref, watch,
} from 'vue';
import Modal from '../Modal.vue';
import Icon from '../Icon.vue';
import TripIcon from './TripIcon.vue';
import api from '@/api';
import { PLAN_COLORS, addDays, diffDays, todayStr } from '@/utils/planner';

const props = defineProps({
  modelValue: Boolean,
  trip: { type: Object, default: null }, // 有值 = 編輯
});
const emit = defineEmits(['update:modelValue', 'saved']);

const form = reactive({});
const error = ref('');
const saving = ref(false);
const nameEl = ref(null);

const shrinking = computed(() => props.trip
  && (form.startDate > props.trip.startDate || form.endDate < props.trip.endDate));

watch(() => props.modelValue, async (v) => {
  if (!v) return;
  error.value = '';
  const t = props.trip;
  Object.assign(form, {
    name: t?.name || '',
    description: t?.description || '',
    startDate: t?.startDate || addDays(todayStr(), 7),
    endDate: t?.endDate || addDays(todayStr(), 9),
    color: t?.color ?? Math.floor(Math.random() * PLAN_COLORS.length),
  });
  await nextTick();
  nameEl.value?.focus();
});

async function save() {
  error.value = '';
  if (!form.name.trim()) error.value = '請輸入行程名稱';
  else if (!form.startDate || !form.endDate) error.value = '請設定開始與結束日期';
  else if (form.endDate < form.startDate) error.value = '結束日期不可早於開始日期';
  else if (diffDays(form.endDate, form.startDate) + 1 > 60) error.value = '行程最多 60 天';
  if (error.value) return;
  saving.value = true;
  try {
    const data = { ...form, name: form.name.trim() };
    const res = props.trip ? await api.put(`/trips/${props.trip.id}`, data) : await api.post('/trips', data);
    emit('saved', res);
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>
