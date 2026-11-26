<script setup lang="ts">
import {
  CLIENT_CONFIG_DEFAULTS,
  CLIENT_LIMITS,
  KNOWN_MCP_SCENARIOS,
} from '@alekstar79/ykassa-contracts';
import { formatMessage } from '../../composables/useValidation';
import type { Messages } from '../../i18n';
import type {
  FormState,
  NumericField,
  ScenarioChangeHandler,
} from '../../types';

defineProps<{
  form: FormState;
  hasApprovalThreshold: boolean;
  messages: Messages;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
  updateNumber: (field: NumericField, event: Event) => void;
  toggleScenario: ScenarioChangeHandler;
  setHumanConfirmation: (event: Event) => void;
}>();
</script>

<template>
  <section class="form-group" :aria-labelledby="'backend-group-title'">
    <h2 id="backend-group-title">{{ messages.backendGroup }}</h2>

    <fieldset class="field llm-settings">
      <legend>{{ messages.llmSettingsTitle }}</legend>
      <p class="field-hint">{{ messages.llmSettingsHint }}</p>
      <div class="field-grid">
        <div class="field">
          <label for="llm-provider">{{ messages.llmProviderLabel }}</label>
          <select id="llm-provider" v-model="form.llm.provider">
            <option value="openai">OpenAI-compatible / OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        <div class="field">
          <label for="llm-model">{{ messages.llmModelLabel }}</label>
          <input id="llm-model" v-model="form.llm.model" type="text" />
        </div>
        <div class="field">
          <label for="llm-base-url">{{ messages.llmBaseUrlLabel }}</label>
          <input
            id="llm-base-url"
            v-model="form.llm.base_url"
            type="url"
            autocomplete="url"
          />
        </div>
        <div class="field">
          <label for="llm-api-key">{{ messages.llmApiKeyLabel }}</label>
          <input
            id="llm-api-key"
            v-model="form.llm.api_key"
            type="password"
            autocomplete="new-password"
          />
        </div>
      </div>
    </fieldset>

    <fieldset
      class="field scenario-field"
      :aria-invalid="Boolean(errorFor('allowed_scenarios'))"
      :aria-describedby="describedBy('allowed_scenarios', 'scenarios-hint')"
    >
      <legend>{{ messages.scenarioLabel }}</legend>
      <p id="scenarios-hint" class="field-hint">
        {{ messages.scenarioHint }}
      </p>
      <div class="scenario-list">
        <label
          v-for="scenario in KNOWN_MCP_SCENARIOS"
          :key="scenario"
          class="scenario-option"
        >
          <input
            type="checkbox"
            :value="scenario"
            :checked="form.allowed_scenarios.includes(scenario)"
            @change="toggleScenario(scenario, $event)"
          />
          <span>{{ scenario }}</span>
        </label>
      </div>
      <p
        v-if="errorFor('allowed_scenarios')"
        id="allowed_scenarios-error"
        class="field-error"
      >
        {{ errorFor('allowed_scenarios') }}
      </p>
    </fieldset>

    <div class="field-grid backend-grid">
      <div class="field">
        <label for="approval-threshold">
          {{ messages.approvalThresholdLabel }}
        </label>
        <input
          id="approval-threshold"
          :value="hasApprovalThreshold ? form.approval_threshold : ''"
          type="number"
          min="0"
          step="any"
          :aria-invalid="Boolean(errorFor('approval_threshold'))"
          :aria-describedby="
            describedBy('approval_threshold', 'approval-threshold-hint')
          "
          @input="updateNumber('approval_threshold', $event)"
        />
        <p id="approval-threshold-hint" class="field-hint">
          {{ messages.approvalThresholdHint }}
        </p>
        <p v-if="errorFor('approval_threshold')" class="field-error">
          {{ errorFor('approval_threshold') }}
        </p>
      </div>

      <div class="field">
        <label class="checkbox-field" for="require-confirmation">
          <input
            id="require-confirmation"
            type="checkbox"
            :checked="form.require_human_confirmation === true"
            :aria-invalid="Boolean(errorFor('require_human_confirmation'))"
            :aria-describedby="
              describedBy(
                'require_human_confirmation',
                'require-confirmation-hint',
              )
            "
            @change="setHumanConfirmation"
          />
          <span>{{ messages.requireHumanConfirmationLabel }}</span>
        </label>
        <p id="require-confirmation-hint" class="field-hint">
          {{ messages.requireHumanConfirmationHint }}
        </p>
        <p v-if="errorFor('require_human_confirmation')" class="field-error">
          {{ errorFor('require_human_confirmation') }}
        </p>
      </div>
    </div>

    <div class="field-grid limits-grid">
      <div class="field">
        <label for="max-messages">{{ messages.maxMessagesLabel }}</label>
        <input
          id="max-messages"
          :value="form.limits.max_messages"
          type="number"
          :min="CLIENT_LIMITS.max_messages.min"
          :max="CLIENT_LIMITS.max_messages.max"
          step="1"
          :aria-invalid="Boolean(errorFor('limits.max_messages'))"
          :aria-describedby="
            describedBy('limits.max_messages', 'max-messages-hint')
          "
          @input="updateNumber('limits.max_messages', $event)"
        />
        <p id="max-messages-hint" class="field-hint">
          {{
            formatMessage(messages.maxMessagesHint, {
              min: CLIENT_LIMITS.max_messages.min,
              max: CLIENT_LIMITS.max_messages.max,
              default: CLIENT_CONFIG_DEFAULTS.limits.max_messages,
            })
          }}
        </p>
        <p v-if="errorFor('limits.max_messages')" class="field-error">
          {{ errorFor('limits.max_messages') }}
        </p>
      </div>

      <div class="field">
        <label for="max-attachment">{{ messages.maxAttachmentLabel }}</label>
        <input
          id="max-attachment"
          :value="form.limits.max_attachment_kb"
          type="number"
          :min="CLIENT_LIMITS.max_attachment_kb.min"
          :max="CLIENT_LIMITS.max_attachment_kb.max"
          step="1"
          :aria-invalid="Boolean(errorFor('limits.max_attachment_kb'))"
          :aria-describedby="
            describedBy(
              'limits.max_attachment_kb',
              'max-attachment-hint',
            )
          "
          @input="updateNumber('limits.max_attachment_kb', $event)"
        />
        <p id="max-attachment-hint" class="field-hint">
          {{
            formatMessage(messages.maxAttachmentHint, {
              min: CLIENT_LIMITS.max_attachment_kb.min,
              max: CLIENT_LIMITS.max_attachment_kb.max,
              default: CLIENT_CONFIG_DEFAULTS.limits.max_attachment_kb,
            })
          }}
        </p>
        <p v-if="errorFor('limits.max_attachment_kb')" class="field-error">
          {{ errorFor('limits.max_attachment_kb') }}
        </p>
      </div>
    </div>
  </section>
</template>
