<template>
  <div class="w-64">
    <div class="px-2 pt-1 pb-1.5">
      <input ref="searchEl" v-model="keyword" class="input" placeholder="輸入名稱搜尋" @click.stop />
    </div>
    <div class="max-h-64 overflow-y-auto thin-scroll">
      <div v-if="selected.length && !keyword" class="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink-3">已指派</div>
      <button v-for="m in selected" v-show="!keyword" :key="'s' + m.id" class="menu-item !h-10" @click="toggle(m.id)">
        <Avatar :user="m" :size="26" />
        <span class="flex-1 truncate">{{ m.displayName }}</span>
        <Icon name="x" :size="14" class="text-ink-3" />
      </button>
      <div class="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink-3">{{ keyword ? '搜尋結果' : '計劃成員' }}</div>
      <button v-for="m in candidates" :key="m.id" class="menu-item !h-10" @click="toggle(m.id)">
        <Avatar :user="m" :size="26" />
        <span class="flex-1 truncate">{{ m.displayName }}</span>
        <Icon v-if="modelValue.includes(m.id)" name="check" :size="16" class="text-accent" />
      </button>
      <div v-if="!candidates.length" class="px-3 py-2 text-sm text-ink-3">找不到成員</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import Avatar from './Avatar.vue';

const props = defineProps({
  members: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);
const keyword = ref('');
const searchEl = ref(null);

const selected = computed(() => props.members.filter((m) => props.modelValue.includes(m.id)));
const candidates = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return props.members.filter((m) => (kw
    ? m.displayName.toLowerCase().includes(kw) || m.username.toLowerCase().includes(kw)
    : !props.modelValue.includes(m.id)));
});

function toggle(id) {
  const ids = props.modelValue.includes(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id];
  emit('update:modelValue', ids);
}

onMounted(() => searchEl.value?.focus());
</script>
