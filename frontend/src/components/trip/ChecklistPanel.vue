<template>
  <div class="p-3 space-y-3">
    <div v-if="items.length" class="rounded-xl bg-white border border-line px-3 py-2.5">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="font-semibold">已完成 {{ doneCount }} / {{ items.length }}</span>
        <span class="text-ink-3">{{ countdown }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-hover overflow-hidden">
        <div class="h-full rounded-full bg-[#107c10] transition-all" :style="{ width: `${(doneCount / items.length) * 100}%` }"></div>
      </div>
    </div>

    <form class="flex gap-1.5" @submit.prevent="add">
      <select v-model="section" class="input select !w-[118px] shrink-0">
        <option v-for="s in CHECKLIST_SECTIONS" :key="s.key" :value="s.key">{{ s.emoji }} {{ s.label }}</option>
      </select>
      <input v-model="title" class="input flex-1 min-w-0" maxlength="100" placeholder="新增要準備的事情" />
      <button class="btn btn-primary !px-3 shrink-0" :disabled="!title.trim()">新增</button>
    </form>

    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-ink-3">常用清單</span>
      <button v-for="t in CHECKLIST_TEMPLATES" :key="t.key" class="btn btn-default !h-7 !rounded-full text-xs" @click="applyTemplate(t)">{{ t.emoji }} 加入{{ t.label }}</button>
    </div>

    <section v-for="g in groups" :key="g.key">
      <h4 class="flex items-center gap-1.5 text-xs font-semibold text-ink-3 mb-1 px-1">
        <span>{{ g.emoji }}</span>{{ g.label }}<span class="font-normal">{{ g.items.filter((x) => x.done).length }}/{{ g.items.length }}</span>
      </h4>
      <div class="rounded-xl bg-white border border-line divide-y divide-line overflow-hidden">
        <div v-for="it in g.items" :key="it.id" class="group flex items-center gap-2.5 px-3 min-h-11">
          <button
            class="size-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer"
            :class="it.done ? 'bg-[#107c10] border-[#107c10] text-white' : 'border-ink-4 hover:border-[#107c10]'"
            :title="it.done ? '標記為未完成' : '標記為完成'"
            @click="$emit('update', it, { done: !it.done })"
          >
            <Icon v-if="it.done" name="check" :size="12" :stroke="3" />
          </button>
          <input
            v-if="editingId === it.id"
            ref="editEl"
            v-model="editText"
            class="flex-1 min-w-0 h-8 px-1.5 -mx-1.5 rounded border border-accent text-sm outline-none"
            maxlength="100"
            @keydown.enter.prevent="commitEdit(it)"
            @keydown.esc="editingId = null"
            @blur="commitEdit(it)"
          />
          <span
            v-else
            class="flex-1 min-w-0 text-sm py-2 break-words cursor-text"
            :class="it.done ? 'line-through text-ink-4' : ''"
            @click="startEdit(it)"
          >{{ it.title }}</span>
          <Popover close-on-click placement="bottom-end">
            <template #trigger>
              <button class="shrink-0 cursor-pointer rounded-full" :title="assignee(it) ? `負責：${assignee(it).displayName}` : '指派負責人'">
                <Avatar v-if="assignee(it)" :user="assignee(it)" :size="24" />
                <span v-else class="size-6 rounded-full border border-dashed border-line-2 flex items-center justify-center text-ink-4 touch-show opacity-0 group-hover:opacity-100"><Icon name="user-plus" :size="12" /></span>
              </button>
            </template>
            <div class="px-3 pt-1 pb-0.5 text-[11px] text-ink-4">誰負責</div>
            <button class="menu-item" @click="$emit('update', it, { assigneeId: null })">
              <span class="w-4"><Icon v-if="!it.assigneeId" name="check" :size="14" class="text-accent" /></span>不指定
            </button>
            <button v-for="m in members" :key="m.id" class="menu-item" @click="$emit('update', it, { assigneeId: m.id })">
              <span class="w-4"><Icon v-if="it.assigneeId === m.id" name="check" :size="14" class="text-accent" /></span>
              <Avatar :user="m" :size="20" />{{ m.displayName }}
            </button>
          </Popover>
          <button class="icon-btn !size-7 shrink-0 touch-show opacity-0 group-hover:opacity-100" title="刪除" @click="$emit('delete', it)"><Icon name="x" :size="14" /></button>
        </div>
      </div>
    </section>

    <p v-if="!items.length" class="text-xs leading-5 text-ink-3 text-center px-4 py-4">
      列出出發前要準備的事情（護照、簽證、網卡、行李…），可以指派給成員，完成就打勾。
    </p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Popover from '@/components/Popover.vue';
import { diffDays } from '@/utils/planner';
import { todayInTaiwan } from '@/utils/weather';
import { CHECKLIST_SECTIONS, CHECKLIST_TEMPLATES } from '@/utils/tripPrep';

const props = defineProps({
  items: { type: Array, required: true },
  members: { type: Array, required: true },
  startDate: { type: String, default: '' },
});
const emit = defineEmits(['add', 'update', 'delete']);

const section = ref('docs');
const title = ref('');
const editingId = ref(null);
const editText = ref('');
const editEl = ref(null);

const doneCount = computed(() => props.items.filter((x) => x.done).length);
const groups = computed(() => CHECKLIST_SECTIONS
  .map((s) => ({ ...s, items: props.items.filter((x) => x.section === s.key) }))
  .filter((g) => g.items.length));
const assignee = (it) => props.members.find((m) => m.id === it.assigneeId) || null;
const countdown = computed(() => {
  if (!props.startDate) return '';
  const n = diffDays(props.startDate, todayInTaiwan());
  if (n > 0) return `距離出發還有 ${n} 天`;
  if (n === 0) return '今天出發！';
  return '';
});

function add() {
  const t = title.value.trim();
  if (!t) return;
  emit('add', [{ title: t, section: section.value }]);
  title.value = '';
}

function applyTemplate(t) {
  const have = new Set(props.items.map((x) => x.title));
  const items = t.items.filter(([, name]) => !have.has(name)).map(([sec, name]) => ({ section: sec, title: name }));
  emit('add', items, t.label);
}

async function startEdit(it) {
  editingId.value = it.id;
  editText.value = it.title;
  await nextTick();
  (Array.isArray(editEl.value) ? editEl.value[0] : editEl.value)?.focus();
}
function commitEdit(it) {
  if (editingId.value !== it.id) return;
  editingId.value = null;
  const t = editText.value.trim();
  if (t && t !== it.title) emit('update', it, { title: t });
}
</script>
