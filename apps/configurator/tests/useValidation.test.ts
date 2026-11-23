import { computed, ref, type Ref } from 'vue';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_CONFIG_DEFAULTS,
  ClientConfigSchema,
} from '@alekstar79/ykassa-contracts';
import { translations } from '../src/i18n.js';
import { useValidation } from '../src/composables/useValidation.js';
import type { FormState } from '../src/types.js';

function validForm(): Ref<FormState> {
  return ref({
    name: 'online-school',
    shop_id: '123456789',
    mcp_token: 'test-mcp-token-123456',
    clientMode: 'reference-ui',
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: { display_name: 'Online School' },
    ui: { ...CLIENT_CONFIG_DEFAULTS.ui },
    limits: { ...CLIENT_CONFIG_DEFAULTS.limits },
    messengers: {
      telegram: {
        enabled: false,
        allowed_user_ids_text: '',
        locale: 'ru',
        bot_token: '',
      },
      max: {
        enabled: false,
        allowed_user_ids_text: '',
        locale: 'ru',
        bot_token: '',
      },
    },
  });
}

function createValidation(form: Ref<FormState>, thresholdSet = true) {
  return useValidation(
    form,
    ref(thresholdSet),
    computed(() => translations.ru),
  );
}

describe('useValidation', () => {
  it('accepts a valid contract and rejects names outside the client slug pattern', () => {
    const form = validForm();
    const validation = createValidation(form);
    const parsed = ClientConfigSchema.safeParse({
      allowed_scenarios: form.value.allowed_scenarios,
      approval_threshold: form.value.approval_threshold,
      require_human_confirmation: form.value.require_human_confirmation,
      brand: form.value.brand,
      ui: form.value.ui,
      limits: form.value.limits,
    });

    expect(parsed.success).toBe(true);
    expect(validation.isFormValid.value).toBe(true);
    expect(validation.validationSummary.value).toEqual([]);

    for (const name of ['Online-school', '1-school', 'has space', 'a', 'a'.repeat(32)]) {
      form.value.name = name;
      expect(validation.errorFor('name')).toBe(
        translations.ru.errors.nameInvalid,
      );
    }

    form.value.name = 'a1';
    expect(validation.errorFor('name')).toBeUndefined();
  });

  it('maps schema failures and missing credentials to field and summary errors', () => {
    const form = validForm();
    form.value.name = '';
    form.value.shop_id = '';
    form.value.mcp_token = '';
    form.value.allowed_scenarios = [];
    form.value.limits.max_messages = 0;
    form.value.limits.max_attachment_kb = 1025;
    const validation = createValidation(form, false);

    expect(validation.isFormValid.value).toBe(false);
    expect(validation.fieldErrors.value).toMatchObject({
      name: translations.ru.errors.nameRequired,
      shop_id: translations.ru.errors.shopIdRequired,
      mcp_token: translations.ru.errors.mcpTokenRequired,
      allowed_scenarios: translations.ru.errors.scenariosRequired,
      approval_threshold: translations.ru.errors.approvalThreshold,
      'limits.max_messages': 'Введите целое число от 1 до 100.',
      'limits.max_attachment_kb': 'Введите целое число от 1 до 1024.',
    });
    expect(validation.validationSummary.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          label: translations.ru.nameSummaryLabel,
        }),
        expect.objectContaining({
          field: 'shop_id',
          label: translations.ru.shopIdLabel,
        }),
      ]),
    );
    expect(validation.errorFor('allowed_scenarios')).toBe(
      translations.ru.errors.scenariosRequired,
    );
    expect(
      validation.describedBy('allowed_scenarios', 'scenarios-hint'),
    ).toBe('scenarios-hint allowed_scenarios-error');
    expect(
      validation.formatMessage('Maximum: {max}; minimum: {min}', {
        min: 1,
        max: 100,
      }),
    ).toBe('Maximum: 100; minimum: 1');
  });

  it.each([
    '<MCP_TOKEN>',
    'your-mcp-token',
    'xxx',
    'replace-me-later',
    'placeholder-token',
  ])('rejects placeholder MCP token %s', (token) => {
    const form = validForm();
    form.value.mcp_token = token;
    const validation = createValidation(form);

    expect(validation.errorFor('mcp_token')).toBe(
      translations.ru.errors.mcpTokenPlaceholder,
    );
    expect(validation.isFormValid.value).toBe(false);
  });

  it('validates messenger credentials only for the messenger client type', () => {
    const form = validForm();
    const validation = createValidation(form);

    expect(validation.isFormValid.value).toBe(true);

    form.value.messengers.telegram.enabled = true;
    expect(validation.isFormValid.value).toBe(true);

    form.value.clientMode = 'messengers';
    expect(validation.errorFor('clientMode')).toBeUndefined();
    expect(validation.errorFor('messengers.telegram.bot_token')).toBe(
      translations.ru.errors.messengerTokenRequired,
    );
    expect(
      validation.errorFor('messengers.telegram.allowed_user_ids_text'),
    ).toBe(translations.ru.errors.messengerAllowlistRequired);

    form.value.messengers.telegram.bot_token = 'telegram-token-123';
    form.value.messengers.telegram.allowed_user_ids_text = '101\n202';
    expect(validation.errorFor('messengers.telegram.bot_token')).toBeUndefined();
    expect(
      validation.errorFor('messengers.telegram.allowed_user_ids_text'),
    ).toBeUndefined();

    form.value.messengers.telegram.bot_token = 'your-bot-token';
    expect(validation.errorFor('messengers.telegram.bot_token')).toBe(
      translations.ru.errors.messengerTokenPlaceholder,
    );
  });

  it('requires at least one enabled messenger only for the messenger client type', () => {
    const form = validForm();
    const validation = createValidation(form);

    form.value.clientMode = 'messengers';
    expect(validation.errorFor('clientMode')).toBe(
      translations.ru.errors.messengerRequired,
    );

    form.value.messengers.telegram.enabled = true;
    expect(validation.errorFor('clientMode')).toBeUndefined();
  });
});
