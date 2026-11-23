<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { ACCENT_PALETTE } from '@alekstar79/ykassa-contracts/palette';
import BrowserFrame from './components/BrowserFrame.vue';
import HeaderControls from './components/HeaderControls.vue';
import BackendSection from './components/form/BackendSection.vue';
import ClientSection from './components/form/ClientSection.vue';
import MessengersSection from './components/form/MessengersSection.vue';
import UiSection from './components/form/UiSection.vue';
import ValidationSummary from './components/ValidationSummary.vue';
import PreviewPanel from './components/PreviewPanel.vue';
import { useDownload } from './composables/useDownload';
import { useFormState } from './composables/useFormState';
import { useLocale } from './composables/useLocale';
import { useSecretVisibility } from './composables/useSecretVisibility';
import { useTheme } from './composables/useTheme';
import { useValidation } from './composables/useValidation';
import { useViewMode } from './composables/useViewMode';

const { form, hasApprovalThreshold, updateNumber, toggleScenario, setHumanConfirmation } =
  useFormState();
const { theme, toggleTheme } = useTheme();
const { locale, messages, setLocale } = useLocale();
const { viewMode, toggleViewMode } = useViewMode();
const { showMcpToken, toggleMcpToken } = useSecretVisibility();
const {
  fieldErrors,
  validationSummary,
  isFormValid,
  errorFor,
  describedBy,
} = useValidation(form, hasApprovalThreshold, messages);
const {
  downloadError,
  isPreparingDownload,
  downloadClientConfig,
} = useDownload({
  form,
  hasApprovalThreshold,
  isFormValid,
  fieldErrors,
  locale,
  messages,
});
const accentSample = computed(() => {
  const palette = ACCENT_PALETTE[form.value.ui.accent];
  return theme.value === 'dark' ? palette.dark.bg : palette.light.bg;
});
const previewUrl = computed(
  () => `localhost:5173/?client=${form.value.name.trim() || '<name>'}`,
);
const previewFrameStyle = computed<CSSProperties>(() => ({
  '--accent': accentSample.value,
}));
</script>

<template>
  <main class="page" :class="{ 'page--preview': viewMode === 'preview' }">
    <div class="page-shell">
      <header class="topbar">
        <p class="wordmark">YooKassa</p>
        <HeaderControls
          :locale="locale"
          :theme="theme"
          :view-mode="viewMode"
          :client-mode="form.clientMode"
          :messages="messages"
          @set-locale="setLocale"
          @toggle-theme="toggleTheme"
          @toggle-view-mode="toggleViewMode(form.clientMode)"
        />
      </header>

      <section class="workspace" aria-labelledby="page-title">
        <h1 id="page-title">{{ messages.pageTitle }}</h1>

        <form
          v-show="viewMode === 'settings'"
          class="config-form"
          @submit.prevent
        >
          <ClientSection
            :form="form"
            :messages="messages"
            :show-mcp-token="showMcpToken"
            :error-for="errorFor"
            :described-by="describedBy"
            @toggle-secret="toggleMcpToken"
          />
          <BackendSection
            :form="form"
            :has-approval-threshold="hasApprovalThreshold"
            :messages="messages"
            :error-for="errorFor"
            :described-by="describedBy"
            :update-number="updateNumber"
            :toggle-scenario="toggleScenario"
            :set-human-confirmation="setHumanConfirmation"
          />
          <UiSection
            :form="form"
            :messages="messages"
            :accent-sample="accentSample"
            :error-for="errorFor"
            :described-by="describedBy"
          />
          <MessengersSection
            v-if="form.clientMode === 'messengers'"
            :form="form"
            :messages="messages"
            :error-for="errorFor"
            :described-by="describedBy"
          />

          <div class="form-actions">
            <ValidationSummary
              :summary="validationSummary"
              :download-error="downloadError"
              :messages="messages"
            />
            <button
              type="button"
              class="download-button"
              :disabled="!isFormValid || isPreparingDownload"
              :aria-busy="isPreparingDownload"
              @click="downloadClientConfig"
            >
              {{
                isPreparingDownload
                  ? messages.downloadPreparing
                  : messages.downloadButton
              }}
            </button>
          </div>
        </form>

        <BrowserFrame
          v-show="viewMode === 'preview'"
          :eyebrow="messages.previewEyebrow"
          :preview-url="previewUrl"
          :frame-style="previewFrameStyle"
        >
          <PreviewPanel
            v-if="form.clientMode === 'reference-ui'"
            :display-name="form.brand.display_name"
            :ui="form.ui"
            :locale="locale"
            :theme="theme"
          />
        </BrowserFrame>
      </section>
    </div>
  </main>
</template>
