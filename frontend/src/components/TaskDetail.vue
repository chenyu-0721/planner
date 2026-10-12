<template>
  <Modal :model-value="!!ui.detail" width="700px" @update:model-value="close">
    <template v-if="task" #header>
      <div class="flex items-center gap-2 text-sm text-ink-3 min-w-0">
        <PlanIcon :plan="planStore.plan" :size="20" />
        <router-link :to="`/plans/${task.planId}`" class="truncate hover:underline" @click="close">{{ planStore.plan?.name }}</router-link>
      </div>
    </template>

    <div v-if="loading && !task" class="px-6 py-16 text-center text-ink-3">載入中…</div>
    <div v-else-if="task" class="px-6 pb-6">
      <!-- 標題 -->
      <div class="flex items-start gap-2 mb-1">
        <button class="mt-2 cursor-pointer" :title="done ? '標示為未完成' : '標示為完成'" @click="save({ progress: done ? 0 : 100 })">
          <ProgressIcon :value="done ? 100 : 0" :size="22" />
        </button>
        <textarea
          ref="titleEl"
          v-model="title"
          rows="1"
          maxlength="255"
          class="flex-1 resize-none overflow-hidden text-xl font-semibold leading-7 px-2 py-1.5 rounded border border-transparent hover:border-line-2 focus:border-accent outline-none"
          :class="done ? 'line-through text-ink-3' : ''"
          @input="autoGrow"
          @keydown.enter.prevent="$event.target.blur()"
          @blur="saveTitle"
        ></textarea>
        <Popover placement="bottom-end" close-on-click>
          <template #trigger>
            <button class="icon-btn mt-1" title="更多選項"><Icon name="more" :size="18" /></button>
          </template>
          <button class="menu-item" @click="toggleMyDay"><Icon name="sun" />{{ task.inMyDay ? '從「我的一天」移除' : '新增至「我的一天」' }}</button>
          <button class="menu-item" @click="copyLink"><Icon name="link" />複製工作連結</button>
          <div class="border-t border-line my-1"></div>
          <button class="menu-item !text-[#c50f1f]" @click="remove"><Icon name="trash" />刪除</button>
        </Popover>
      </div>

      <div class="ml-8 text-xs text-ink-4 mb-4">
        <template v-if="done && task.completedAt">由 {{ userName(task.completedById) }} 於 {{ fmtDateTime(task.completedAt) }} 完成 · </template>
        由 {{ userName(task.createdById) }} 於 {{ fmtDateTime(task.createdAt) }} 建立
      </div>

      <!-- 指派 -->
      <div class="flex items-center flex-wrap gap-2 mb-3">
        <div v-for="u in assignees" :key="u.id" class="group/as flex items-center gap-1.5 h-8 pl-0.5 pr-2 rounded-full bg-hover">
          <Avatar :user="u" :size="28" />
          <span class="text-sm">{{ u.displayName }}</span>
          <button class="text-ink-3 hover:text-ink cursor-pointer" title="移除指派" @click="save({ assigneeIds: task.assigneeIds.filter((id) => id !== u.id) })">
            <Icon name="x" :size="13" />
          </button>
        </div>
        <Popover>
          <template #trigger>
            <button class="btn btn-ghost !px-2"><Icon name="user-plus" :size="16" />指派</button>
          </template>
          <AssigneePicker :model-value="task.assigneeIds" :members="planStore.members" @update:model-value="(ids) => save({ assigneeIds: ids })" />
        </Popover>
      </div>

      <!-- 標籤 -->
      <div class="flex items-center flex-wrap gap-1.5 mb-5">
        <LabelPill v-for="l in task.labels" :key="l" :id="l" :label-names="planStore.plan?.labelNames" removable
                   @remove="save({ labels: task.labels.filter((x) => x !== l) })" />
        <Popover>
          <template #trigger>
            <button class="btn btn-ghost !px-2 !h-7 text-sm"><Icon name="tag" :size="15" />新增標籤</button>
          </template>
          <LabelPicker
            :model-value="task.labels"
            :label-names="planStore.plan?.labelNames"
            @update:model-value="(ids) => save({ labels: ids })"
            @rename="renameLabel"
          />
        </Popover>
      </div>

      <!-- 欄位 -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label class="field-label">貯體</label>
          <select class="input select" :value="task.bucketId" @change="save({ bucketId: Number($event.target.value) })">
            <option v-for="b in planStore.sortedBuckets" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div>
          <label class="field-label">進度</label>
          <div class="relative">
            <span class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><ProgressIcon :value="task.progress" :size="14" /></span>
            <select class="input select !pl-7" :value="task.progress" @change="save({ progress: Number($event.target.value) })">
              <option v-for="p in PROGRESS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-label">優先順序</label>
          <div class="relative">
            <span class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><PriorityIcon :value="task.priority" show-medium /></span>
            <select class="input select !pl-7" :value="task.priority" @change="save({ priority: Number($event.target.value) })">
              <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="field-label">開始日期</label>
          <input type="date" class="input" :value="task.startDate || ''" :max="task.dueDate || undefined" @change="save({ startDate: $event.target.value || null })" />
        </div>
        <div>
          <label class="field-label">到期日</label>
          <input type="date" class="input" :class="late ? '!text-[#c50f1f] !border-[#c50f1f]' : ''" :value="task.dueDate || ''" :min="task.startDate || undefined"
                 @change="save({ dueDate: $event.target.value || null })" />
        </div>
      </div>

      <!-- 附註 -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-1">
          <label class="field-label !mb-0">附註</label>
          <label class="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" class="accent-accent" :checked="task.previewType === 'description'" @change="setPreview('description', $event.target.checked)" />
            在卡片上顯示
          </label>
        </div>
        <textarea v-model="notes" rows="4" class="input !h-auto py-2 resize-y min-h-20" placeholder="輸入描述或新增附註" @blur="saveNotes"></textarea>
      </div>

      <!-- 檢查清單 -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-1.5">
          <label class="field-label !mb-0">檢查清單 <span v-if="task.checklist.length" class="font-normal">{{ checkedCount }}/{{ task.checklist.length }}</span></label>
          <label class="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" class="accent-accent" :checked="task.previewType === 'checklist' || (task.previewType === 'automatic' && task.checklist.length > 0)"
                   @change="setPreview('checklist', $event.target.checked)" />
            在卡片上顯示
          </label>
        </div>
        <draggable :model-value="sortedChecklist" item-key="id" handle=".ck-handle" :animation="150" ghost-class="drag-ghost" @change="onChecklistMove">
          <template #item="{ element: c }">
            <div class="group/ck flex items-center gap-2 h-9 px-1 rounded hover:bg-hover">
              <span class="ck-handle cursor-grab text-ink-4 opacity-0 group-hover/ck:opacity-100"><Icon name="move" :size="12" /></span>
              <input type="checkbox" class="size-4 accent-accent cursor-pointer" :checked="c.isChecked" @change="updateItem(c, { isChecked: $event.target.checked })" />
              <input
                class="flex-1 bg-transparent outline-none text-sm border-b border-transparent focus:border-accent"
                :class="c.isChecked ? 'line-through text-ink-4' : ''"
                :value="c.title"
                @keydown.enter="$event.target.blur()"
                @blur="($event.target.value.trim() && $event.target.value.trim() !== c.title) && updateItem(c, { title: $event.target.value.trim() })"
              />
              <button class="icon-btn !size-7 opacity-0 group-hover/ck:opacity-100" title="刪除" @click="removeItem(c)"><Icon name="x" :size="14" /></button>
            </div>
          </template>
        </draggable>
        <div class="flex items-center gap-2 h-9 px-1">
          <span class="w-3"></span>
          <span class="size-4 rounded-full border border-ink-4 shrink-0"></span>
          <input v-model="newItem" class="flex-1 outline-none text-sm border-b border-transparent focus:border-accent placeholder:text-ink-4" placeholder="新增項目" maxlength="255" @keydown.enter="addItem" />
        </div>
      </div>

      <!-- 附件 -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-1.5">
          <label class="field-label !mb-0">附件</label>
        </div>
        <div v-if="task.attachments.length" class="space-y-1 mb-2">
          <div v-for="a in task.attachments" :key="a.id" class="group/at flex items-center gap-2 h-10 px-2 rounded border border-line hover:bg-hover">
            <Icon :name="a.type === 'link' ? 'link' : a.mimeType?.startsWith('image/') ? 'image' : 'file'" :size="16" class="text-ink-3" />
            <a :href="a.url" target="_blank" rel="noopener" class="flex-1 truncate text-sm text-accent hover:underline">{{ a.name }}</a>
            <label v-if="a.mimeType?.startsWith('image/')" class="flex items-center gap-1 text-xs text-ink-3 cursor-pointer">
              <input type="checkbox" class="accent-accent" :checked="task.previewType === 'reference'" @change="setPreview('reference', $event.target.checked)" />
              在卡片上顯示
            </label>
            <button class="icon-btn !size-7 opacity-0 group-hover/at:opacity-100" title="移除附件" @click="removeAttachment(a)"><Icon name="trash" :size="14" /></button>
          </div>
        </div>
        <div v-if="linkForm" class="flex flex-col gap-2 p-3 rounded border border-line mb-2">
          <input v-model="linkForm.url" v-focus class="input" placeholder="連結網址，例如 https://www.example.com" />
          <input v-model="linkForm.name" class="input" placeholder="要顯示的文字（選用）" @keydown.enter="addLink" />
          <div class="flex justify-end gap-2">
            <button class="btn btn-default" @click="linkForm = null">取消</button>
            <button class="btn btn-primary" :disabled="!linkForm.url.trim()" @click="addLink">儲存</button>
          </div>
        </div>
        <Popover close-on-click>
          <template #trigger>
            <button class="btn btn-ghost !px-2" :disabled="uploading"><Icon name="paperclip" :size="15" />{{ uploading ? '上傳中…' : '新增附件' }}</button>
          </template>
          <button class="menu-item" @click="fileEl.click()"><Icon name="upload" />檔案</button>
          <button class="menu-item" @click="linkForm = { url: '', name: '' }"><Icon name="link" />連結</button>
        </Popover>
        <input ref="fileEl" type="file" class="hidden" @change="uploadFile" />
      </div>

      <!-- 意見 -->
      <div>
        <label class="field-label">意見</label>
        <div class="rounded border border-line-2 focus-within:border-accent">
          <textarea v-model="newComment" rows="2" class="w-full resize-none outline-none px-2.5 py-2 text-sm rounded" placeholder="在此輸入您的訊息" @keydown.ctrl.enter="addComment"></textarea>
          <div class="flex justify-end px-2 pb-2">
            <button class="btn btn-primary !h-7" :disabled="!newComment.trim()" @click="addComment"><Icon name="send" :size="14" />傳送</button>
          </div>
        </div>
        <div class="mt-3 space-y-3">
          <div v-for="c in task.comments" :key="c.id" class="group/cm flex gap-2.5">
            <Avatar :user="c.user" :size="32" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-xs">
                <span class="font-semibold text-ink">{{ c.user?.displayName }}</span>
                <span class="text-ink-4">{{ fmtDateTime(c.createdAt) }}</span>
                <button v-if="c.userId === auth.user?.id || auth.isAdmin" class="ml-auto text-ink-4 hover:text-[#c50f1f] opacity-0 group-hover/cm:opacity-100 cursor-pointer" @click="removeComment(c)">刪除</button>
              </div>
              <p class="text-sm text-ink-2 whitespace-pre-line break-words mt-0.5">{{ c.content }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import Avatar from './Avatar.vue';
import Popover from './Popover.vue';
import PlanIcon from './PlanIcon.vue';
import LabelPill from './LabelPill.vue';
import LabelPicker from './LabelPicker.vue';
import AssigneePicker from './AssigneePicker.vue';
import ProgressIcon from './ProgressIcon.vue';
import PriorityIcon from './PriorityIcon.vue';
import api from '@/api';
import {
  PROGRESS, PRIORITIES, fmtDateTime, isLate, sortOrderAt, bySort,
} from '@/utils/planner';
import { useUiStore } from '@/stores/ui';
import { usePlanStore } from '@/stores/plan';
import { usePlansStore } from '@/stores/plans';
import { useAuthStore } from '@/stores/auth';

const ui = useUiStore();
const planStore = usePlanStore();
const plans = usePlansStore();
const auth = useAuthStore();

const task = ref(null);
const loading = ref(false);
const title = ref('');
const notes = ref('');
const newItem = ref('');
const newComment = ref('');
const linkForm = ref(null);
const uploading = ref(false);
const titleEl = ref(null);
const fileEl = ref(null);
const vFocus = { mounted: (el) => el.focus() };

const done = computed(() => task.value?.progress === 100);
const late = computed(() => task.value && isLate(task.value));
const userMap = computed(() => Object.fromEntries(plans.users.map((u) => [u.id, u])));
const assignees = computed(() => (task.value?.assigneeIds || []).map((id) => planStore.memberMap[id] || userMap.value[id]).filter(Boolean));
const sortedChecklist = computed(() => [...(task.value?.checklist || [])].sort(bySort));
const checkedCount = computed(() => task.value?.checklist.filter((c) => c.isChecked).length || 0);
const userName = (id) => planStore.memberMap[id]?.displayName || userMap.value[id]?.displayName || '使用者';

watch(() => ui.detail, async (d) => {
  linkForm.value = null;
  newItem.value = '';
  newComment.value = '';
  if (!d) {
    task.value = null;
    return;
  }
  loading.value = true;
  try {
    await planStore.ensure(d.planId);
    const data = await api.get(`/tasks/${d.taskId}`);
    task.value = data;
    title.value = data.title;
    notes.value = data.notes;
    await nextTick();
    autoGrow();
  } catch (e) {
    ui.error(e);
    ui.closeTask();
  } finally {
    loading.value = false;
  }
});

function close() {
  if (task.value) {
    saveTitle();
    saveNotes();
  }
  ui.closeTask();
}

function autoGrow() {
  const el = titleEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// 將詳細資料同步到看板卡片
function syncCard() {
  const t = task.value;
  const summary = {
    ...t,
    checklistTotal: t.checklist.length,
    checklistDone: t.checklist.filter((c) => c.isChecked).length,
    commentCount: t.comments.length,
  };
  delete summary.comments;
  planStore.upsertLocal(summary);
  ui.emitTask('updated', summary);
}

async function save(patch) {
  if (!task.value) return;
  const id = task.value.id;
  Object.assign(task.value, patch);
  try {
    const res = await planStore.updateTask(id, patch);
    if (task.value?.id === id) Object.assign(task.value, res, { comments: task.value.comments });
  } catch (e) {
    ui.error(e);
  }
}

function saveTitle() {
  const v = title.value.trim();
  if (!v) title.value = task.value.title;
  else if (v !== task.value.title) save({ title: v });
}
function saveNotes() {
  if (notes.value !== task.value.notes) save({ notes: notes.value });
}
function setPreview(type, checked) {
  save({ previewType: checked ? type : 'noPreview' });
}

async function renameLabel(id, name) {
  const labelNames = { ...(planStore.plan.labelNames || {}) };
  if (name) labelNames[id] = name;
  else delete labelNames[id];
  try {
    await planStore.updatePlan({ labelNames });
  } catch (e) {
    ui.error(e);
  }
}

async function toggleMyDay() {
  const next = !task.value.inMyDay;
  try {
    await planStore.setMyDay(task.value, next);
    task.value.inMyDay = next;
    ui.toast(next ? '已新增至「我的一天」' : '已從「我的一天」移除', 'success');
  } catch (e) {
    ui.error(e);
  }
}

function copyLink() {
  const url = `${location.origin}/plans/${task.value.planId}/board?task=${task.value.id}`;
  navigator.clipboard?.writeText(url);
  ui.toast('已複製連結', 'success');
}

async function remove() {
  const ok = await ui.confirm({ title: '刪除工作', message: `確定要刪除「${task.value.title}」嗎？此動作無法復原。` });
  if (!ok) return;
  try {
    await planStore.deleteTask(task.value.id);
    ui.closeTask();
  } catch (e) {
    ui.error(e);
  }
}

/* ---- 檢查清單 ---- */
async function addItem() {
  const t = newItem.value.trim();
  if (!t) return;
  newItem.value = '';
  try {
    const item = await api.post(`/tasks/${task.value.id}/checklist`, { title: t });
    task.value.checklist.push(item);
    syncCard();
  } catch (e) {
    ui.error(e);
  }
}
async function updateItem(c, patch) {
  Object.assign(c, patch);
  syncCard();
  try {
    await api.put(`/tasks/${task.value.id}/checklist/${c.id}`, patch);
  } catch (e) {
    ui.error(e);
  }
}
async function removeItem(c) {
  task.value.checklist = task.value.checklist.filter((x) => x.id !== c.id);
  syncCard();
  try {
    await api.delete(`/tasks/${task.value.id}/checklist/${c.id}`);
  } catch (e) {
    ui.error(e);
  }
}
function onChecklistMove(e) {
  if (!e.moved) return;
  const c = e.moved.element;
  const list = sortedChecklist.value.filter((x) => x.id !== c.id);
  updateItem(c, { sortOrder: sortOrderAt(list, e.moved.newIndex) });
}

/* ---- 附件 ---- */
async function addLink() {
  if (!linkForm.value?.url.trim()) return;
  try {
    const att = await api.post(`/tasks/${task.value.id}/attachments`, linkForm.value);
    task.value.attachments.push(att);
    linkForm.value = null;
    syncCard();
  } catch (e) {
    ui.error(e);
  }
}
async function uploadFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  uploading.value = true;
  try {
    const att = await api.post(`/tasks/${task.value.id}/attachments`, fd);
    task.value.attachments.push(att);
    syncCard();
  } catch (err) {
    ui.error(err);
  } finally {
    uploading.value = false;
  }
}
async function removeAttachment(a) {
  const ok = await ui.confirm({ title: '移除附件', message: `確定要移除「${a.name}」嗎？`, okText: '移除' });
  if (!ok) return;
  try {
    await api.delete(`/tasks/${task.value.id}/attachments/${a.id}`);
    task.value.attachments = task.value.attachments.filter((x) => x.id !== a.id);
    syncCard();
  } catch (e) {
    ui.error(e);
  }
}

/* ---- 意見 ---- */
async function addComment() {
  const content = newComment.value.trim();
  if (!content) return;
  try {
    const c = await api.post(`/tasks/${task.value.id}/comments`, { content });
    task.value.comments.unshift(c);
    newComment.value = '';
    syncCard();
  } catch (e) {
    ui.error(e);
  }
}
async function removeComment(c) {
  try {
    await api.delete(`/tasks/${task.value.id}/comments/${c.id}`);
    task.value.comments = task.value.comments.filter((x) => x.id !== c.id);
    syncCard();
  } catch (e) {
    ui.error(e);
  }
}
</script>
