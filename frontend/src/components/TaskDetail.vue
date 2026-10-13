<template>
  <Modal :model-value="!!ui.detail" width="700px" @update:model-value="close">
    <template v-if="task" #header>
      <div class="flex items-center gap-2 text-sm text-ink-3 min-w-0">
        <PlanIcon :plan="planStore.plan" :size="20" />
        <router-link :to="`/plans/${task.planId}`" class="truncate hover:underline" @click="close">{{ planStore.plan?.name }}</router-link>
      </div>
    </template>

    <div v-if="loading && !task" class="px-6 py-16 text-center text-ink-3">載入中…</div>
    <div v-else-if="task" class="px-6 pb-6" @paste="onPaste">
      <!-- 標題 -->
      <div class="flex items-start gap-2 mb-1">
        <button class="mt-2 cursor-pointer" :title="done ? '標示為未完成' : '標示為完成'" @click="save({ progress: done ? 0 : 100 })">
          <ProgressIcon :value="done ? 100 : 0" :size="22" />
        </button>
        <textarea
          ref="titleEl"
          v-model="title"
          rows="1"
          maxlength="200"
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
        <textarea v-model="notes" maxlength="10000" rows="4" class="input !h-auto py-2 resize-y min-h-20" placeholder="輸入描述或新增附註（可直接 Ctrl+V 貼上圖片，會加入附件）" @blur="saveNotes"></textarea>
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
                maxlength="100"
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
          <input v-model="newItem" class="flex-1 outline-none text-sm border-b border-transparent focus:border-accent placeholder:text-ink-4" placeholder="新增項目" maxlength="100" @keydown.enter="addItem" />
        </div>
      </div>

      <!-- 附件 -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-1.5">
          <label class="field-label !mb-0">附件</label>
        </div>
        <div v-if="task.attachments.length" class="space-y-1 mb-2">
          <div v-for="a in task.attachments" :key="a.id" class="group/at flex items-center gap-2 min-h-10 px-2 py-1 rounded border border-line hover:bg-hover">
            <template v-if="isImage(a)">
              <button class="shrink-0 size-12 rounded overflow-hidden border border-line bg-hover cursor-zoom-in" title="點擊放大" @click="viewAttachment(a)">
                <img :src="a.url" :alt="a.name" class="size-full object-cover" loading="lazy" />
              </button>
              <button class="flex-1 min-w-0 truncate text-left text-sm text-accent hover:underline cursor-zoom-in" @click="viewAttachment(a)">{{ a.name }}</button>
            </template>
            <template v-else>
              <Icon :name="a.type === 'link' ? 'link' : 'file'" :size="16" class="text-ink-3" />
              <a :href="a.url" target="_blank" rel="noopener" class="flex-1 truncate text-sm text-accent hover:underline">{{ a.name }}</a>
            </template>
            <label v-if="isImage(a)" class="flex items-center gap-1 text-xs text-ink-3 cursor-pointer shrink-0">
              <input type="checkbox" class="accent-accent" :checked="task.previewType === 'reference'" @change="setPreview('reference', $event.target.checked)" />
              在卡片上顯示
            </label>
            <button class="icon-btn !size-7 opacity-0 group-hover/at:opacity-100" title="移除附件" @click="removeAttachment(a)"><Icon name="trash" :size="14" /></button>
          </div>
        </div>
        <div v-if="linkForm" class="flex flex-col gap-2 p-3 rounded border border-line mb-2">
          <input v-model="linkForm.url" v-focus maxlength="1000" class="input" placeholder="連結網址，例如 https://www.example.com" />
          <input v-model="linkForm.name" maxlength="200" class="input" placeholder="要顯示的文字（選用）" @keydown.enter="addLink" />
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
        <span class="ml-1 text-xs text-ink-4">也可以直接 Ctrl+V 貼上圖片</span>
        <input ref="fileEl" type="file" multiple class="hidden" @change="uploadFile" />
      </div>

      <!-- 意見 -->
      <div>
        <label class="field-label">意見</label>
        <div class="rounded border border-line-2 focus-within:border-accent">
          <textarea ref="commentEl" v-model="newComment" maxlength="1500" rows="2" class="w-full resize-none outline-none px-2.5 py-2 text-sm rounded" placeholder="在此輸入您的訊息（可直接 Ctrl+V 貼上圖片）" @keydown.ctrl.enter="addComment"></textarea>
          <div v-if="commentImages.length" class="flex flex-wrap gap-2 px-2.5 pb-2">
            <div v-for="(img, i) in commentImages" :key="img.key" class="relative size-16 rounded overflow-hidden border border-line bg-hover">
              <img v-if="img.url" :src="img.url" :alt="img.name" class="size-full object-cover cursor-zoom-in" @click="viewer = { images: readyCommentImages, index: readyCommentImages.indexOf(img) }" />
              <div v-else class="size-full flex items-center justify-center text-[11px] text-ink-3">上傳中…</div>
              <button class="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer" title="移除" @click="commentImages.splice(i, 1)">
                <Icon name="x" :size="12" />
              </button>
            </div>
          </div>
          <div class="flex justify-end px-2 pb-2">
            <button class="btn btn-primary !h-7" :disabled="(!newComment.trim() && !readyCommentImages.length) || commentImages.some((x) => !x.url)" @click="addComment"><Icon name="send" :size="14" />傳送</button>
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
              <template v-for="(part, pi) in parseComment(c.content)" :key="pi">
                <p v-if="part.text" class="text-sm text-ink-2 whitespace-pre-line break-words mt-0.5">{{ part.text }}</p>
                <div v-else class="flex flex-wrap gap-2 mt-1.5">
                  <button
                    v-for="(img, ii) in part.images"
                    :key="img.url"
                    class="rounded overflow-hidden border border-line bg-hover cursor-zoom-in"
                    title="點擊放大"
                    @click="viewer = { images: part.images, index: ii }"
                  >
                    <img :src="img.url" :alt="img.name" class="block max-h-40 max-w-[240px] object-contain" loading="lazy" />
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ImageViewer :images="viewer?.images || []" :index="viewer?.index ?? null" @update:index="(i) => (viewer = i == null ? null : { ...viewer, index: i })" />
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
import ImageViewer from './ImageViewer.vue';
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
const commentEl = ref(null);
const commentImages = ref([]); // 意見中貼上的圖片：{ key, url, name }（url 為空 = 上傳中）
const readyCommentImages = computed(() => commentImages.value.filter((x) => x.url));
const viewer = ref(null); // 放大檢視：{ images: [{ url, name }], index }
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
  commentImages.value = [];
  viewer.value = null;
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
const isImage = (a) => a.type === 'file' && a.mimeType?.startsWith('image/');
function viewAttachment(a) {
  const images = task.value.attachments.filter(isImage).map((x) => ({ url: x.url, name: x.name }));
  viewer.value = { images, index: images.findIndex((x) => x.url === a.url) };
}

