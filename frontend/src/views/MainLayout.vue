<template>
  <div class="h-full flex flex-col">
    <AppHeader @profile="profileOpen = true" />
    <div class="flex flex-1 min-h-0">
      <SideNav />
      <!-- 手機版側邊欄遮罩 -->
      <Transition name="fade">
        <div v-if="ui.isMobile && ui.navOpen" class="fixed inset-0 z-40 bg-black/40" @click="ui.navOpen = false"></div>
      </Transition>
      <main class="flex-1 min-w-0 flex flex-col bg-canvas">
        <router-view :key="routeKey" />
      </main>
    </div>
    <TaskDetail />
    <NewPlanDialog />
    <ProfileDialog v-model="profileOpen" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import SideNav from '@/components/SideNav.vue';
import TaskDetail from '@/components/TaskDetail.vue';
import NewPlanDialog from '@/components/NewPlanDialog.vue';
import ProfileDialog from '@/components/ProfileDialog.vue';
import { usePlansStore } from '@/stores/plans';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const plans = usePlansStore();
const ui = useUiStore();
const profileOpen = ref(false);
// 切換計劃時重新建立元件，同一計劃切換檢視則保留
const routeKey = computed(() => (route.name === 'plan' ? `plan-${route.params.id}` : route.path));

// 手機版換頁後關閉側邊欄
watch(() => route.fullPath, () => { ui.navOpen = false; });

onMounted(() => {
  ui.watchViewport();
  plans.fetch();
  plans.fetchUsers();
  ui.loadConfig();
});
</script>
