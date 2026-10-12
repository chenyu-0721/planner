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
            :class="!form.customCategoryId && form.category === c.key ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 hover:bg-hover'"
            @click="pickBuiltIn(c.key)"
          >
            <span>{{ c.emoji }}</span>{{ c.label }}
          </button>
          <button
            v-for="c in customCategories"
            :key="`custom-${c.id}`"
            type="button"
            class="flex items-center gap-1 h-8 px-2.5 rounded-full border text-sm cursor-pointer"
            :class="form.customCategoryId === c.id ? 'border-accent bg-accent-light text-accent font-semibold' : 'border-line-2 border-dashed hover:bg-hover'"
            :title="`自訂圖標，歸類為「${categoryInfo(c.baseCategory).label}」`"
            @click="pickCustom(c)"
          >
            <span>{{ c.emoji }}</span>{{ c.label }}
          </button>
          <button
            type="button"
            class="flex items-center gap-1 h-8 px-2.5 rounded-full border border-dashed border-line-2 text-sm text-accent cursor-pointer hover:bg-hover"
            @click="managerOpen = true"
          >
            <Icon name="plus" :size="14" />{{ customCategories.length ? '自訂 / 管理' : '自訂圖標' }}
          </button>
        </div>
      </div>

      <div>
        <label class="field-label">日期</label>
        <select v-model="form.date" class="input select">
          <option :value="null">未排入日期</option>
          <option v-for="d in days" :key="d.date" :value="d.date">{{ d.title }}・{{ d.subtitle }}</option>
        </select>
      </div>

      <div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">開始時間</label>
            <input v-model="form.startTime" type="time" class="input" :disabled="!form.date" />
          </div>
          <div>
            <label class="field-label">結束時間</label>
            <input v-model="form.endTime" type="time" class="input" :disabled="!form.date" :min="form.startTime || undefined" />
          </div>
        </div>
        <p v-if="!form.date" class="mt-1 text-xs text-ink-4">選擇日期後才能設定時間</p>
      </div>

      <div>
        <label class="field-label">地址</label>
        <input v-model="form.address" class="input" maxlength="200" />
      </div>

      <div class="-mt-2 flex items-center gap-2 text-xs text-ink-3">
        座標 {{ form.lat?.toFixed(5) }}, {{ form.lng?.toFixed(5) }}
        <a :href="googlePlaceUrl(form)" target="_blank" rel="noopener" class="text-accent hover:underline whitespace-nowrap">Google 地圖</a>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">預估花費</label>
          <input v-model="form.cost" type="number" min="0" step="1" class="input" placeholder="0" />
          <p class="mt-1 text-[11px] leading-4 text-ink-4">計入「{{ budgetGroupOf(form.category).label }}」</p>
        </div>
        <div>
          <label class="field-label">到這裡的交通費</label>
          <input ref="arriveCostEl" v-model="form.arriveCost" type="number" min="0" step="1" class="input" placeholder="0" />
          <p class="mt-1 text-[11px] leading-4 text-ink-4">從上一站過來的車票、油錢等，計入「交通」</p>
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
  <CategoryManager v-model="managerOpen" :base-category="form.category" @created="pickCustom" />
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import Modal from '../Modal.vue';
import Icon from '../Icon.vue';
import CategoryManager from './CategoryManager.vue';
import {
  CATEGORIES, categoryInfo, customCategories, googlePlaceUrl, budgetGroupOf,
} from '@/utils/trip';

const props = defineProps({
  modelValue: { type: Object, default: null }, // 編輯中的地點（新增時沒有 id）；focus: 'arriveCost' 時開啟後游標放在交通費
  days: { type: Array, required: true },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'save', 'delete']);

const form = reactive({});
const error = ref('');
const titleEl = ref(null);
const arriveCostEl = ref(null);
const managerOpen = ref(false);

function pickBuiltIn(key) {
  form.category = key;
  form.customCategoryId = null;
}
// 自訂圖標：歸類跟著圖標設定
function pickCustom(c) {
  form.category = c.baseCategory;
  form.customCategoryId = c.id;
}

watch(() => props.modelValue, async (v) => {
  if (!v) return;
  error.value = '';
  Object.assign(form, {
    id: v.id ?? null,
    title: v.title || '',
    category: v.category || 'sight',
    customCategoryId: customCategories.some((c) => c.id === v.customCategoryId) ? v.customCategoryId : null,
    date: v.date ?? null,
    startTime: v.startTime || '',
    endTime: v.endTime || '',
    address: v.address || '',
    cost: v.cost ?? '',
    arriveCost: v.arriveCost ?? '',
    notes: v.notes || '',
    lat: v.lat,
    lng: v.lng,
  });
  await nextTick();
  (v.focus === 'arriveCost' ? arriveCostEl : titleEl).value?.focus();
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
    arriveCost: form.arriveCost === '' ? null : Number(form.arriveCost),
  });
}
</script>
