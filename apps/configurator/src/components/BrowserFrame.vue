<script setup lang="ts">
import type { CSSProperties } from 'vue';

defineProps<{
  eyebrow: string;
  previewUrl: string;
  frameStyle: CSSProperties;
}>();
</script>

<template>
  <div class="preview-view" :style="frameStyle">
    <p class="preview-eyebrow">{{ eyebrow }}</p>
    <div class="browser-frame">
      <div class="browser-toolbar">
        <div class="browser-dots" aria-hidden="true">
          <span class="browser-dot browser-dot-close" />
          <span class="browser-dot browser-dot-minimize" />
          <span class="browser-dot browser-dot-expand" />
        </div>
        <div class="browser-url" :title="previewUrl">
          {{ previewUrl }}
        </div>
        <span class="browser-toolbar-spacer" aria-hidden="true" />
      </div>
      <div class="browser-body">
        <slot />
      </div>
    </div>
  </div>
</template>
