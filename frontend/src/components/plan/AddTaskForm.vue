<template>
  <div class="bg-white rounded-md card-shadow-hover p-3 space-y-2 min-w-0 overflow-hidden" @keydown.esc="$emit('close')">
    <input
      ref="titleEl"
      v-model="title"
      class="input"
      placeholder="輸入工作名稱"
      maxlength="200"
      @keydown.enter.prevent="submit"
    />
    <DateInput v-model="dueDate" icon placeholder="到期日" display-class="text-ink-2" />
    <Popover block>
      <template #trigger>
        <button class="w-full min-w-0 flex items-center gap-2 h-8 px-2 rounded border border-line-2 hover:border-ink-4 text-sm text-ink-2 cursor-pointer overflow-hidden">
          <template v-if="assigneeIds.length">
            <div class="flex -space-x-1.5 shrink-0">
              <Avatar v-for="u in assigneeUsers.slice(0, 3)" :key="u.id" :user="u" :size="20" ring />
            </div>
            <span class="min-w-0 flex-1 truncate text-left">{{ assigneeUsers.map((u) => u.displayName).join('、') }}</span>
          </template>
          <template v-else><Icon name="user-plus" :size="15" class="shrink-0 text-ink-3" />指派</template>
        </button>
      </template>
      <AssigneePicker v-model="assigneeIds" :members="planStore.members" />
    </Popover>
    <button class="btn btn-primary w-full" :disabled="!title.trim() || saving" @click="submit">新增工作</button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from '../Icon.vue';
import Avatar from '../Avatar.vue';
import DateInput from '../DateInput.vue';
import Popover from '../Popover.vue';
import AssigneePicker from '../AssigneePicker.vue';
import { usePlanStore } from '@/stores/plan';
import { useUiStore } from '@/stores/ui';

const props = defineProps({
  // 依群組帶入的預設值，例如 { bucketId }、{ progress }、{ assigneeIds }
  defaults: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['close', 'created']);
const planStore = usePlanStore();
const ui = useUiStore();

const title = ref('');
const dueDate = ref(props.defaults.dueDate || '');
const assigneeIds = ref([...(props.defaults.assigneeIds || [])]);
const saving = ref(false);
const titleEl = ref(null);

const assigneeUsers = computed(() => assigneeIds.value.map((id) => planStore.memberMap[id]).filter(Boolean));

async function submit() {
  if (!title.value.trim() || saving.value) return;
  saving.value = true;
  try {
    const task = await planStore.createTask({
      ...props.defaults,
      title: title.value,
      dueDate: dueDate.value || null,
      assigneeIds: assigneeIds.value,
    });
    emit('created', task);
    title.value = '';
    titleEl.value?.focus();
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}

onMounted(() => titleEl.value?.focus());
</script>
