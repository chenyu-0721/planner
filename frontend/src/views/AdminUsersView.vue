<template>
  <div class="flex-1 overflow-y-auto thin-scroll">
    <div class="max-w-[1100px] mx-auto px-8 py-6">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <Icon name="shield" :size="26" class="text-brand" />
          <h1 class="text-2xl font-semibold">使用者管理</h1>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-default" @click="openMyPassword"><Icon name="key" :size="16" />變更我的密碼</button>
          <button class="btn btn-primary" @click="openForm()"><Icon name="plus" :size="16" :stroke="2.2" />新增使用者</button>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-3">
        <div class="relative w-72">
          <Icon name="search" :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input v-model="keyword" class="input !pl-8" placeholder="搜尋帳號、名稱或電子郵件" />
        </div>
        <select v-model="roleFilter" class="input select !w-32">
          <option value="">全部角色</option>
          <option value="admin">管理員</option>
          <option value="member">會員</option>
        </select>
        <span class="text-sm text-ink-3">共 {{ shown.length }} 位使用者</span>
      </div>

      <div class="bg-white rounded-md card-shadow overflow-hidden">
        <div :class="cols" class="h-10 px-4 text-xs font-semibold text-ink-3 border-b border-line">
          <div>使用者</div><div>電子郵件</div><div>角色</div><div>狀態</div><div>建立日期</div><div></div>
        </div>
        <div v-if="!shown.length" class="py-12 text-center text-sm text-ink-3">沒有符合的使用者</div>
        <div v-for="u in shown" :key="u.id" :class="cols" class="h-14 px-4 border-b border-line last:border-0 hover:bg-[#fafafa] text-sm">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :user="u" :size="32" />
            <div class="min-w-0">
              <div class="font-semibold truncate">
                {{ u.displayName }}
                <span v-if="u.id === auth.user?.id" class="ml-1 text-xs font-normal text-accent">（你）</span>
              </div>
              <div class="text-xs text-ink-3 truncate">{{ u.username }}</div>
            </div>
          </div>
          <div class="truncate text-ink-2">{{ u.email || '—' }}</div>
          <div>
            <span class="inline-flex px-2 h-5 items-center rounded-full text-xs font-semibold" :class="u.role === 'admin' ? 'bg-brand-light text-brand-dark' : 'bg-hover text-ink-2'">
              {{ u.role === 'admin' ? '管理員' : '會員' }}
            </span>
          </div>
          <div :class="u.isActive ? 'text-done' : 'text-ink-4'">{{ u.isActive ? '啟用' : '停用' }}</div>
          <div class="text-ink-3">{{ fmtDateTime(u.createdAt) }}</div>
          <div class="flex justify-end gap-1">
            <button class="icon-btn" title="編輯" @click="openForm(u)"><Icon name="pencil" :size="15" /></button>
            <button v-if="u.id !== auth.user?.id" class="icon-btn hover:!text-[#c50f1f]" title="刪除" @click="remove(u)"><Icon name="trash" :size="15" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 編輯使用者 -->
    <Modal v-model="formOpen" :title="form.id ? '編輯使用者' : '新增使用者'" width="460px">
      <div class="px-6 pb-2 space-y-3">
        <div>
          <label class="field-label">帳號</label>
          <input v-model="form.username" class="input" :disabled="!!form.id" :class="form.id ? 'bg-hover' : ''" placeholder="3~50 個英文、數字或 _ . -" />
        </div>
        <div>
          <label class="field-label">顯示名稱</label>
          <input v-model="form.displayName" class="input" />
        </div>
        <div>
          <label class="field-label">電子郵件（選用）</label>
          <input v-model="form.email" class="input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">{{ form.id ? '新密碼（留白不變更）' : '密碼' }}</label>
            <input v-model="form.password" type="password" class="input" autocomplete="new-password" placeholder="至少 6 個字元" />
          </div>
          <div>
            <label class="field-label">確認密碼</label>
            <input v-model="form.confirm" type="password" class="input" autocomplete="new-password" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">角色</label>
            <select v-model="form.role" class="input select" :disabled="form.id === auth.user?.id">
              <option value="member">會員</option>
              <option value="admin">管理員</option>
            </select>
          </div>
          <div v-if="form.id">
            <label class="field-label">狀態</label>
            <select v-model="form.isActive" class="input select" :disabled="form.id === auth.user?.id">
              <option :value="true">啟用</option>
              <option :value="false">停用</option>
            </select>
          </div>
        </div>
        <p v-if="formError" class="text-sm text-[#c50f1f]">{{ formError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-default" @click="formOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">儲存</button>
      </template>
    </Modal>

    <!-- 變更我的密碼 -->
    <Modal v-model="pwOpen" title="變更我的密碼" width="420px">
      <div class="px-6 pb-2 space-y-3">
        <div>
          <label class="field-label">目前密碼</label>
          <input v-model="pw.current" type="password" class="input" autocomplete="current-password" />
        </div>
        <div>
          <label class="field-label">新密碼</label>
          <input v-model="pw.next" type="password" class="input" autocomplete="new-password" placeholder="至少 6 個字元" />
        </div>
        <div>
          <label class="field-label">確認新密碼</label>
          <input v-model="pw.confirm" type="password" class="input" autocomplete="new-password" @keydown.enter="saveMyPassword" />
        </div>
        <p v-if="pwError" class="text-sm text-[#c50f1f]">{{ pwError }}</p>
      </div>
      <template #footer>
        <button class="btn btn-default" @click="pwOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="saveMyPassword">變更密碼</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import Avatar from '@/components/Avatar.vue';
import Modal from '@/components/Modal.vue';
import api from '@/api';
import { fmtDateTime } from '@/utils/planner';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';

const auth = useAuthStore();
const ui = useUiStore();
const plans = usePlansStore();

const cols = 'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_100px_90px_150px_100px] items-center';
const users = ref([]);
const keyword = ref('');
const roleFilter = ref('');
const formOpen = ref(false);
const formError = ref('');
const saving = ref(false);
const form = reactive({});
const pwOpen = ref(false);
const pwError = ref('');
const pw = reactive({ current: '', next: '', confirm: '' });

const shown = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return users.value.filter((u) => (!roleFilter.value || u.role === roleFilter.value)
    && (!kw || [u.username, u.displayName, u.email].some((v) => v?.toLowerCase().includes(kw))));
});

