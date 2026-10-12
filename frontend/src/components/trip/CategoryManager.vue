<template>
  <Modal :model-value="modelValue" :title="editingId ? '編輯自訂圖標' : '新增自訂圖標'" width="480px" :z-index="60" @update:model-value="close">
    <div v-if="modelValue" class="px-4 sm:px-6 pb-2 space-y-4">
      <div class="flex items-end gap-3">
        <div class="size-14 shrink-0 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,.3)] bg-white flex items-center justify-center text-2xl">
          {{ form.emoji || '❔' }}
        </div>
        <div class="flex-1 min-w-0">
          <label class="field-label">名稱</label>
          <input ref="labelEl" v-model="form.label" class="input" maxlength="20" placeholder="例如：咖啡廳、溫泉、夜市" @keydown.enter.prevent="save" />
        </div>
      </div>

      <div>
        <label class="field-label">圖標</label>
        <div class="grid grid-cols-8 sm:grid-cols-12 gap-1">
          <button
            v-for="e in EMOJIS"
            :key="e"
            type="button"
            class="aspect-square rounded text-xl flex items-center justify-center cursor-pointer hover:bg-hover"
            :class="form.emoji === e ? 'bg-accent-light ring-2 ring-accent' : ''"
            @click="form.emoji = e"
          >
            {{ e }}
          </button>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <input v-model="form.emoji" class="input !w-24 text-center text-lg" maxlength="16" placeholder="😀" />
          <span class="text-xs text-ink-4 leading-4">也可以貼上任何 emoji（Windows 按 Win + .，手機用表情符號鍵盤）</span>
        </div>
      </div>

      <div>
        <label class="field-label">歸類</label>
        <select v-model="form.baseCategory" class="input select">
          <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.emoji }} {{ c.label }}（預算：{{ budgetGroupOf(c.key).label }}）</option>
        </select>
        <p class="mt-1 text-[11px] leading-4 text-ink-4">決定花費計入哪個預算類別，以及自動排時間時預設停留多久</p>
      </div>

      <p v-if="error" class="text-sm text-[#c50f1f]">{{ error }}</p>

      <section v-if="customCategories.length" class="border-t border-line pt-3">
        <h3 class="text-xs font-semibold text-ink-3 mb-1">已建立的自訂圖標（所有人共用）</h3>
        <ul class="max-h-48 overflow-y-auto thin-scroll -mx-1">
          <li v-for="c in customCategories" :key="c.id" class="group flex items-center gap-2 h-9 px-1 rounded hover:bg-hover" :class="editingId === c.id ? 'bg-accent-light' : ''">
            <span class="text-lg w-6 text-center">{{ c.emoji }}</span>
            <span class="flex-1 min-w-0 truncate text-sm">{{ c.label }}<span class="text-xs text-ink-4 ml-1.5">{{ categoryInfo(c.baseCategory).label }}</span></span>
            <template v-if="canEdit(c)">
              <button type="button" class="icon-btn !size-7" title="編輯" @click="startEdit(c)"><Icon name="pencil" :size="13" /></button>
              <button type="button" class="icon-btn !size-7" title="刪除" @click="remove(c)"><Icon name="trash" :size="13" /></button>
            </template>
          </li>
        </ul>
      </section>
    </div>
    <template #footer>
      <button v-if="editingId" class="btn btn-default mr-auto" @click="reset">改為新增</button>
      <button class="btn btn-default" @click="close">關閉</button>
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ editingId ? '儲存' : '新增並使用' }}</button>
    </template>
  </Modal>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import Modal from '@/components/Modal.vue';
import Icon from '@/components/Icon.vue';
import api from '@/api';
import {
  CATEGORIES, categoryInfo, budgetGroupOf, customCategories, setCustomCategories,
} from '@/utils/trip';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  baseCategory: { type: String, default: 'other' }, // 新增時預設的歸類（編輯中地點目前的類別）
});
// created(category)：新增完成，由地點編輯器直接選用
const emit = defineEmits(['update:modelValue', 'created']);

const EMOJIS = [
  '☕', '🧋', '🍰', '🍦', '🍺', '🍣', '🍱', '🥟', '🍲', '🍜', '🍔', '🥐',
  '⛩️', '🏯', '🏛️', '⛪', '🗼', '🏰', '🎢', '🎨', '🖼️', '📸', '🌸', '🎵',
  '🏖️', '⛰️', '🌊', '🏕️', '♨️', '🌳', '🌅', '🐟', '🐶', '🦁', '🎣', '⛳',
  '🚌', '🚕', '⛴️', '✈️', '🚲', '⛽', '🅿️', '🚻', '🛒', '🎁', '💊', '⭐',
];

const auth = useAuthStore();
const ui = useUiStore();
const form = reactive({ emoji: '', label: '', baseCategory: 'other' });
const editingId = ref(null);
const saving = ref(false);
const error = ref('');
const labelEl = ref(null);

const canEdit = (c) => auth.user?.role === 'admin' || c.createdById === auth.user?.id;

function reset() {
  editingId.value = null;
  error.value = '';
  Object.assign(form, { emoji: '', label: '', baseCategory: props.baseCategory || 'other' });
}

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  reset();
  await nextTick();
  labelEl.value?.focus();
});

function startEdit(c) {
  editingId.value = c.id;
  error.value = '';
  Object.assign(form, { emoji: c.emoji, label: c.label, baseCategory: c.baseCategory });
}

function close() {
  emit('update:modelValue', false);
}

async function save() {
  error.value = '';
  const payload = { emoji: form.emoji.trim(), label: form.label.trim(), baseCategory: form.baseCategory };
  if (!payload.label) {
    error.value = '請輸入名稱';
    return;
  }
  if (!payload.emoji) {
    error.value = '請選擇圖標';
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      const updated = await api.put(`/stop-categories/${editingId.value}`, payload);
      setCustomCategories(customCategories.map((c) => (c.id === updated.id ? updated : c)));
      ui.toast('已更新圖標', 'success');
      reset();
    } else {
      const created = await api.post('/stop-categories', payload);
      setCustomCategories([...customCategories, created]);
      emit('created', created);
      close();
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(c) {
  const ok = await ui.confirm({ title: '刪除自訂圖標', message: `確定要刪除「${c.emoji} ${c.label}」嗎？\n使用這個圖標的地點會改回「${categoryInfo(c.baseCategory).label}」的圖標。` });
  if (!ok) return;
  try {
    await api.delete(`/stop-categories/${c.id}`);
    setCustomCategories(customCategories.filter((x) => x.id !== c.id));
    if (editingId.value === c.id) reset();
  } catch (e) {
    ui.error(e);
  }
}
</script>
