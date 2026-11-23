<script setup lang="ts">
import { ref } from 'vue';
import type { Messages } from '../../i18n';
import type { ClientMessengerPlatform, FormState } from '../../types';

const platforms: ClientMessengerPlatform[] = ['telegram', 'max'];
const props = defineProps<{
  form: FormState;
  messages: Messages;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
}>();
const visibleTokens = ref<Record<ClientMessengerPlatform, boolean>>({
  telegram: false,
  max: false,
});

function platformTitle(platform: ClientMessengerPlatform): string {
  return platform === 'telegram'
    ? props.messages.telegramTitle
    : props.messages.maxTitle;
}

function enabledLabel(platform: ClientMessengerPlatform): string {
  return platform === 'telegram'
    ? props.messages.telegramEnabledLabel
    : props.messages.maxEnabledLabel;
}

function tokenLabel(platform: ClientMessengerPlatform): string {
  return platform === 'telegram'
    ? props.messages.telegramBotTokenLabel
    : props.messages.maxBotTokenLabel;
}

function toggleTokenVisibility(platform: ClientMessengerPlatform): void {
  visibleTokens.value[platform] = !visibleTokens.value[platform];
}
</script>

<template>
  <section class="form-group" aria-labelledby="messengers-group-title">
    <h2 id="messengers-group-title">{{ messages.messengersGroup }}</h2>
    <p class="field-hint">{{ messages.messengersHint }}</p>

    <div class="messenger-grid">
      <fieldset
        v-for="platform in platforms"
        :key="platform"
        class="messenger-platform"
      >
        <legend>{{ platformTitle(platform) }}</legend>
        <label class="checkbox-field" :for="`${platform}-enabled`">
          <input
            :id="`${platform}-enabled`"
            v-model="form.messengers[platform].enabled"
            type="checkbox"
          />
          <span>{{ enabledLabel(platform) }}</span>
        </label>

        <div v-if="form.messengers[platform].enabled" class="messenger-fields">
          <div class="field">
            <label :for="`${platform}-bot-token`">
              {{ tokenLabel(platform) }}
            </label>
            <div class="secret-control">
              <input
                :id="`${platform}-bot-token`"
                v-model="form.messengers[platform].bot_token"
                :type="visibleTokens[platform] ? 'text' : 'password'"
                autocomplete="new-password"
                :aria-invalid="
                  Boolean(errorFor(`messengers.${platform}.bot_token`))
                "
                :aria-describedby="
                  describedBy(
                    `messengers.${platform}.bot_token`,
                    `${platform}-bot-token-hint`,
                  )
                "
              />
              <button
                class="secret-toggle"
                type="button"
                :aria-label="
                  visibleTokens[platform]
                    ? messages.hideMessengerToken
                    : messages.showMessengerToken
                "
                @click="toggleTokenVisibility(platform)"
              >
                <svg
                  v-if="visibleTokens[platform]"
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
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                  />
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
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                  />
                  <path d="m3 3 18 18" />
                </svg>
              </button>
            </div>
            <p :id="`${platform}-bot-token-hint`" class="field-hint">
              {{ messages.secretHint }}
            </p>
            <p
              v-if="errorFor(`messengers.${platform}.bot_token`)"
              :id="`messengers-${platform}-bot_token-error`"
              class="field-error"
            >
              {{ errorFor(`messengers.${platform}.bot_token`) }}
            </p>
          </div>

          <div class="field">
            <label :for="`${platform}-allowed-user-ids`">
              {{ messages.allowedUserIdsLabel }}
            </label>
            <textarea
              :id="`${platform}-allowed-user-ids`"
              v-model="form.messengers[platform].allowed_user_ids_text"
              rows="3"
              spellcheck="false"
              :aria-invalid="
                Boolean(
                  errorFor(
                    `messengers.${platform}.allowed_user_ids_text`,
                  ),
                )
              "
              :aria-describedby="
                describedBy(
                  `messengers.${platform}.allowed_user_ids_text`,
                  `${platform}-allowed-user-ids-hint`,
                )
              "
            />
            <p
              :id="`${platform}-allowed-user-ids-hint`"
              class="field-hint"
            >
              {{ messages.allowedUserIdsHint }}
            </p>
            <p
              v-if="
                errorFor(`messengers.${platform}.allowed_user_ids_text`)
              "
              :id="`messengers-${platform}-allowed_user_ids_text-error`"
              class="field-error"
            >
              {{
                errorFor(`messengers.${platform}.allowed_user_ids_text`)
              }}
            </p>
          </div>

          <div class="field">
            <label :for="`${platform}-locale`">
              {{ messages.messengerLocaleLabel }}
            </label>
            <select
              :id="`${platform}-locale`"
              v-model="form.messengers[platform].locale"
            >
              <option value="ru">{{ messages.localeRu }}</option>
              <option value="en">{{ messages.localeEn }}</option>
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  </section>
</template>
