<script setup lang="ts">
import type { Messages } from '../../i18n';
import type { FormState } from '../../types';

const CLIENT_NAME_HTML_PATTERN = '^[a-z][a-z0-9\\-]{1,30}$';

defineProps<{
  form: FormState;
  messages: Messages;
  showMcpToken: boolean;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
}>();

const emit = defineEmits<{
  'toggle-secret': [];
}>();
</script>

<template>
  <section class="form-group" :aria-labelledby="'client-group-title'">
    <h2 id="client-group-title">{{ messages.clientGroup }}</h2>
    <div class="field-grid">
      <div class="field">
        <label for="client-name">{{ messages.nameLabel }}</label>
        <input
          id="client-name"
          v-model="form.name"
          type="text"
          autocomplete="off"
          :pattern="CLIENT_NAME_HTML_PATTERN"
          :aria-invalid="Boolean(errorFor('name'))"
          :aria-describedby="describedBy('name', 'client-name-hint')"
        />
        <p id="client-name-hint" class="field-hint name-hint">
          {{ messages.nameHint }}
        </p>
        <p v-if="errorFor('name')" id="name-error" class="field-error">
          {{ errorFor('name') }}
        </p>
      </div>

      <div class="field">
        <label for="shop-id">{{ messages.shopIdLabel }}</label>
        <input
          id="shop-id"
          v-model="form.shop_id"
          type="text"
          autocomplete="new-password"
          :aria-invalid="Boolean(errorFor('shop_id'))"
          :aria-describedby="describedBy('shop_id', 'shop-id-hint')"
        />
        <p id="shop-id-hint" class="field-hint">{{ messages.secretHint }}</p>
        <p v-if="errorFor('shop_id')" id="shop_id-error" class="field-error">
          {{ errorFor('shop_id') }}
        </p>
      </div>

      <div class="field">
        <label for="mcp-token">{{ messages.mcpTokenLabel }}</label>
        <div class="secret-control">
          <input
            id="mcp-token"
            v-model="form.mcp_token"
            :type="showMcpToken ? 'text' : 'password'"
            autocomplete="new-password"
            :aria-invalid="Boolean(errorFor('mcp_token'))"
            :aria-describedby="describedBy('mcp_token', 'mcp-token-hint')"
          />
          <button
            class="secret-toggle"
            type="button"
            :aria-label="showMcpToken ? messages.hideMcpToken : messages.showMcpToken"
            @click="emit('toggle-secret')"
          >
            <svg
              v-if="showMcpToken"
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <path d="m3 3 18 18" />
            </svg>
          </button>
        </div>
        <p id="mcp-token-hint" class="field-hint">{{ messages.secretHint }}</p>
        <p v-if="errorFor('mcp_token')" id="mcp_token-error" class="field-error">
          {{ errorFor('mcp_token') }}
        </p>
      </div>
    </div>
  </section>
</template>
