import { computed, ref, watch, type Ref } from 'vue';
import { API_URL } from '../environment';
import { readUiOverrides } from './uiDefaults.js';
import { translate, type Locale, type MessageKey } from '../i18n';
import type {
  ApiResponse,
  ChatTurn,
  PendingApproval,
  RequestPayload,
  ToolCall,
} from '../types';

const SESSION_STORAGE_PREFIX = 'yookassa-chat-session:';

interface HistoryToolCall {
  name: string;
  args: unknown;
  result?: string;
  error?: string;
}

interface HistoryMessage {
  id: string;
  turn_id: string;
  created_at: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: HistoryToolCall[];
}

interface HistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
}

export function useClientApi(
  clientName: Ref<string>,
  locale: Ref<Locale> = ref('ru'),
) {
  const chatTurns = ref<ChatTurn[]>([]);
  const isHistoryLoading = ref(false);
  const historyLoadFailed = ref(false);
  const historyLoadErrorDetail = ref('');
  const activeTurnId = ref<string | null>(null);
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
  const pendingTurnId = ref<string | null>(null);
  let historyLoadVersion = 0;
  let localTurnSequence = 0;
  let historyLoadPromise: Promise<void> = Promise.resolve();

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isHistoryToolCall(value: unknown): value is HistoryToolCall {
    return (
      isRecord(value) &&
      typeof value.name === 'string' &&
      'args' in value &&
      (value.result === undefined || typeof value.result === 'string') &&
      (value.error === undefined || typeof value.error === 'string')
    );
  }

  function isHistoryMessage(value: unknown): value is HistoryMessage {
    return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.turn_id === 'string' &&
      typeof value.created_at === 'string' &&
      (value.role === 'user' || value.role === 'assistant') &&
      typeof value.content === 'string' &&
      (value.tool_calls === undefined ||
        (Array.isArray(value.tool_calls) &&
          value.tool_calls.every(isHistoryToolCall)))
    );
  }

  function isHistoryResponse(value: unknown): value is HistoryResponse {
    return (
      isRecord(value) &&
      typeof value.session_id === 'string' &&
      Array.isArray(value.messages) &&
      value.messages.every(isHistoryMessage)
    );
  }

  function groupHistory(messages: HistoryMessage[]): ChatTurn[] {
    const turns = new Map<string, ChatTurn>();

    for (const message of messages) {
      let turn = turns.get(message.turn_id);
      if (!turn) {
        turn = {
          id: message.turn_id,
          createdAt: message.created_at,
          request: '',
          reply: '',
          warning: '',
          toolCalls: [],
        };
        turns.set(message.turn_id, turn);
      }

      if (message.role === 'user') {
        turn.request = message.content;
        continue;
      }

      if (message.content.trim()) {
        turn.reply = turn.reply
          ? `${turn.reply}\n\n${message.content}`
          : message.content;
      }
      for (const [index, call] of (message.tool_calls ?? []).entries()) {
        turn.toolCalls.push({
          id: `${message.id}-${index}`,
          name: call.name,
          args: call.args,
          ...(call.result === undefined ? {} : { result: call.result }),
          ...(call.error === undefined ? {} : { error: call.error }),
        });
      }
    }

    return [...turns.values()].map((turn) => {
      const financialCalls = turn.toolCalls.filter(
        (call) =>
          call.name === 'create_payment' || call.name === 'create_invoice',
      );
      if (financialCalls.length === 0) return turn;

      return {
        ...turn,
        reply: formatHistoricalFinancialReply(financialCalls, locale.value),
      };
    });
  }

  function formatHistoricalFinancialReply(
    calls: HistoryToolCall[],
    currentLocale: Locale,
  ): string {
    const summaries = calls.map((call) => {
      const isInvoice = call.name === 'create_invoice';
      if (call.error !== undefined) {
        return currentLocale === 'ru'
          ? `Не удалось создать ${isInvoice ? 'счёт' : 'платёжную ссылку'}. Проверьте данные и повторите запрос.`
          : `I could not create the ${isInvoice ? 'invoice' : 'payment link'}. Check the details and try again.`;
      }

      const args = isRecord(call.args) ? call.args : {};
      const amount = formatHistoryAmount(args.amount, currentLocale);
      const description =
        typeof args.description === 'string'
          ? args.description.trim().replaceAll(/\s+/gu, ' ')
          : '';
      const name =
        currentLocale === 'ru'
          ? isInvoice
            ? 'Счёт'
            : 'Платёжная ссылка'
          : isInvoice
            ? 'Invoice'
            : 'Payment link';
      const amountText =
        amount === undefined
          ? ''
          : currentLocale === 'ru'
            ? ` на ${amount}`
            : ` for ${amount}`;
      const descriptionText =
        description.length === 0
          ? ''
          : currentLocale === 'ru'
            ? `, назначение: «${description}»`
            : `, purpose: “${description}”`;
      return currentLocale === 'ru'
        ? `${name}${amountText}${descriptionText} ${isInvoice ? 'создан' : 'создана'}.`
        : `${name}${amountText}${descriptionText} is ready.`;
    });

    return summaries.join('\n\n');
  }

  function formatHistoryAmount(
    value: unknown,
    currentLocale: Locale,
  ): string | undefined {
    const amountValue = isRecord(value) ? value.value : value;
    if (
      (typeof amountValue !== 'string' && typeof amountValue !== 'number') ||
      (typeof amountValue === 'string' && amountValue.trim() === '')
    ) {
      return undefined;
    }

    const numericAmount = Number(amountValue);
    if (!Number.isFinite(numericAmount)) return undefined;

    const formattedAmount = numericAmount.toLocaleString(
      currentLocale === 'ru' ? 'ru-RU' : 'en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );
    const currency =
      isRecord(value) && typeof value.currency === 'string'
        ? value.currency.toUpperCase()
        : '';
    return currency === 'RUB'
      ? `${formattedAmount} ₽`
      : currency.length > 0
        ? `${formattedAmount} ${currency}`
        : formattedAmount;
  }

  async function loadHistory(client: string): Promise<void> {
    const requestVersion = ++historyLoadVersion;
    const sessionId = window.localStorage.getItem(
      `${SESSION_STORAGE_PREFIX}${client}`,
    );
    if (!sessionId) {
      chatTurns.value = [];
      activeTurnId.value = null;
      historyLoadFailed.value = false;
      historyLoadErrorDetail.value = '';
      isHistoryLoading.value = false;
      return;
    }

    isHistoryLoading.value = true;
    historyLoadFailed.value = false;
    historyLoadErrorDetail.value = '';
    try {
      const query = new URLSearchParams({
        client,
        session_id: sessionId,
      });
      const response = await fetch(`${API_URL}/api/history?${query}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!isHistoryResponse(body)) {
        throw new Error('The API returned an invalid chat history.');
      }
      if (requestVersion !== historyLoadVersion) return;

      chatTurns.value = groupHistory(body.messages);
      activeTurnId.value = chatTurns.value.at(-1)?.id ?? null;
    } catch (error) {
      if (requestVersion === historyLoadVersion) {
        historyLoadFailed.value = true;
        historyLoadErrorDetail.value =
          error instanceof Error ? error.message : 'Unknown error';
      }
    } finally {
      if (requestVersion === historyLoadVersion) {
        isHistoryLoading.value = false;
      }
    }
  }

  watch(
    clientName,
    (client) => {
      chatTurns.value = [];
      activeTurnId.value = null;
      pendingApproval.value = null;
      pendingTurnId.value = null;
      historyLoadPromise = loadHistory(client);
    },
    { immediate: true },
  );

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

  function persistSessionId(client: string, value: unknown): void {
    if (typeof value !== 'string') return;
    window.localStorage.setItem(
      `${SESSION_STORAGE_PREFIX}${client}`,
      value,
    );
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

  async function submitRequest(
    payload: RequestPayload,
    turnId: string,
  ): Promise<void> {
    clearError();
    isBusy.value = true;
    const overrides = readUiOverrides();
    const client = clientName.value;
    const sessionId = window.localStorage.getItem(
      `${SESSION_STORAGE_PREFIX}${client}`,
    );

    try {
      const response = await fetch(`${API_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client,
          ...(sessionId ? { session_id: sessionId } : {}),
          messages: [{ role: 'user', content: payload.message }],
          ...(overrides ? { overrides } : {}),
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

      persistSessionId(client, data.session_id);
      setReply(data.reply, 'processed');
      apiWarning.value = data.warning ?? '';
      toolCalls.value = data.tool_calls ?? [];
      updateChatTurn(turnId, (turn) => ({
        ...turn,
        reply:
          data.reply ??
          (data.requires_approval
            ? ''
            : translate(locale.value, 'processed')),
        warning: data.warning ?? '',
        toolCalls: data.tool_calls ?? [],
      }));
      const approvalError = setPendingApproval(data);
      pendingTurnId.value = pendingApproval.value ? turnId : null;
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

  function updateChatTurn(
    turnId: string,
    update: (turn: ChatTurn) => ChatTurn,
  ): void {
    chatTurns.value = chatTurns.value.map((turn) =>
      turn.id === turnId ? update(turn) : turn,
    );
  }

  function retryHistory(): Promise<void> {
    historyLoadPromise = loadHistory(clientName.value);
    return historyLoadPromise;
  }

  async function sendRequest(payload: RequestPayload): Promise<void> {
    if (isHistoryLoading.value) await historyLoadPromise;

    apiReplyText.value = '';
    apiReplyFallbackKey.value = null;
    apiWarning.value = '';
    toolCalls.value = [];
    pendingApproval.value = null;
    pendingTurnId.value = null;
    const turnId = `local-${Date.now()}-${++localTurnSequence}`;
    chatTurns.value = [
      ...chatTurns.value,
      {
        id: turnId,
        createdAt: new Date().toISOString(),
        request: payload.message,
        reply: '',
        warning: '',
        toolCalls: [],
      },
    ];
    activeTurnId.value = turnId;
    await submitRequest(payload, turnId);
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

      persistSessionId(clientName.value, data.session_id);
      setReply(
        data.reply,
        approved ? 'paymentApproved' : 'paymentRejected',
      );
      apiWarning.value = data.warning ?? '';
      toolCalls.value = [...toolCalls.value, ...(data.tool_calls ?? [])];
      const turnId = pendingTurnId.value;
      if (turnId) {
        updateChatTurn(turnId, (turn) => ({
          ...turn,
          reply:
            data.reply ??
            translate(
              locale.value,
              approved ? 'paymentApproved' : 'paymentRejected',
            ),
          warning: data.warning ?? '',
          toolCalls: [...turn.toolCalls, ...(data.tool_calls ?? [])],
        }));
      }
      const approvalError = setPendingApproval(data);
      if (!pendingApproval.value) pendingTurnId.value = null;
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
    chatTurns,
    isHistoryLoading,
    historyLoadFailed,
    historyLoadErrorDetail,
    activeTurnId,
    errorMessage,
    pendingApproval,
    isBusy,
    sendRequest,
    resolveApproval,
    retryHistory,
    clearError,
  };
}