async function uploadFiles(files) {
  const taskId = task.value.id;
  uploading.value = true;
  try {
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      const att = await api.post(`/tasks/${taskId}/attachments`, fd);
      if (task.value?.id !== taskId) return;
      task.value.attachments.push(att);
    }
    syncCard();
  } catch (err) {
    ui.error(err);
  } finally {
    uploading.value = false;
  }
}
function uploadFile(e) {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  if (files.length) uploadFiles(files);
}

// 剪貼簿中的圖片（截圖、從網頁或檔案總管複製的圖片）
function pastedImages(e) {
  const stamp = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-').slice(0, 16);
  return [...(e.clipboardData?.items || [])]
    .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
    .map((it, i) => {
      const file = it.getAsFile();
      const ext = (it.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      // 截圖沒有檔名（或叫 image.png），改成「貼上的圖片-時間」
      const name = file.name && file.name !== 'image.png' ? file.name : `貼上的圖片-${stamp}${i ? `-${i + 1}` : ''}.${ext}`;
      return new File([file], name, { type: file.type });
    });
}

// 在工作視窗任何輸入框按 Ctrl+V：意見輸入框 → 圖片放進意見；其他地方 → 加入附件
async function onPaste(e) {
  const files = pastedImages(e);
  if (!files.length) return; // 一般文字照常貼上
  e.preventDefault();
  if (e.target === commentEl.value) {
    await uploadCommentImages(files);
    return;
  }
  await uploadFiles(files);
  ui.toast(files.length > 1 ? `已將 ${files.length} 張圖片加入附件` : '已將圖片加入附件', 'success');
}

async function uploadCommentImages(files) {
  const taskId = task.value.id;
  const room = MAX_COMMENT_IMAGES - commentImages.value.length;
  if (files.length > room) ui.toast(`一則意見最多 ${MAX_COMMENT_IMAGES} 張圖片`, 'error');
  for (const file of files.slice(0, Math.max(0, room))) {
    const item = { key: `${Date.now()}-${Math.random()}`, url: '', name: file.name };
    commentImages.value.push(item);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/tasks/${taskId}/images`, fd);
      const target = commentImages.value.find((x) => x.key === item.key);
      if (target) Object.assign(target, res);
    } catch (err) {
      commentImages.value = commentImages.value.filter((x) => x.key !== item.key);
      ui.error(err);
    }
  }
}

// 意見內容：一般文字，夾雜一行一張的圖片 ![名稱](/uploads/檔名)
const COMMENT_IMAGE_LINE = /^!\[([^\]\n]*)\]\((\/uploads\/[\w.-]+)\)$/;
function parseComment(content) {
  const parts = [];
  for (const line of String(content || '').split('\n')) {
    const m = line.match(COMMENT_IMAGE_LINE);
    const last = parts[parts.length - 1];
    if (m) {
      if (last?.images) last.images.push({ name: m[1] || '圖片', url: m[2] });
      else parts.push({ images: [{ name: m[1] || '圖片', url: m[2] }] });
    } else if (last && 'text' in last) last.text += `\n${line}`;
    else parts.push({ text: line });
  }
  return parts.map((p) => ('text' in p ? { text: p.text.trim() } : p)).filter((p) => p.images || p.text);
}
// 名稱只留 30 字，6 張圖加上 1500 字的文字仍在意見長度上限（2000）內
const imageLine = (img) => `![${img.name.replace(/[[\]\n]/g, '').slice(0, 30)}](${img.url})`;
const MAX_COMMENT_IMAGES = 6;

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
  if (commentImages.value.some((x) => !x.url)) return; // 圖片還在上傳
  const content = [newComment.value.trim(), ...readyCommentImages.value.map(imageLine)].filter(Boolean).join('\n');
  if (!content) return;
  try {
    const c = await api.post(`/tasks/${task.value.id}/comments`, { content });
    task.value.comments.unshift(c);
    newComment.value = '';
    commentImages.value = [];
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
