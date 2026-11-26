import { ref } from 'vue';
import {
  CLIENT_CONFIG_DEFAULTS,
  type KnownMcpScenario,
} from '@alekstar79/ykassa-contracts';
import type { FormState, NumericField } from '../types';

export function useFormState() {
  const initialAllowedScenarios: string[] = [];
  const form = ref<FormState>({
    name: '',
    shop_id: '',
    mcp_token: '',
    llm: {
      provider: '',
      model: '',
      base_url: '',
      api_key: '',
    },
    clientMode: 'reference-ui',
    allowed_scenarios: initialAllowedScenarios,
    approval_threshold: 0,
    require_human_confirmation: false,
    brand: {
      display_name: '',
    },
    ui: { ...CLIENT_CONFIG_DEFAULTS.ui },
    limits: { ...CLIENT_CONFIG_DEFAULTS.limits },
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
  const hasApprovalThreshold = ref(false);

  function updateNumber(field: NumericField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value === '' ? undefined : input.valueAsNumber;

    if (field === 'approval_threshold') {
      hasApprovalThreshold.value = value !== undefined;
      form.value.approval_threshold = value ?? 0;
    } else if (field === 'limits.max_messages') {
      form.value.limits.max_messages = value ?? Number.NaN;
    } else {
      form.value.limits.max_attachment_kb = value ?? Number.NaN;
    }
  }

  function toggleScenario(
    scenario: KnownMcpScenario,
    event: Event,
  ): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = new Set(form.value.allowed_scenarios);

    if (checked) selected.add(scenario);
    else selected.delete(scenario);

    form.value.allowed_scenarios = [...selected];
  }

  function setHumanConfirmation(event: Event): void {
    form.value.require_human_confirmation = (
      event.target as HTMLInputElement
    ).checked;
  }

  return {
    form,
    hasApprovalThreshold,
    updateNumber,
    toggleScenario,
    setHumanConfirmation,
  };
}
