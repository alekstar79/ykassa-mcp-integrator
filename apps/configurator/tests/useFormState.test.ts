import { describe, expect, it } from 'vitest';
import { CLIENT_CONFIG_DEFAULTS } from '@alekstar79/ykassa-contracts';
import { useFormState } from '../src/composables/useFormState.js';

function eventWithTarget(target: object): Event {
  const event = new Event('input');
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('useFormState', () => {
  it('starts with an empty client form and contract defaults', () => {
    const { form, hasApprovalThreshold } = useFormState();

    expect(form.value).toEqual({
      name: '',
      shop_id: '',
      mcp_token: '',
      clientMode: 'reference-ui',
      allowed_scenarios: [],
      approval_threshold: 0,
      require_human_confirmation: false,
      brand: { display_name: '' },
      ui: CLIENT_CONFIG_DEFAULTS.ui,
      limits: CLIENT_CONFIG_DEFAULTS.limits,
      messengers: {
        telegram: {
          enabled: false,
          allowed_user_ids_text: '',
          locale: CLIENT_CONFIG_DEFAULTS.messengers.telegram.locale,
          bot_token: '',
        },
        max: {
          enabled: false,
          allowed_user_ids_text: '',
          locale: CLIENT_CONFIG_DEFAULTS.messengers.max.locale,
          bot_token: '',
        },
      },
    });
    expect(hasApprovalThreshold.value).toBe(false);
  });

  it('updates the approval threshold and marks it as explicitly set', () => {
    const { form, hasApprovalThreshold, updateNumber } = useFormState();

    updateNumber(
      'approval_threshold',
      eventWithTarget({ value: '1250', valueAsNumber: 1250 }),
    );

    expect(form.value.approval_threshold).toBe(1250);
    expect(hasApprovalThreshold.value).toBe(true);
  });

  it('clears the optional threshold and updates numeric limits', () => {
    const { form, hasApprovalThreshold, updateNumber } = useFormState();

    updateNumber(
      'approval_threshold',
      eventWithTarget({ value: '', valueAsNumber: Number.NaN }),
    );
    updateNumber(
      'limits.max_messages',
      eventWithTarget({ value: '40', valueAsNumber: 40 }),
    );
    updateNumber(
      'limits.max_attachment_kb',
      eventWithTarget({ value: '256', valueAsNumber: 256 }),
    );
    updateNumber(
      'limits.max_messages',
      eventWithTarget({ value: '', valueAsNumber: Number.NaN }),
    );

    expect(hasApprovalThreshold.value).toBe(false);
    expect(form.value.approval_threshold).toBe(0);
    expect(form.value.limits.max_messages).toBeNaN();
    expect(form.value.limits.max_attachment_kb).toBe(256);
  });

  it('adds and removes a scenario without duplicates', () => {
    const { form, toggleScenario } = useFormState();

    toggleScenario('create_payment', eventWithTarget({ checked: true }));
    toggleScenario('create_payment', eventWithTarget({ checked: true }));
    expect(form.value.allowed_scenarios).toEqual(['create_payment']);

    toggleScenario('create_payment', eventWithTarget({ checked: false }));
    expect(form.value.allowed_scenarios).toEqual([]);
  });

  it('updates human-confirmation state from the checkbox event', () => {
    const { form, setHumanConfirmation } = useFormState();

    setHumanConfirmation(eventWithTarget({ checked: true }));

    expect(form.value.require_human_confirmation).toBe(true);
  });
});
