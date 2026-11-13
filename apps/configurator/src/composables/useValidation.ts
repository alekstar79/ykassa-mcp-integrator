import { computed, type ComputedRef, type Ref } from 'vue';
import {
  CLIENT_LIMITS,
  ClientConfigSchema,
} from '@alekstar79/ykassa-contracts';
import {
  CLIENT_NAME_PATTERN,
  isPlaceholderSecret,
} from '../export/buildZip';
import type { Messages } from '../i18n';
import type { FormState, ValidationSummaryItem } from '../types';

export function formatMessage(
  template: string,
  values: Record<string, number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    String(values[key] ?? ''),
  );
}

export function useValidation(
  form: Ref<FormState>,
  hasApprovalThreshold: Ref<boolean>,
  messages: ComputedRef<Messages>,
) {
  function validationMessage(field: string): string {
    const errors = messages.value.errors;
    switch (field) {
      case 'allowed_scenarios':
        return errors.scenariosRequired;
      case 'approval_threshold':
        return errors.approvalThreshold;
      case 'require_human_confirmation':
        return errors.requireHumanConfirmation;
      case 'limits.max_messages':
        return formatMessage(errors.maxMessages, {
          min: CLIENT_LIMITS.max_messages.min,
          max: CLIENT_LIMITS.max_messages.max,
        });
      case 'limits.max_attachment_kb':
        return formatMessage(errors.maxAttachment, {
          min: CLIENT_LIMITS.max_attachment_kb.min,
          max: CLIENT_LIMITS.max_attachment_kb.max,
        });
      default:
        return errors.invalidConfig;
    }
  }

  const fieldErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    const configResult = ClientConfigSchema.safeParse({
      allowed_scenarios: form.value.allowed_scenarios,
      approval_threshold: hasApprovalThreshold.value
        ? form.value.approval_threshold
        : undefined,
      require_human_confirmation: form.value.require_human_confirmation,
      brand: form.value.brand,
      ui: form.value.ui,
      limits: form.value.limits,
    });

    if (!configResult.success) {
      for (const issue of configResult.error.issues) {
        const field = issue.path.join('.');
        if (field && !errors[field]) {
          errors[field] = validationMessage(field);
        }
      }
    }

    const clientName = form.value.name.trim();
    if (!clientName) {
      errors.name = messages.value.errors.nameRequired;
    } else if (!CLIENT_NAME_PATTERN.test(clientName)) {
      errors.name = messages.value.errors.nameInvalid;
    }

    const shopId = form.value.shop_id.trim();
    if (!shopId) {
      errors.shop_id = messages.value.errors.shopIdRequired;
    } else if (isPlaceholderSecret(shopId)) {
      errors.shop_id = messages.value.errors.shopIdPlaceholder;
    }

    const mcpToken = form.value.mcp_token.trim();
    if (!mcpToken) {
      errors.mcp_token = messages.value.errors.mcpTokenRequired;
    } else if (isPlaceholderSecret(mcpToken)) {
      errors.mcp_token = messages.value.errors.mcpTokenPlaceholder;
    }

    return errors;
  });

  function summaryFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      name: messages.value.nameSummaryLabel,
      shop_id: messages.value.shopIdLabel,
      mcp_token: messages.value.mcpTokenLabel,
      allowed_scenarios: messages.value.scenarioLabel,
      approval_threshold: messages.value.approvalThresholdLabel,
      require_human_confirmation:
        messages.value.requireHumanConfirmationLabel,
      'limits.max_messages': messages.value.maxMessagesLabel,
      'limits.max_attachment_kb': messages.value.maxAttachmentLabel,
      'brand.display_name': messages.value.displayNameLabel,
      'ui.mode': messages.value.modeLabel,
      'ui.accent': messages.value.accentLabel,
      'ui.radius': messages.value.radiusLabel,
      'ui.shadow': messages.value.shadowLabel,
      'ui.font_pair': messages.value.fontPairLabel,
      'ui.form_style': messages.value.formStyleLabel,
      'ui.h1_size': messages.value.h1SizeLabel,
    };

    return labels[field] ?? field;
  }

  const validationSummary = computed<ValidationSummaryItem[]>(() =>
    Object.entries(fieldErrors.value).map(([field, message]) => ({
      field,
      label: summaryFieldLabel(field),
      message,
    })),
  );
  const isFormValid = computed(() => Object.keys(fieldErrors.value).length === 0);

  function errorFor(field: string): string | undefined {
    return fieldErrors.value[field];
  }

  function describedBy(field: string, hintId: string): string {
    const errorId = `${field.replaceAll('.', '-')}-error`;
    return errorFor(field) ? `${hintId} ${errorId}` : hintId;
  }

  return {
    fieldErrors,
    validationSummary,
    isFormValid,
    errorFor,
    describedBy,
    formatMessage,
  };
}
