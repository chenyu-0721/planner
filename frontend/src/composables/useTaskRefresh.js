import { onBeforeUnmount, watch } from 'vue';
import { useUiStore } from '@/stores/ui';

// 其他地方修改工作時，重新整理目前清單
export function useTaskRefresh(reload, delay = 300) {
  const ui = useUiStore();
  let timer = null;
  const stop = watch(() => ui.taskEvent, () => {
    clearTimeout(timer);
    timer = setTimeout(reload, delay);
  });
  onBeforeUnmount(() => {
    clearTimeout(timer);
    stop();
  });
}
