<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
} from 'vue';
import { CLIENT_VAT_CODES } from '@alekstar79/ykassa-contracts';
import type { ClientVatCode } from '@alekstar79/ykassa-contracts';
import type { Messages } from '../i18n';
import {
  readUiDefaults,
  saveUiDefaults,
} from '../composables/uiDefaults.js';
import type { Attachment, RequestPayload, UiDefaults } from '../types';

type FileErrorKey = 'fileTooLarge' | 'fileReadError';
type SettingsErrorKey =
  | 'invalidReturnUrl'
  | 'invalidInvoiceExpiry'
  | 'settingsSaveError';

const VAT_CODE_MESSAGE_KEYS = {
  1: 'vatNoVat',
  2: 'vatZero',
  3: 'vatTen',
  4: 'vatTwenty',
  5: 'vatTenCalculated',
  6: 'vatTwentyCalculated',
  7: 'vatFive',
  8: 'vatSeven',
  9: 'vatFiveCalculated',
  10: 'vatSevenCalculated',
  11: 'vatTwentyTwo',
  12: 'vatTwentyTwoCalculated',
} satisfies Record<ClientVatCode, keyof Messages>;

const managerRequest = ref<string>('');
const attachment = shallowRef<Attachment | null>(null);
const attachmentInput = shallowRef<HTMLInputElement | null>(null);
const requestInput = shallowRef<HTMLTextAreaElement | null>(null);
const actionsRef = shallowRef<HTMLElement | null>(null);
const settingsDialog = shallowRef<HTMLDialogElement | null>(null);
const currencySelectRoot = shallowRef<HTMLDivElement | null>(null);
const currencyTrigger = shallowRef<HTMLButtonElement | null>(null);
const currencyListbox = shallowRef<HTMLDivElement | null>(null);
const vatSelectRoot = shallowRef<HTMLDivElement | null>(null);
const vatTrigger = shallowRef<HTMLButtonElement | null>(null);
const vatListbox = shallowRef<HTMLDivElement | null>(null);
const fileError = ref<FileErrorKey | null>(null);
const settingsError = ref<SettingsErrorKey | null>(null);
const menuOpen = ref<boolean>(false);
const settings = ref<UiDefaults>(readUiDefaults());
const currencyOptionsOpen = ref<boolean>(false);
const activeCurrency = ref<UiDefaults['currency']>(settings.value.currency);
const vatOptionsOpen = ref<boolean>(false);
const activeVatCode = ref<ClientVatCode>(settings.value.vat_code);
const CURRENCY_CODES: readonly UiDefaults['currency'][] = ['RUB', 'USD', 'EUR'];

const props = defineProps<{
  placeholder: string;
  messages: Messages;
  errorMessage: string;
  busy: boolean;
  approvalPending: boolean;
  maxAttachmentKb: number;
  formStyle: 'flat' | 'card';
}>();
const visibleFileError = computed(() => {
  if (!fileError.value) return '';
  return props.messages[fileError.value].replace(
    '{limit}',
    String(props.maxAttachmentKb),
  );
});
const visibleSettingsError = computed(() =>
  settingsError.value ? props.messages[settingsError.value] : '',
);
const submitDisabled = computed(
  () =>
    props.busy ||
    props.approvalPending ||
    managerRequest.value.trim().length === 0,
);

const emit = defineEmits<{
  (event: 'submit', payload: RequestPayload): void;
  (event: 'clearError'): void;
}>();

function handleDocumentPointerDown(event: PointerEvent): void {
  if (
    event.target instanceof Node &&
    !actionsRef.value?.contains(event.target)
  ) {
    menuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});

async function handleAttachmentChange(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  emit('clearError');
  fileError.value = null;
  const file = input.files?.[0];
  if (!file) return;

  attachment.value = null;
  if (file.size > props.maxAttachmentKb * 1024) {
    fileError.value = 'fileTooLarge';
    input.value = '';
    return;
  }

  try {
    attachment.value = {
      filename: file.name,
      content: await file.text(),
      bytes: file.size,
    };
  } catch {
    fileError.value = 'fileReadError';
    input.value = '';
  }
}

