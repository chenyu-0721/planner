<template>
  <svg :width="size" :height="size" viewBox="0 0 20 20" class="shrink-0" aria-hidden="true">
    <template v-if="value === 100">
      <circle cx="10" cy="10" r="8.5" fill="#107c10" />
      <path d="m6.2 10.2 2.6 2.6 5-5.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="value === 50">
      <circle cx="10" cy="10" r="7.75" fill="none" stroke="#0f6cbd" stroke-width="1.5" />
      <path d="M10 4.5a5.5 5.5 0 0 1 0 11z" fill="#0f6cbd" />
    </template>
    <circle v-else cx="10" cy="10" r="7.75" fill="none" stroke="#616161" stroke-width="1.5" />
  </svg>
</template>

<script setup>
defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 16 },
});
</script>
