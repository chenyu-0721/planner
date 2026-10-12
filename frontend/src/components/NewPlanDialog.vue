<template>
  <Modal :model-value="ui.newPlanOpen" title="新增計劃" width="520px" @update:model-value="close">
    <form class="px-6 pb-2 space-y-4" @submit.prevent="submit">
      <div class="flex items-center gap-4">
        <PlanIcon :plan="{ name: name || '計劃', color }" :size="56" />
        <div class="flex-1">
          <label class="field-label">計劃名稱</label>
          <input ref="nameEl" v-model="name" class="input" placeholder="為計劃命名" maxlength="150" />
        </div>
      </div>
      <div>
        <label class="field-label">描述（選用）</label>
        <textarea v-model="description" rows="3" class="input !h-auto py-1.5 resize-none" placeholder="這個計劃是關於什麼？"></textarea>
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
            @click="color = i"
          >
            <Icon v-if="color === i" name="check" :size="16" :stroke="2.5" />
          </button>
        </div>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-default" @click="close">取消</button>
      <button class="btn btn-primary" :disabled="!name.trim() || saving" @click="submit">建立計劃</button>
    </template>
  </Modal>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import PlanIcon from './PlanIcon.vue';
import { PLAN_COLORS } from '@/utils/planner';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';

const ui = useUiStore();
const plans = usePlansStore();
const router = useRouter();
const name = ref('');
const description = ref('');
const color = ref(0);
const saving = ref(false);
const nameEl = ref(null);

watch(() => ui.newPlanOpen, async (v) => {
  if (v) {
    name.value = '';
    description.value = '';
    color.value = Math.floor(Math.random() * PLAN_COLORS.length);
    await nextTick();
    nameEl.value?.focus();
  }
});

function close() {
  ui.newPlanOpen = false;
}

async function submit() {
  if (!name.value.trim() || saving.value) return;
  saving.value = true;
  try {
    const plan = await plans.create({ name: name.value, description: description.value, color: color.value });
    close();
    router.push(`/plans/${plan.id}/board`);
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}
</script>