function resizeRequestInput(): void {
  const input = requestInput.value;
  if (!input) return;

  input.style.height = 'auto';
  const styles = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(styles.lineHeight);
  const maxHeight =
    lineHeight * 5 +
    Number.parseFloat(styles.paddingTop) +
    Number.parseFloat(styles.paddingBottom);
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function removeAttachment(): void {
  attachment.value = null;

  if (attachmentInput.value) {
    attachmentInput.value.value = '';
  }
}

function openAttachmentPicker(): void {
  menuOpen.value = false;
  void nextTick(() => attachmentInput.value?.click());
}

function openSettings(): void {
  settings.value = readUiDefaults();
  settingsError.value = null;
  menuOpen.value = false;
  settingsDialog.value?.showModal();
}

function closeSettings(): void {
  currencyOptionsOpen.value = false;
  vatOptionsOpen.value = false;
  settingsDialog.value?.close();
  settingsError.value = null;
}

async function openCurrencyOptions(): Promise<void> {
  activeCurrency.value = settings.value.currency;
  currencyOptionsOpen.value = true;
  await nextTick();
  focusCurrencyOption(activeCurrency.value);
}

function toggleCurrencyOptions(): void {
  if (currencyOptionsOpen.value) {
    closeCurrencyOptions();
    return;
  }
  void openCurrencyOptions();
}

function closeCurrencyOptions(restoreFocus = true): void {
  currencyOptionsOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => currencyTrigger.value?.focus());
  }
}

function focusCurrencyOption(currency: UiDefaults['currency']): void {
  for (const child of Array.from(currencyListbox.value?.children ?? [])) {
    if (
      child instanceof HTMLButtonElement &&
      child.dataset.currency === currency
    ) {
      child.focus();
      return;
    }
  }
}

function moveActiveCurrency(direction: -1 | 1): void {
  const index = CURRENCY_CODES.indexOf(activeCurrency.value);
  const nextIndex =
    (index + direction + CURRENCY_CODES.length) % CURRENCY_CODES.length;
  const currency = CURRENCY_CODES[nextIndex];
  if (currency === undefined) return;

  activeCurrency.value = currency;
  void nextTick(() => focusCurrencyOption(currency));
}

function handleCurrencyTriggerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  void openCurrencyOptions();
}

function handleCurrencyListKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveCurrency(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const currency =
      event.key === 'Home'
        ? CURRENCY_CODES[0]
        : CURRENCY_CODES[CURRENCY_CODES.length - 1];
    if (!currency) return;
    activeCurrency.value = currency;
    void nextTick(() => focusCurrencyOption(currency));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectCurrency(activeCurrency.value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeCurrencyOptions();
  }
}

function selectCurrency(currency: UiDefaults['currency']): void {
  settings.value.currency = currency;
  closeCurrencyOptions();
}

function handleCurrencyFocusout(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (
    nextTarget instanceof Node &&
    currencySelectRoot.value?.contains(nextTarget)
  ) {
    return;
  }
  currencyOptionsOpen.value = false;
}

function getVatCodeLabel(vatCode: ClientVatCode): string {
  return `${vatCode} (${props.messages[VAT_CODE_MESSAGE_KEYS[vatCode]]})`;
}

async function openVatOptions(): Promise<void> {
  activeVatCode.value = settings.value.vat_code;
  vatOptionsOpen.value = true;
  await nextTick();
  focusVatOption(activeVatCode.value);
}

function toggleVatOptions(): void {
  if (vatOptionsOpen.value) {
    closeVatOptions();
    return;
  }
  void openVatOptions();
}

function closeVatOptions(restoreFocus = true): void {
  vatOptionsOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => vatTrigger.value?.focus());
  }
}

function focusVatOption(vatCode: ClientVatCode): void {
  for (const child of Array.from(vatListbox.value?.children ?? [])) {
    if (
      child instanceof HTMLButtonElement &&
      child.dataset.vatCode === String(vatCode)
    ) {
      child.focus();
      return;
    }
  }
}

function moveActiveVatCode(direction: -1 | 1): void {
  const index = CLIENT_VAT_CODES.indexOf(activeVatCode.value);
  const nextIndex =
    (index + direction + CLIENT_VAT_CODES.length) % CLIENT_VAT_CODES.length;
  const nextVatCode = CLIENT_VAT_CODES[nextIndex];
  activeVatCode.value = nextVatCode;
  void nextTick(() => focusVatOption(nextVatCode));
}

function handleVatTriggerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  void openVatOptions();
}

function handleVatListKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveVatCode(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const vatCode =
      event.key === 'Home'
        ? CLIENT_VAT_CODES[0]
        : CLIENT_VAT_CODES[CLIENT_VAT_CODES.length - 1];
    activeVatCode.value = vatCode;
    void nextTick(() => focusVatOption(vatCode));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectVatCode(activeVatCode.value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeVatOptions();
  }
}

function selectVatCode(vatCode: ClientVatCode): void {
  settings.value.vat_code = vatCode;
  closeVatOptions();
}

function handleVatFocusout(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (
    nextTarget instanceof Node &&
    vatSelectRoot.value?.contains(nextTarget)
  ) {
    return;
  }
  vatOptionsOpen.value = false;
}

