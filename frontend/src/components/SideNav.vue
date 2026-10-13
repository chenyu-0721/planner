<template>
  <nav
    class="shrink-0 bg-[#fafafa] border-r border-line flex flex-col transition-[width] duration-150"
    :class="ui.navCollapsed ? 'w-12' : 'w-[260px]'"
  >
    <div class="h-12 flex items-center px-2">
      <button class="icon-btn" :title="ui.navCollapsed ? '展開瀏覽窗格' : '摺疊瀏覽窗格'" @click="ui.toggleNav()">
        <Icon name="menu" :size="18" />
      </button>
    </div>

    <div class="px-2 pb-2">
      <button
        class="w-full flex items-center gap-2 rounded h-9 text-sm font-semibold bg-white border border-line-2 hover:bg-hover cursor-pointer"
        :class="ui.navCollapsed ? 'justify-center px-0' : 'px-3'"
        title="新增計劃"
        @click="ui.newPlanOpen = true"
      >
        <Icon name="plus" :size="18" class="text-brand" :stroke="2.2" />
        <span v-if="!ui.navCollapsed">新增計劃</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto thin-scroll px-2 pb-4">
      <NavItem to="/myday" icon="sun" label="我的一天" :collapsed="ui.navCollapsed" />
      <NavItem to="/mytasks" icon="circle-check" label="我的工作" :collapsed="ui.navCollapsed" />
      <NavItem to="/plans" icon="plans" label="我的計劃" :collapsed="ui.navCollapsed" exact />

      <template v-if="!ui.navCollapsed">
        <div class="border-t border-line my-3 mx-1"></div>

        <button class="w-full flex items-center gap-1 px-2 h-7 text-xs font-semibold text-ink-3 cursor-pointer hover:text-ink" @click="pinnedOpen = !pinnedOpen">
          <Icon :name="pinnedOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
          釘選
        </button>
        <!-- 拖曳調整順序；在「釘選」與「計劃」之間拖曳可釘選 / 取消釘選 -->
        <div v-show="pinnedOpen" class="relative">
          <draggable :model-value="plans.pinned" item-key="id" group="nav-plans" class="min-h-8" v-bind="dragOptions" @change="(e) => onMove(e, plans.pinned, true)">
            <template #item="{ element: p }">
              <PlanNavItem :plan="p" />
            </template>
          </draggable>
          <div v-if="!plans.pinned.length" class="absolute inset-0 px-3 flex items-center text-xs text-ink-4 pointer-events-none">把計劃拖到這裡即可釘選</div>
        </div>

        <button class="w-full flex items-center gap-1 px-2 h-7 mt-2 text-xs font-semibold text-ink-3 cursor-pointer hover:text-ink" @click="othersOpen = !othersOpen">
          <Icon :name="othersOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
          計劃
        </button>
        <div v-show="othersOpen">
          <draggable :model-value="plans.others" item-key="id" group="nav-plans" class="min-h-8" v-bind="dragOptions" @change="(e) => onMove(e, plans.others, false)">
            <template #item="{ element: p }">
              <PlanNavItem :plan="p" />
            </template>
          </draggable>
        </div>
      </template>

      <template v-if="auth.isAdmin">
        <div class="border-t border-line my-3 mx-1"></div>
        <NavItem to="/admin/users" icon="shield" label="使用者管理" :collapsed="ui.navCollapsed" />
      </template>
    </div>
  </nav>
</template>

<script setup>
import { ref, h } from 'vue';
import draggable from 'vuedraggable';
import { RouterLink, useRoute } from 'vue-router';
import Icon from './Icon.vue';
import PlanIcon from './PlanIcon.vue';
import { useUiStore } from '@/stores/ui';
import { usePlansStore } from '@/stores/plans';
import { useAuthStore } from '@/stores/auth';
import { sortOrderAt } from '@/utils/planner';

const ui = useUiStore();
const plans = usePlansStore();
const auth = useAuthStore();
const route = useRoute();
const pinnedOpen = ref(true);
const othersOpen = ref(true);

// 手機長按 0.25 秒才開始拖曳，避免捲動時誤拖；滑鼠直接拖
const dragOptions = {
  animation: 150,
  delay: 250,
  delayOnTouchOnly: true,
  forceFallback: true,
  fallbackOnBody: true,
  ghostClass: 'drag-ghost',
  fallbackClass: 'drag-fallback',
};
function onMove(e, list, pinned) {
  const evt = e.added || e.moved;
  if (!evt) return;
  const p = evt.element;
  const rest = list.filter((x) => x.id !== p.id);
  plans.move(p.id, sortOrderAt(rest, evt.newIndex), pinned).catch((err) => ui.error(err));
}

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
