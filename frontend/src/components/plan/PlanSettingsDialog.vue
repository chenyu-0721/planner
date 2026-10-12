<template>
  <Modal :model-value="modelValue" title="計劃設定" width="560px" @update:model-value="$emit('update:modelValue', $event)">
    <div class="px-6 pb-2">
      <div class="flex gap-1 border-b border-line mb-4">
        <button v-for="t in tabs" :key="t.key" class="px-3 h-9 text-sm cursor-pointer -mb-px border-b-2"
                :class="tab === t.key ? 'border-accent font-semibold' : 'border-transparent text-ink-3 hover:text-ink'"
                @click="tab = t.key">{{ t.label }}</button>
      </div>

      <div v-if="tab === 'general'" class="space-y-4">
        <div class="flex items-center gap-4">
          <PlanIcon :plan="{ name: form.name || '計劃', color: form.color }" :size="56" />
          <div class="flex-1">
            <label class="field-label">計劃名稱</label>
            <input v-model="form.name" class="input" maxlength="100" />
          </div>
        </div>
        <div>
          <label class="field-label">描述</label>
          <textarea v-model="form.description" maxlength="500" rows="3" class="input !h-auto py-1.5 resize-none"></textarea>
        </div>
        <div>
          <label class="field-label">色彩</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="(c, i) in PLAN_COLORS" :key="c" type="button" class="size-7 rounded cursor-pointer flex items-center justify-center text-white"
                    :style="{ background: c }" @click="form.color = i">
              <Icon v-if="form.color === i" name="check" :size="16" :stroke="2.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="max-h-[50vh] overflow-y-auto thin-scroll -mx-2 px-2">
        <p class="text-xs text-ink-3 mb-2">為標籤命名，讓團隊了解每個色彩代表的意義。</p>
        <div v-for="l in LABELS" :key="l.id" class="flex items-center gap-3 h-10">
          <span class="w-24 shrink-0"><LabelPill :id="l.id" :label-names="{}" /></span>
          <input v-model="form.labelNames[l.id]" class="input" :placeholder="l.name" maxlength="50" />
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn btn-default" @click="$emit('update:modelValue', false)">取消</button>
      <button class="btn btn-primary" :disabled="!form.name.trim() || saving" @click="save">儲存</button>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import Modal from '../Modal.vue';
import Icon from '../Icon.vue';
import PlanIcon from '../PlanIcon.vue';
import LabelPill from '../LabelPill.vue';
import { LABELS, PLAN_COLORS } from '@/utils/planner';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({ modelValue: Boolean, initialTab: { type: String, default: 'general' } });
const emit = defineEmits(['update:modelValue']);
const planStore = usePlanStore();
const ui = useUiStore();

const tabs = [{ key: 'general', label: '一般' }, { key: 'labels', label: '標籤' }];
const tab = ref('general');
const saving = ref(false);
const form = reactive({ name: '', description: '', color: 0, labelNames: {} });

watch(() => props.modelValue, (v) => {
  if (!v || !planStore.plan) return;
  tab.value = props.initialTab;
  const p = planStore.plan;
  Object.assign(form, {
    name: p.name, description: p.description || '', color: p.color, labelNames: { ...(p.labelNames || {}) },
  });
});

async function save() {
  saving.value = true;
  try {
    const labelNames = Object.fromEntries(Object.entries(form.labelNames).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim()]));
    await planStore.updatePlan({ ...form, labelNames });
    ui.toast('已儲存計劃設定', 'success');
    emit('update:modelValue', false);
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}
</script>
