<template>
  <Modal :model-value="!!modelValue" :title="form.id ? `編輯${kind.label}` : `新增${kind.label}`" width="520px" @update:model-value="$emit('update:modelValue', null)">
    <form v-if="modelValue" class="px-4 sm:px-6 pb-2 space-y-4" @submit.prevent="save">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="k in BOOKING_KINDS"
          :key="k.key"
          type="button"
          class="flex items-center gap-1 h-8 px-2.5 rounded-full border text-sm cursor-pointer"
          :class="form.kind === k.key ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 hover:bg-hover'"
          @click="form.kind = k.key"
        >
          <span>{{ k.emoji }}</span>{{ k.label }}
        </button>
      </div>

      <div>
        <label class="field-label">名稱</label>
        <input ref="titleEl" v-model="form.title" class="input" maxlength="100" :placeholder="kind.title" />
      </div>

      <div :class="kind.to ? 'grid grid-cols-2 gap-3' : ''">
        <div class="min-w-0">
          <label class="field-label">{{ kind.from.split('，')[0] }}</label>
          <input v-model="form.fromPlace" class="input" maxlength="200" :placeholder="kind.from.includes('，') ? kind.from.split('，')[1] : ''" />
        </div>
        <div v-if="kind.to" class="min-w-0">
          <label class="field-label">{{ kind.to.split('，')[0] }}</label>
          <input v-model="form.toPlace" class="input" maxlength="200" :placeholder="kind.to.includes('，') ? kind.to.split('，')[1] : ''" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="min-w-0">
          <label class="field-label">{{ kind.start }}（當地時間）</label>
          <div class="flex gap-1.5">
            <DateInput v-model="form.startDate" class="flex-1" :placeholder="kind.start" />
            <input v-model="form.startTime" type="time" class="input !w-[92px] shrink-0" :disabled="!form.startDate" />
          </div>
        </div>
        <div class="min-w-0">
          <label class="field-label">{{ kind.end }}（當地時間）</label>
          <div class="flex gap-1.5">
            <DateInput v-model="form.endDate" class="flex-1" :placeholder="kind.end" :min="form.startDate" />
            <input v-model="form.endTime" type="time" class="input !w-[92px] shrink-0" :disabled="!form.endDate" />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">訂位代號 / 確認碼</label>
          <input v-model="form.reference" class="input font-mono" maxlength="60" placeholder="例如 6XK2PQ" />
        </div>
        <div>
          <label class="field-label">金額</label>
          <div class="flex gap-1.5">
            <input v-model="form.cost" type="number" min="0" step="any" class="input flex-1 min-w-0" placeholder="0" />
            <CurrencySelect v-model="form.currency" class="!w-[96px] shrink-0" :follow-label="tripMoney.currency" />
          </div>
        </div>
      </div>

      <div>
        <label class="field-label">連結（訂單頁、電子票券）</label>
        <input v-model="form.url" class="input" maxlength="1000" placeholder="https://" inputmode="url" />
      </div>

      <div>
        <label class="field-label">備註</label>
        <textarea v-model="form.notes" rows="3" maxlength="1000" class="input !h-auto py-1.5 resize-y" placeholder="行李額度、航廈、入住須知…"></textarea>
      </div>
      <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>
    </form>
    <template #footer>
      <button v-if="form.id" class="btn btn-default !text-[#c50f1f] mr-auto" @click="$emit('delete', modelValue)"><Icon name="trash" :size="15" />刪除</button>
      <button class="btn btn-default" @click="$emit('update:modelValue', null)">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ form.id ? '儲存' : '新增' }}</button>
    </template>
  </Modal>
</template>

<script setup>
import {
  computed, nextTick, reactive, ref, watch,
} from 'vue';
import Modal from '../Modal.vue';
import Icon from '../Icon.vue';
import DateInput from '../DateInput.vue';
import CurrencySelect from './CurrencySelect.vue';
import { BOOKING_KINDS, bookingKind } from '@/utils/tripPrep';
import { tripMoney } from '@/utils/trip';

const props = defineProps({
  modelValue: { type: Object, default: null }, // 編輯中的預訂（新增時沒有 id，可帶 kind、startDate）
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'save', 'delete']);

const form = reactive({});
const error = ref('');
const titleEl = ref(null);
const kind = computed(() => bookingKind(form.kind));

watch(() => props.modelValue, async (v) => {
  if (!v) return;
  error.value = '';
  Object.assign(form, {
    id: v.id ?? null,
    kind: v.kind || 'flight',
    title: v.title || '',
    fromPlace: v.fromPlace || '',
    toPlace: v.toPlace || '',
    startDate: v.startAt?.slice(0, 10) || v.startDate || '',
    startTime: v.startAt?.slice(11, 16) || '',
    endDate: v.endAt?.slice(0, 10) || '',
    endTime: v.endAt?.slice(11, 16) || '',
    reference: v.reference || '',
    cost: v.cost ?? '',
    currency: v.currency || null,
    url: v.url || '',
    notes: v.notes || '',
  });
  await nextTick();
  titleEl.value?.focus();
});

// 沒填時間就只存日期
const joinAt = (date, time) => (date ? (time ? `${date}T${time}` : date) : null);
// 其中一邊沒有時間時只比日期
const endsBefore = (start, end) => {
  const n = start.length === end.length ? start.length : 10;
  return end.slice(0, n) < start.slice(0, n);
};

function save() {
  error.value = '';
  if (!form.title.trim()) {
    error.value = '請輸入名稱';
    return;
  }
  const startAt = joinAt(form.startDate, form.startTime);
  const endAt = joinAt(form.endDate, form.endTime);
  if (startAt && endAt && endsBefore(startAt, endAt)) {
    error.value = `${kind.value.end}時間不可早於${kind.value.start}時間`;
    return;
  }
  const url = form.url.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    error.value = '連結請以 http:// 或 https:// 開頭';
    return;
  }
  emit('save', {
    id: form.id,
    kind: form.kind,
    title: form.title.trim(),
    fromPlace: form.fromPlace.trim() || null,
    toPlace: kind.value.to ? form.toPlace.trim() || null : null,
    startAt,
    endAt,
    reference: form.reference.trim() || null,
    cost: form.cost === '' ? null : Number(form.cost),
    currency: form.currency || null,
    url: url || null,
    notes: form.notes || null,
  });
}
</script>
