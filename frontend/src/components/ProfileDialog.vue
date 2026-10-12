<template>
  <Modal :model-value="modelValue" title="我的帳戶" width="480px" @update:model-value="$emit('update:modelValue', $event)">
    <div class="px-6 pb-2">
      <div class="flex gap-1 border-b border-line mb-4">
        <button v-for="t in tabs" :key="t.key" class="px-3 h-9 text-sm cursor-pointer -mb-px border-b-2"
                :class="tab === t.key ? 'border-accent font-semibold' : 'border-transparent text-ink-3 hover:text-ink'"
                @click="tab = t.key">{{ t.label }}</button>
      </div>

      <div v-if="tab === 'profile'" class="space-y-3">
        <div class="flex items-center gap-3">
          <Avatar :user="{ displayName, color }" :size="56" />
          <div class="flex flex-wrap gap-1.5">
            <button v-for="c in COLORS" :key="c" class="size-6 rounded-full cursor-pointer ring-offset-1" :class="c === color ? 'ring-2 ring-accent' : ''" :style="{ background: c }" @click="color = c"></button>
          </div>
        </div>
        <div>
          <label class="field-label">帳號</label>
          <input class="input bg-hover" :value="auth.user?.username" disabled />
        </div>
        <div>
          <label class="field-label">顯示名稱</label>
          <input v-model="displayName" class="input" />
        </div>
        <div>
          <label class="field-label">電子郵件</label>
          <input v-model="email" class="input" />
        </div>
      </div>

      <div v-else class="space-y-3">
        <div>
          <label class="field-label">目前密碼</label>
          <input v-model="pw.current" type="password" class="input" />
        </div>
        <div>
          <label class="field-label">新密碼</label>
          <input v-model="pw.next" type="password" class="input" />
        </div>
        <div>
          <label class="field-label">確認新密碼</label>
          <input v-model="pw.confirm" type="password" class="input" />
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn btn-default" @click="$emit('update:modelValue', false)">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="save">儲存</button>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import Modal from './Modal.vue';
import Avatar from './Avatar.vue';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);
const auth = useAuthStore();
const ui = useUiStore();
const plans = usePlansStore();

const COLORS = ['#0078d4', '#8764b8', '#038387', '#ca5010', '#c239b3', '#498205', '#d13438', '#004e8c', '#986f0b', '#5c2e91'];
const tabs = [{ key: 'profile', label: '個人資料' }, { key: 'password', label: '變更密碼' }];
const tab = ref('profile');
const displayName = ref('');
const email = ref('');
const color = ref('');
const pw = reactive({ current: '', next: '', confirm: '' });
const saving = ref(false);

watch(() => props.modelValue, (v) => {
  if (!v) return;
  tab.value = 'profile';
  displayName.value = auth.user?.displayName || '';
  email.value = auth.user?.email || '';
  color.value = auth.user?.color || COLORS[0];
  Object.assign(pw, { current: '', next: '', confirm: '' });
});

async function save() {
  saving.value = true;
  try {
    if (tab.value === 'profile') {
      await auth.updateProfile({ displayName: displayName.value, email: email.value, color: color.value });
      plans.fetchUsers();
      ui.toast('已更新個人資料', 'success');
    } else {
      if (pw.next !== pw.confirm) throw new Error('兩次輸入的新密碼不一致');
      await auth.changePassword(pw.current, pw.next);
      ui.toast('密碼已變更', 'success');
    }
    emit('update:modelValue', false);
  } catch (e) {
    ui.error(e);
  } finally {
    saving.value = false;
  }
}
</script>