async function load() {
  try {
    users.value = await api.get('/users/all');
  } catch (e) {
    ui.error(e);
  }
}

function openForm(u) {
  Object.assign(form, {
    id: u?.id || null,
    username: u?.username || '',
    displayName: u?.displayName || '',
    email: u?.email || '',
    role: u?.role || 'member',
    isActive: u ? u.isActive : true,
    password: '',
    confirm: '',
  });
  formError.value = '';
  formOpen.value = true;
}

function validate() {
  if (!form.id && !/^[A-Za-z0-9_.-]{3,50}$/.test(form.username.trim())) return '帳號需為 3~50 個英文、數字或 _ . - 字元';
  if (!form.displayName.trim()) return '請輸入顯示名稱';
  if (!form.id && !form.password) return '請輸入密碼';
  if (form.password && form.password.length < 6) return '密碼至少 6 個字元';
  if (form.password !== form.confirm) return '兩次輸入的密碼不一致';
  return '';
}

async function save() {
  formError.value = validate();
  if (formError.value) return;
  saving.value = true;
  try {
    const { id, username, confirm, ...data } = form;
    if (!data.password) delete data.password;
    if (id) await api.put(`/users/${id}`, data);
    else await api.post('/users', { ...data, username: username.trim() });
    formOpen.value = false;
    ui.toast(id ? '已更新使用者' : '已新增使用者', 'success');
    load();
    plans.fetchUsers();
    if (id === auth.user?.id) auth.fetchMe();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(u) {
  const ok = await ui.confirm({ title: '刪除使用者', message: `確定要刪除「${u.displayName}」嗎？其計劃成員資格與工作指派會一併移除。` });
  if (!ok) return;
  try {
    await api.delete(`/users/${u.id}`);
    ui.toast('已刪除使用者', 'success');
    load();
    plans.fetchUsers();
  } catch (e) {
    ui.error(e);
  }
}

function openMyPassword() {
  Object.assign(pw, { current: '', next: '', confirm: '' });
  pwError.value = '';
  pwOpen.value = true;
}

async function saveMyPassword() {
  pwError.value = '';
  if (!pw.current) pwError.value = '請輸入目前密碼';
  else if (pw.next.length < 6) pwError.value = '新密碼至少 6 個字元';
  else if (pw.next !== pw.confirm) pwError.value = '兩次輸入的新密碼不一致';
  if (pwError.value) return;
  saving.value = true;
  try {
    await auth.changePassword(pw.current, pw.next);
    pwOpen.value = false;
    ui.toast('密碼已變更，下次登入請使用新密碼', 'success');
  } catch (e) {
    pwError.value = e.message;
  } finally {
    saving.value = false;
  }
}

load();
</script>
