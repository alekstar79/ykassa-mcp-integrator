<script setup lang="ts">
import {
  CLIENT_ACCENTS,
  CLIENT_FONT_PAIRS,
  CLIENT_FORM_STYLES,
  CLIENT_H1_SIZES,
  CLIENT_RADII,
  CLIENT_SHADOWS,
} from '@alekstar79/ykassa-contracts';
import type { Messages } from '../../i18n';
import type { FormState } from '../../types';

defineProps<{
  form: FormState;
  messages: Messages;
  accentSample: string;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
}>();
</script>

<template>
  <div class="ui-settings">
    <h3 class="visual-settings-heading">
      {{ messages.visualSettingsHeading }}
    </h3>
    <div class="ui-settings-groups">
      <section class="ui-settings-group">
        <h4>{{ messages.brandGroup }}</h4>
        <div class="field">
          <label for="display-name">{{ messages.displayNameLabel }}</label>
          <input
            id="display-name"
            v-model="form.brand.display_name"
            type="text"
            :aria-invalid="Boolean(errorFor('brand.display_name'))"
            :aria-describedby="
              describedBy('brand.display_name', 'display-name-hint')
            "
          />
          <p id="display-name-hint" class="field-hint">
            {{ messages.displayNameHint }}
          </p>
          <p v-if="errorFor('brand.display_name')" class="field-error">
            {{ errorFor('brand.display_name') }}
          </p>
        </div>
      </section>

      <section class="ui-settings-group">
        <h4>{{ messages.styleGroup }}</h4>
        <div class="field-grid ui-grid">
          <div class="field">
            <label for="ui-accent">{{ messages.accentLabel }}</label>
            <div class="select-with-swatch">
              <span
                class="select-swatch"
                :style="{ backgroundColor: accentSample }"
                aria-hidden="true"
              />
              <select
                id="ui-accent"
                v-model="form.ui.accent"
                :aria-invalid="Boolean(errorFor('ui.accent'))"
                :aria-describedby="describedBy('ui.accent', 'ui-accent-hint')"
              >
                <option
                  v-for="accent in CLIENT_ACCENTS"
                  :key="accent"
                  :value="accent"
                >
                  {{ accent }}
                </option>
              </select>
            </div>
            <p id="ui-accent-hint" class="field-hint">
              {{ messages.accentHint }}
            </p>
            <p v-if="errorFor('ui.accent')" class="field-error">
              {{ errorFor('ui.accent') }}
            </p>
          </div>

          <div class="field">
            <label for="ui-radius">{{ messages.radiusLabel }}</label>
            <select
              id="ui-radius"
              v-model.number="form.ui.radius"
              :aria-invalid="Boolean(errorFor('ui.radius'))"
              :aria-describedby="describedBy('ui.radius', 'ui-radius-hint')"
            >
              <option
                v-for="radius in CLIENT_RADII"
                :key="radius"
                :value="radius"
              >
                {{ radius }}
              </option>
            </select>
            <p id="ui-radius-hint" class="field-hint">
              {{ messages.radiusHint }}
            </p>
            <p v-if="errorFor('ui.radius')" class="field-error">
              {{ errorFor('ui.radius') }}
            </p>
          </div>

          <div class="field">
            <label for="ui-shadow">{{ messages.shadowLabel }}</label>
            <select
              id="ui-shadow"
              v-model="form.ui.shadow"
              :aria-invalid="Boolean(errorFor('ui.shadow'))"
              :aria-describedby="describedBy('ui.shadow', 'ui-shadow-hint')"
            >
              <option v-for="shadow in CLIENT_SHADOWS" :key="shadow">
                {{ shadow }}
              </option>
            </select>
            <p id="ui-shadow-hint" class="field-hint">
              {{ messages.shadowHint }}
            </p>
            <p v-if="errorFor('ui.shadow')" class="field-error">
              {{ errorFor('ui.shadow') }}
            </p>
          </div>
        </div>
      </section>

      <section class="ui-settings-group">
        <h4>{{ messages.formTypographyGroup }}</h4>
        <div class="field-grid ui-grid">
          <div class="field">
            <label for="ui-font-pair">{{ messages.fontPairLabel }}</label>
            <select
              id="ui-font-pair"
              v-model="form.ui.font_pair"
              :aria-invalid="Boolean(errorFor('ui.font_pair'))"
              :aria-describedby="
                describedBy('ui.font_pair', 'ui-font-pair-hint')
              "
            >
              <option
                v-for="fontPair in CLIENT_FONT_PAIRS"
                :key="fontPair"
                :value="fontPair"
              >
                {{ fontPair }}
              </option>
            </select>
            <p id="ui-font-pair-hint" class="field-hint">
              {{ messages.fontPairHint }}
            </p>
            <p v-if="errorFor('ui.font_pair')" class="field-error">
              {{ errorFor('ui.font_pair') }}
            </p>
          </div>

          <div class="field">
            <label for="ui-form-style">{{ messages.formStyleLabel }}</label>
            <select
              id="ui-form-style"
              v-model="form.ui.form_style"
              :aria-invalid="Boolean(errorFor('ui.form_style'))"
              :aria-describedby="
                describedBy('ui.form_style', 'ui-form-style-hint')
              "
            >
              <option
                v-for="formStyle in CLIENT_FORM_STYLES"
                :key="formStyle"
                :value="formStyle"
              >
                {{ formStyle }}
              </option>
            </select>
            <p id="ui-form-style-hint" class="field-hint">
              {{ messages.formStyleHint }}
            </p>
            <p v-if="errorFor('ui.form_style')" class="field-error">
              {{ errorFor('ui.form_style') }}
            </p>
          </div>

          <div class="field">
            <label for="ui-h1-size">{{ messages.h1SizeLabel }}</label>
            <select
              id="ui-h1-size"
              v-model="form.ui.h1_size"
              :aria-invalid="Boolean(errorFor('ui.h1_size'))"
              :aria-describedby="
                describedBy('ui.h1_size', 'ui-h1-size-hint')
              "
            >
              <option
                v-for="size in CLIENT_H1_SIZES"
                :key="size"
                :value="size"
              >
                {{ size }}
              </option>
            </select>
            <p id="ui-h1-size-hint" class="field-hint">
              {{ messages.h1SizeHint }}
            </p>
            <p v-if="errorFor('ui.h1_size')" class="field-error">
              {{ errorFor('ui.h1_size') }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
