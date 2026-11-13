import { computed, ref, type Ref } from 'vue';
import { API_URL } from '../environment';
import { translate, type Locale, type MessageKey } from '../i18n';
import type {
  ApiResponse,
  PendingApproval,
  RequestPayload,
  ToolCall,
} from '../types';

export function useClientApi(
  clientName: Ref<string>,
  locale: Ref<Locale> = ref('ru'),
) {
  const apiReplyText = ref('');
  const apiReplyFallbackKey = ref<MessageKey | null>(null);
  const apiReply = computed(
    () =>
      (apiReplyFallbackKey.value
        ? translate(locale.value, apiReplyFallbackKey.value)
        : apiReplyText.value),
  );
  const apiWarning = ref('');
  const toolCalls = ref<ToolCall[]>([]);
  const errorKey = ref<MessageKey | null>(null);
  const errorDetail = ref('');
  const rawErrorMessage = ref('');
  const errorMessage = computed(() => {
    if (!errorKey.value) return rawErrorMessage.value;
    const message = translate(locale.value, errorKey.value);
    return errorDetail.value
      ? `${message} (${errorDetail.value})`
      : message;
  });
  const pendingApproval = ref<PendingApproval | null>(null);
  const isBusy = ref(false);

  function setLocalizedError(key: MessageKey, detail = ''): void {
    errorKey.value = key;
    errorDetail.value = detail;
    rawErrorMessage.value = '';
  }

  function setRawError(message: string): void {
    errorKey.value = null;
    errorDetail.value = '';
    rawErrorMessage.value = message;
  }

  function clearError(): void {
    errorKey.value = null;
    errorDetail.value = '';
    rawErrorMessage.value = '';
  }

  function setReply(reply: string | undefined, fallbackKey: MessageKey): void {
    if (reply !== undefined) {
      apiReplyText.value = reply;
      apiReplyFallbackKey.value = null;
      return;
    }

    apiReplyText.value = '';
    apiReplyFallbackKey.value = fallbackKey;
  }

  function setPendingApproval(data: ApiResponse): MessageKey | null {
    if (!data.requires_approval) {
      pendingApproval.value = null;
      return null;
    }

    const actions =
      data.proposed_actions ??
      (data.proposed_action ? [data.proposed_action] : []);
    if (!data.approval_id || actions.length === 0) {
      return 'approvalDataIncomplete';
    }

    const normalizedActions = actions.map((action) => ({
      ...action,
      requires_confirmation: action.requires_confirmation ?? true,
    }));
    if (normalizedActions.every((action) => !action.requires_confirmation)) {
      pendingApproval.value = null;
      return null;
    }

    pendingApproval.value = {
      approvalId: data.approval_id,
      actions: normalizedActions,
    };
    return null;
  }

  async function submitRequest(payload: RequestPayload): Promise<void> {
    clearError();
    isBusy.value = true;

    try {
      const response = await fetch(`${API_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientName.value,
          messages: [{ role: 'user', content: payload.message }],
          ...(payload.attachment
            ? {
                attachment: {
                  filename: payload.attachment.filename,
                  content: payload.attachment.content,
                },
              }
            : {}),
        }),
      });
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setLocalizedError(
          data.error ? 'serverError' : 'requestFailure',
          data.error ?? `HTTP ${response.status}`,
        );
        return;
      }

      setReply(data.reply, 'processed');
      apiWarning.value = data.warning ?? '';
      toolCalls.value = data.tool_calls ?? [];
      const approvalError = setPendingApproval(data);
      if (approvalError) setLocalizedError(approvalError);
    } catch (error) {
      setLocalizedError(
        'requestFailure',
        error instanceof Error ? error.message : '',
      );
    } finally {
      isBusy.value = false;
    }
  }

  async function sendRequest(payload: RequestPayload): Promise<void> {
    apiReplyText.value = '';
    apiReplyFallbackKey.value = null;
    apiWarning.value = '';
    toolCalls.value = [];
    pendingApproval.value = null;
    await submitRequest(payload);
  }

  async function resolveApproval(approved: boolean): Promise<void> {
    const pending = pendingApproval.value;
    if (!pending) return;

    clearError();
    isBusy.value = true;

    try {
      const response = await fetch(`${API_URL}/api/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: pending.approvalId,
          approved,
        }),
      });
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setLocalizedError(
          data.error ? 'serverError' : 'approvalFailure',
          data.error ?? `HTTP ${response.status}`,
        );
        return;
      }

      setReply(
        data.reply,
        approved ? 'paymentApproved' : 'paymentRejected',
      );
      apiWarning.value = data.warning ?? '';
      toolCalls.value = [...toolCalls.value, ...(data.tool_calls ?? [])];
      const approvalError = setPendingApproval(data);
      if (approvalError) setLocalizedError(approvalError);
    } catch (error) {
      setLocalizedError(
        'approvalFailure',
        error instanceof Error ? error.message : '',
      );
    } finally {
      isBusy.value = false;
    }
  }

  return {
    apiReply,
    apiWarning,
    toolCalls,
    errorMessage,
    pendingApproval,
    isBusy,
    sendRequest,
    resolveApproval,
    clearError,
  };
}
