<template>
  <select class="input select" :value="modelValue || ''" @change="$emit('update:modelValue', $event.target.value || null)">
    <option v-if="followLabel" value="">{{ followLabel }}</option>
    <option v-for="c in options" :key="c.code" :value="c.code">{{ c.flag }} {{ c.code }} {{ c.name }}</option>
  </select>
</template>

<script setup>
import { computed } from 'vue';
import { CURRENCIES, currencyInfo } from '@/utils/currency';

const props = defineProps({
  modelValue: { type: String, default: null },
  followLabel: { type: String, default: '' }, // 有值時多一個「跟隨行程」選項（值為 null）
});
defineEmits(['update:modelValue']);

// 資料裡有不在常用清單的幣別時也要能顯示
const options = computed(() => (props.modelValue && !CURRENCIES.some((c) => c.code === props.modelValue)
  ? [...CURRENCIES, currencyInfo(props.modelValue)]
  : CURRENCIES));
</script>
