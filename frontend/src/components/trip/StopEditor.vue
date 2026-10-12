<template>
  <Modal :model-value="!!modelValue" :title="form.id ? '編輯地點' : '新增地點'" width="520px" @update:model-value="$emit('update:modelValue', null)">
    <form v-if="modelValue" class="px-4 sm:px-6 pb-2 space-y-4" @submit.prevent="save">
      <div>
        <label class="field-label">地點名稱</label>
        <input ref="titleEl" v-model="form.title" class="input" maxlength="100" placeholder="例如：淺草寺" />
      </div>

      <div>
        <label class="field-label">圖標</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="c in CATEGORIES"
            :key="c.key"
            type="button"
            class="flex items-center gap-1 h-8 px-2.5 rounded-full border text-sm cursor-pointer"
            :class="form.category === c.key ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 hover:bg-hover'"
            @click="form.category = c.key"
          >
            <span>{{ c.emoji }}</span>{{ c.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="col-span-2 sm:col-span-1">
          <label class="field-label">日期</label>
          <select v-model="form.date" class="input select">
            <option :value="null">未排入日期</option>
            <option v-for="d in days" :key="d.date" :value="d.date">{{ d.title }}　{{ d.subtitle }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">開始時間</label>
          <input v-model="form.startTime" type="time" class="input" :disabled="!form.date" />
        </div>
        <div>
          <label class="field-label">結束時間</label>
          <input v-model="form.endTime" type="time" class="input" :disabled="!form.date" :min="form.startTime || undefined" />
        </div>
      </div>

      <div>
        <label class="field-label">地址</label>
        <input v-model="form.address" class="input" maxlength="200" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">預估花費</label>
          <input v-model="form.cost" type="number" min="0" step="1" class="input" placeholder="0" />
        </div>
        <div>
          <label class="field-label">座標</label>
          <div class="h-8 flex items-center gap-2 text-xs text-ink-3">
            {{ form.lat?.toFixed(5) }}, {{ form.lng?.toFixed(5) }}
            <a :href="googlePlaceUrl(form)" target="_blank" rel="noopener" class="text-accent hover:underline whitespace-nowrap">Google 地圖</a>
          </div>
        </div>
      </div>

      <div>
        <label class="field-label">備註</label>
        <textarea v-model="form.notes" rows="3" maxlength="1000" class="input !h-auto py-1.5 resize-y" placeholder="交通方式、訂位資訊、注意事項…"></textarea>
      </div>

      <p class="text-xs text-ink-4">提示：可以直接在地圖上拖曳圖標調整位置；設定開始時間後，會自動依時間排序。</p>
      <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>
    </form>
    <template #footer>
      <button v-if="form.id" class="btn btn-default !text-[#c50f1f] mr-auto" @click="$emit('delete', modelValue)"><Icon name="trash" :size="15" />刪除</button>
      <button class="btn btn-default" @click="$emit('update:modelValue', null)">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ form.id ? '儲存' : '加入行程' }}</button>
    </template>
  </Modal>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import Modal from '../Modal.vue';
import Icon from '../Icon.vue';
import { CATEGORIES, googlePlaceUrl } from '@/utils/trip';

const props = defineProps({
  modelValue: { type: Object, default: null }, // 編輯中的地點（新增時沒有 id）
  days: { type: Array, required: true },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'save', 'delete']);

const form = reactive({});
const error = ref('');
const titleEl = ref(null);

watch(() => props.modelValue, async (v) => {
  if (!v) return;
  error.value = '';
  Object.assign(form, {
    id: v.id ?? null,
    title: v.title || '',
    category: v.category || 'sight',
    date: v.date ?? null,
    startTime: v.startTime || '',
    endTime: v.endTime || '',
    address: v.address || '',
    cost: v.cost ?? '',
    notes: v.notes || '',
    lat: v.lat,
    lng: v.lng,
  });
  await nextTick();
  titleEl.value?.focus();
});

function save() {
  error.value = '';
  if (!form.title.trim()) {
    error.value = '請輸入地點名稱';
    return;
  }
  if (form.startTime && form.endTime && form.endTime < form.startTime) {
    error.value = '結束時間不可早於開始時間';
    return;
  }
  emit('save', {
    ...form,
    title: form.title.trim(),
    startTime: form.date ? form.startTime || null : null,
    endTime: form.date ? form.endTime || null : null,
    cost: form.cost === '' ? null : Number(form.cost),
  });
}
</script>