function handleSettingsPointerDown(event: PointerEvent): void {
  if (!(event.target instanceof Node)) {
    currencyOptionsOpen.value = false;
    vatOptionsOpen.value = false;
    return;
  }

  const inCurrency = currencySelectRoot.value?.contains(event.target) ?? false;
  const inVat = vatSelectRoot.value?.contains(event.target) ?? false;
  if (!inCurrency) currencyOptionsOpen.value = false;
  if (!inVat) vatOptionsOpen.value = false;
}

function handleDialogBackdropClick(event: MouseEvent): void {
  if (event.target === settingsDialog.value) closeSettings();
}

function saveSettings(): void {
  settingsError.value = null;
  if (
    settings.value.return_url !== '' &&
    !/^https?:\/\//i.test(settings.value.return_url)
  ) {
    settingsError.value = 'invalidReturnUrl';
    return;
  }
  if (
    !Number.isInteger(settings.value.invoice_expiry_days) ||
    settings.value.invoice_expiry_days < 1 ||
    settings.value.invoice_expiry_days > 30
  ) {
    settingsError.value = 'invalidInvoiceExpiry';
    return;
  }

  try {
    saveUiDefaults({
      ...settings.value,
      return_url: settings.value.return_url.trim(),
    });
  } catch {
    settingsError.value = 'settingsSaveError';
    return;
  }
  currencyOptionsOpen.value = false;
  vatOptionsOpen.value = false;
  settingsDialog.value?.close();
}

function submitRequest(): void {
  if (submitDisabled.value) return;
  fileError.value = null;
  emit('submit', {
    message: managerRequest.value.trim(),
    attachment: attachment.value,
  });
  managerRequest.value = '';
  removeAttachment();
  void nextTick(resizeRequestInput);
}
</script>

