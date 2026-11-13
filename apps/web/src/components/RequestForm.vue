<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Messages } from '../i18n';
import type { Attachment, RequestPayload } from '../types';

type FileErrorKey = 'fileTooLarge' | 'fileReadError';
const managerRequest = ref('');
const attachment = ref<Attachment | null>(null);
const attachmentInput = ref<HTMLInputElement | null>(null);
const fileError = ref<FileErrorKey | null>(null);

const props = defineProps<{
  placeholder: string;
  messages: Messages;
  errorMessage: string;
  busy: boolean;
  approvalPending: boolean;
  maxAttachmentKb: number;
  formStyle: 'flat' | 'card';
}>();
const attachmentHint = computed(() =>
  props.messages.attachmentHint.replace(
    '{limit}',
    String(props.maxAttachmentKb),
  ),
);
const visibleFileError = computed(() => {
  if (!fileError.value) return '';
  return props.messages[fileError.value].replace(
    '{limit}',
    String(props.maxAttachmentKb),
  );
});

const emit = defineEmits<{
  submit: [payload: RequestPayload];
  clearError: [];
}>();

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

function removeAttachment(): void {
  attachment.value = null;
  if (attachmentInput.value) {
    attachmentInput.value.value = '';
  }
}

function submitRequest(): void {
  fileError.value = null;
  emit('submit', {
    message: managerRequest.value.trim(),
    attachment: attachment.value,
  });
}
</script>

<template>
  <form
    class="request-form"
    :class="{ 'form--card': props.formStyle === 'card' }"
    @submit.prevent="submitRequest"
  >
    <label class="field-label" for="request">
      {{ props.messages.requestLabel }}
    </label>
    <textarea
      id="request"
      v-model="managerRequest"
      rows="4"
      :placeholder="props.placeholder"
      required
      :disabled="props.busy || props.approvalPending"
    />

    <label
      class="file-drop-zone"
      :class="{ 'is-disabled': props.busy || props.approvalPending }"
      for="attachment-file"
    >
      <input
        id="attachment-file"
        ref="attachmentInput"
        class="sr-only"
        type="file"
        :disabled="props.busy || props.approvalPending"
        @change="handleAttachmentChange"
      />
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
      <span class="file-copy">
        <strong>{{ props.messages.attachmentLabel }}</strong>
        <small>{{ attachmentHint }}</small>
      </span>
      <span class="file-action">{{ props.messages.chooseFile }}</span>
    </label>

    <div v-if="attachment" class="file-badge" aria-live="polite">
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

    <button
      class="primary-button"
      type="submit"
      :disabled="props.busy || props.approvalPending"
    >
      {{ props.busy ? props.messages.sending : props.messages.send }}
    </button>
    <p
      v-if="visibleFileError || props.errorMessage"
      class="error-message"
      role="alert"
    >
      {{ visibleFileError || props.errorMessage }}
    </p>
  </form>
</template>

<style scoped src="./RequestForm.css"></style>
