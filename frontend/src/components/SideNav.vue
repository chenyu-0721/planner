<template>
  <nav
    class="shrink-0 bg-[#fafafa] border-line flex flex-col"
    :class="ui.isMobile
      ? ['fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r shadow-2xl transition-transform duration-200', ui.navOpen ? 'translate-x-0' : '-translate-x-full']
      : ['border-r transition-[width] duration-150', collapsed ? 'w-12' : 'w-[260px]']"
  >
    <div class="h-12 flex items-center px-2">
      <button v-if="ui.isMobile" class="icon-btn" title="關閉選單" @click="ui.navOpen = false">
        <Icon name="x" :size="18" />
      </button>
      <button v-else class="icon-btn" :title="collapsed ? '展開瀏覽窗格' : '摺疊瀏覽窗格'" @click="ui.toggleNav()">
        <Icon name="menu" :size="18" />
      </button>
      <span v-if="ui.isMobile" class="ml-1 font-semibold text-brand">Planner</span>
    </div>

    <div class="px-2 pb-2">
      <button
        class="w-full flex items-center gap-2 rounded h-9 text-sm font-semibold bg-white border border-line-2 hover:bg-hover cursor-pointer"
        :class="collapsed ? 'justify-center px-0' : 'px-3'"
        title="新增計劃"
        @click="ui.newPlanOpen = true; ui.navOpen = false"
      >
        <Icon name="plus" :size="18" class="text-brand" :stroke="2.2" />
        <span v-if="!collapsed">新增計劃</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto thin-scroll px-2 pb-4">
      <NavItem to="/myday" icon="sun" label="我的一天" :collapsed="collapsed" />
      <NavItem to="/mytasks" icon="circle-check" label="我的工作" :collapsed="collapsed" />
      <NavItem to="/plans" icon="plans" label="我的計劃" :collapsed="collapsed" exact />

      <template v-if="!collapsed">
        <div class="border-t border-line my-3 mx-1"></div>

        <button class="w-full flex items-center gap-1 px-2 h-7 text-xs font-semibold text-ink-3 cursor-pointer hover:text-ink" @click="pinnedOpen = !pinnedOpen">
          <Icon :name="pinnedOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
          釘選
        </button>
        <template v-if="pinnedOpen">
          <div v-if="!plans.pinned.length" class="px-3 py-1.5 text-xs text-ink-4">釘選的計劃會顯示在這裡</div>
          <PlanNavItem v-for="p in plans.pinned" :key="'p' + p.id" :plan="p" />
        </template>

        <button class="w-full flex items-center gap-1 px-2 h-7 mt-2 text-xs font-semibold text-ink-3 cursor-pointer hover:text-ink" @click="recentOpen = !recentOpen">
          <Icon :name="recentOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
          最近
        </button>
        <template v-if="recentOpen">
          <PlanNavItem v-for="p in plans.recent.slice(0, 8)" :key="'r' + p.id" :plan="p" />
        </template>
      </template>

      <template v-if="auth.isAdmin">
        <div class="border-t border-line my-3 mx-1"></div>
        <NavItem to="/admin/users" icon="shield" label="使用者管理" :collapsed="collapsed" />
      </template>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, h } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import Icon from './Icon.vue';
import PlanIcon from './PlanIcon.vue';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';
import { useAuthStore } from '@/stores/auth';

const ui = useUiStore();
const plans = usePlansStore();
const auth = useAuthStore();
const route = useRoute();
const pinnedOpen = ref(true);
const recentOpen = ref(true);
// 手機版抽屜一律展開
const collapsed = computed(() => !ui.isMobile && ui.navCollapsed);

const itemClass = (active, collapsed) => [
  'relative flex items-center gap-3 h-9 rounded text-sm text-ink hover:bg-black/5',
  collapsed ? 'justify-center' : 'px-2.5',
  active ? 'bg-white font-semibold card-shadow hover:bg-white' : '',
];

const NavItem = (props) => {
  const active = props.exact ? route.path === props.to : route.path.startsWith(props.to);
  return h(RouterLink, { to: props.to, class: itemClass(active, props.collapsed), title: props.label }, () => [
    active ? h('span', { class: 'absolute left-0 top-2 bottom-2 w-[3px] rounded bg-brand' }) : null,
    h(Icon, { name: props.icon, size: 18, class: active ? 'text-brand' : 'text-ink-2' }),
    props.collapsed ? null : h('span', { class: 'truncate' }, props.label),
  ]);
};
NavItem.props = ['to', 'icon', 'label', 'collapsed', 'exact'];

const PlanNavItem = (props) => {
  const active = route.name === 'plan' && Number(route.params.id) === props.plan.id;
  return h(RouterLink, { to: `/plans/${props.plan.id}`, class: itemClass(active, false), title: props.plan.name }, () => [
    active ? h('span', { class: 'absolute left-0 top-2 bottom-2 w-[3px] rounded bg-brand' }) : null,
    h(PlanIcon, { plan: props.plan, size: 22 }),
    h('span', { class: 'truncate' }, props.plan.name),
  ]);
};
PlanNavItem.props = ['plan'];
</script>