<template>
  <div class="request-form-shell">
    <form
      class="request-form"
      @submit.prevent="submitRequest"
      @keydown.esc="menuOpen = false"
    >
      <input
        id="attachment-file"
        ref="attachmentInput"
        class="sr-only"
        type="file"
        :aria-label="props.messages.uploadAttachment"
        :disabled="props.busy || props.approvalPending"
        @change="handleAttachmentChange"
      />

      <div
        class="chat-input-container"
        :class="{
          'chat-input-container--flat': props.formStyle === 'flat',
          'chat-input-container--card': props.formStyle === 'card',
        }"
      >
        <div v-if="attachment" class="file-badge" aria-live="polite">
          <svg
            class="file-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="m8.5 12.5 6.8-6.8a3.1 3.1 0 0 1 4.4 4.4l-9.2 9.2a5 5 0 0 1-7.1-7.1l9.2-9.2"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.6"
            />
          </svg>
          <span class="file-badge-copy">
            <strong>{{ attachment.filename }}</strong>
            <small>{{ attachment.bytes }} {{ props.messages.bytes }}</small>
          </span>
          <button
            class="remove-file-button"
            type="button"
            :disabled="props.busy || props.approvalPending"
            :aria-label="`${props.messages.removeFile} ${attachment.filename}`"
            @click="removeAttachment"
          >
            ×
          </button>
        </div>

        <textarea
          id="request"
          ref="requestInput"
          v-model="managerRequest"
          class="chat-textarea"
          rows="1"
          :aria-label="props.messages.requestLabel"
          :placeholder="props.placeholder"
          :disabled="props.busy || props.approvalPending"
          @input="resizeRequestInput"
        />

        <div class="chat-actions">
          <div ref="actionsRef" class="request-actions">
            <button
              class="add-menu-button"
              type="button"
              :aria-label="props.messages.addActions"
              :aria-expanded="menuOpen"
              aria-controls="request-actions-menu"
              :disabled="props.busy || props.approvalPending"
              @click="menuOpen = !menuOpen"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="2"
                />
              </svg>
            </button>

            <div
              v-if="menuOpen"
              id="request-actions-menu"
              class="action-menu"
              :aria-label="props.messages.addActions"
            >
              <button type="button" @click="openAttachmentPicker">
                {{ props.messages.uploadAttachment }}
              </button>
              <button type="button" @click="openSettings">
                {{ props.messages.settings }}
              </button>
            </div>
          </div>

          <button
            class="primary-button chat-send-button"
            type="submit"
            :aria-label="
              props.busy ? props.messages.sending : props.messages.send
            "
            :disabled="submitDisabled"
          >
            <span
              v-if="props.busy"
              class="send-spinner"
              role="status"
              :aria-label="props.messages.sending"
            />
            <svg
              v-else
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 19V5m0 0L6 11m6-6 6 6"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </button>
        </div>
      </div>

      <p
        v-if="visibleFileError || props.errorMessage"
        class="error-message"
        role="alert"
      >
        {{ visibleFileError || props.errorMessage }}
      </p>
    </form>

    <dialog
      ref="settingsDialog"
      class="settings-dialog"
      :aria-labelledby="'settings-dialog-title'"
      @cancel.prevent="closeSettings"
      @keydown.esc.prevent.stop="closeSettings"
      @click="handleDialogBackdropClick"
    >
      <form
        class="settings-form"
        @submit.prevent="saveSettings"
        @pointerdown="handleSettingsPointerDown"
      >
        <h2 id="settings-dialog-title">{{ props.messages.settingsTitle }}</h2>
        <div class="settings-select-setting">
          <span id="currency-label">{{ props.messages.currency }}</span>
          <div
            ref="currencySelectRoot"
            class="settings-select"
            @focusout="handleCurrencyFocusout"
          >
            <button
              ref="currencyTrigger"
              class="settings-select-trigger"
              type="button"
              aria-labelledby="currency-label currency-value"
              aria-haspopup="listbox"
              :aria-expanded="currencyOptionsOpen"
              aria-controls="currency-options"
              @click="toggleCurrencyOptions"
              @keydown="handleCurrencyTriggerKeydown"
            >
              <span id="currency-value">{{ settings.currency }}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path
                  d="m4 6 4 4 4-4"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                />
              </svg>
            </button>
            <div
              v-if="currencyOptionsOpen"
              id="currency-options"
              ref="currencyListbox"
              class="settings-option-list"
              role="listbox"
              aria-labelledby="currency-label"
              @keydown="handleCurrencyListKeydown"
            >
              <button
                v-for="currency in CURRENCY_CODES"
                :key="currency"
                :data-currency="currency"
                class="settings-option"
                type="button"
                role="option"
                :aria-selected="settings.currency === currency"
                :tabindex="activeCurrency === currency ? 0 : -1"
                @focus="activeCurrency = currency"
                @click="selectCurrency(currency)"
              >
                {{ currency }}
              </button>
            </div>
          </div>
        </div>
        <div class="settings-select-setting">
          <span id="vat-code-label">{{ props.messages.vatCode }}</span>
          <div
            ref="vatSelectRoot"
            class="settings-select"
            @focusout="handleVatFocusout"
          >
            <button
              ref="vatTrigger"
              class="settings-select-trigger"
              type="button"
              aria-labelledby="vat-code-label vat-code-value"
              aria-haspopup="listbox"
              :aria-expanded="vatOptionsOpen"
              aria-controls="vat-code-options"
              @click="toggleVatOptions"
              @keydown="handleVatTriggerKeydown"
            >
              <span id="vat-code-value">
                {{ getVatCodeLabel(settings.vat_code) }}
              </span>
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path
                  d="m4 6 4 4 4-4"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                />
              </svg>
            </button>
            <div
              v-if="vatOptionsOpen"
              id="vat-code-options"
              ref="vatListbox"
              class="settings-option-list"
              role="listbox"
              aria-labelledby="vat-code-label"
              @keydown="handleVatListKeydown"
            >
              <button
                v-for="vatCode in CLIENT_VAT_CODES"
                :key="vatCode"
                :data-vat-code="vatCode"
                class="settings-option"
                type="button"
                role="option"
                :aria-selected="settings.vat_code === vatCode"
                :tabindex="activeVatCode === vatCode ? 0 : -1"
                @focus="activeVatCode = vatCode"
                @click="selectVatCode(vatCode)"
              >
                {{ getVatCodeLabel(vatCode) }}
              </button>
            </div>
          </div>
        </div>
        <label class="settings-checkbox">
          <input v-model="settings.capture" type="checkbox" />
          <span>{{ props.messages.capture }}</span>
        </label>
        <label>
          <span>{{ props.messages.returnUrl }}</span>
          <input
            v-model="settings.return_url"
            type="text"
            inputmode="url"
            autocomplete="url"
          />
          <small>{{ props.messages.returnUrlHint }}</small>
        </label>
        <label>
          <span>{{ props.messages.invoiceExpiryDays }}</span>
          <input
            v-model.number="settings.invoice_expiry_days"
            type="number"
            min="1"
            max="30"
            step="1"
          />
        </label>

        <p v-if="visibleSettingsError" class="error-message" role="alert">
          {{ visibleSettingsError }}
        </p>

        <div class="settings-actions">
          <button class="primary-button" type="submit">
            {{ props.messages.saveSettings }}
          </button>
          <button class="secondary-button" type="button" @click="closeSettings">
            {{ props.messages.cancel }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped src="./RequestForm.css"></style>
