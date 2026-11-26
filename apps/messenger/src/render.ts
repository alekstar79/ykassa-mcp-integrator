import type {
  ApprovalRequiredResponse,
  AskResponse,
} from './apiClient.js';
import type {
  Button,
  MessengerLocale,
  MessengerPlatform,
} from './types.js';

const MESSAGE_LIMITS: Record<MessengerPlatform, number> = {
  telegram: 4096,
  max: 4000,
};

const COPY = {
  ru: {
    start: 'Привет! Отправьте запрос на создание платёжной ссылки. Команды: /help.',
    help: 'Отправьте текстовый запрос или CSV/TXT-файл. Если отправляете текст и файл отдельно, упомяните файл или список в запросе.\nКоманды:\n/start: приветствие.\n/help: эта справка.\n/reset: очистить ожидающий запрос, не отменяет активные подтверждения.\n/status: показать клиента и разрешённые сценарии.\nДля подтверждения или отклонения используйте кнопки в карточке. Сообщение в чате не заменяет нажатие кнопки.',
    maxHelp: 'Отправьте текстовый запрос или CSV/TXT-файл. Если отправляете текст и файл отдельно, упомяните файл или список в запросе.\nКоманды:\n/start: приветствие.\n/help: эта справка.\n/reset: очистить ожидающий запрос, не отменяет активные подтверждения.\n/status: показать клиента и разрешённые сценарии.\nДля подтверждения или отклонения используйте кнопки в карточке. Сообщение в чате не заменяет нажатие кнопки.',
    processing: 'Обрабатываю запрос...',
    reset: 'Ожидающий запрос очищен.',
    status: 'Клиент: {client}\nСценарии: {scenarios}',
    denied: 'Доступ запрещён.',
    privateOnly: 'Используйте бота в личном чате.',
    invalidAttachment: 'Допускаются только CSV/TXT-файлы в пределах настроенного лимита.',
    maxAttachmentUnsupported: 'Через MAX можно отправить один файл CSV или TXT. Изображения и другие типы вложений пока не обрабатываются.',
    maxAttachmentTooLarge: 'Файл превышает лимит размера, настроенный для клиента.',
    maxAttachmentDownloadFailed: 'Не удалось получить файл из MAX. Попробуйте отправить его ещё раз.',
    attachmentPrompt: 'Пожалуйста, обработайте приложенный файл.',
    attachmentRequired: 'Жду файл или таблицу для этого запроса. Отправьте CSV- или TXT-файл следующим сообщением.',
    approvalTitle: 'Требуется подтверждение',
    operation: 'Операция',
    parameters: 'Параметры',
    approve: 'Подтвердить',
    reject: 'Отклонить',
    pay: 'Оплатить',
    callbackAck: 'Запрос принят.',
    invalidAction: 'Действие недействительно или уже обработано.',
    unauthorizedCallback: 'Подтвердить может только инициатор запроса.',
    api400: 'Запрос не принят. Проверьте его и повторите.',
    api404Ask: 'Клиент не найден.',
    api404Approve: 'Запрос на подтверждение уже недоступен.',
    api409: 'Операция больше не разрешена текущими настройками.',
    api410: 'Время подтверждения истекло.',
    api500: 'Сервис временно недоступен.',
    api502: 'Не удалось безопасно разобрать финансовую операцию; операция не выполнялась. Уточните данные и повторите запрос.',
    api503: 'Не удалось подготовить карточку подтверждения; операция не выполнялась. Повторите запрос.',
    apiOther: 'Не удалось связаться с сервисом.',
  },
  en: {
    start: 'Hello! Send a request to create a payment link. Commands: /help.',
    help: 'Send a text request or CSV/TXT file. If you send the text and file separately, mention the file or list in your request.\nCommands:\n/start: show the welcome message.\n/help: show this help.\n/reset: clear the pending request; pending approvals are not cancelled.\n/status: show the client and allowed scenarios.\nUse the buttons on an approval card to approve or reject. A chat message does not replace a button press.',
    maxHelp: 'Send a text request or CSV/TXT file. If you send the text and file separately, mention the file or list in your request.\nCommands:\n/start: show the welcome message.\n/help: show this help.\n/reset: clear the pending request; pending approvals are not cancelled.\n/status: show the client and allowed scenarios.\nUse the buttons on an approval card to approve or reject. A chat message does not replace a button press.',
    processing: 'Processing...',
    reset: 'The pending request was cleared.',
    status: 'Client: {client}\nScenarios: {scenarios}',
    denied: 'Access denied.',
    privateOnly: 'Use the bot in a private chat.',
    invalidAttachment: 'Only CSV/TXT files within the configured size limit are accepted.',
    maxAttachmentUnsupported: 'MAX accepts one CSV or TXT file. Images and other attachment types are not processed yet.',
    maxAttachmentTooLarge: 'The file exceeds the size limit configured for this client.',
    maxAttachmentDownloadFailed: 'Could not retrieve the file from MAX. Please send it again.',
    attachmentPrompt: 'Please process the attached file.',
    attachmentRequired: 'Waiting for the file or spreadsheet for this request. Send a CSV or TXT file as your next message.',
    approvalTitle: 'Approval required',
    operation: 'Operation',
    parameters: 'Arguments',
    approve: 'Approve',
    reject: 'Reject',
    pay: 'Pay',
    callbackAck: 'Request received.',
    invalidAction: 'This action is invalid or has already been handled.',
    unauthorizedCallback: 'Only the request initiator can approve this operation.',
    api400: 'The request was not accepted. Check it and try again.',
    api404Ask: 'Client not found.',
    api404Approve: 'This approval request is no longer available.',
    api409: 'The operation is no longer allowed by current settings.',
    api410: 'The approval has expired.',
    api500: 'The service is temporarily unavailable.',
    api502: 'The financial operation could not be safely structured; no operation was executed. Clarify the details and try again.',
    api503: 'Could not prepare an approval card; the operation was not executed. Please retry.',
    apiOther: 'Could not reach the service.',
  },
} as const;

export type CopyKey = keyof typeof COPY.en;

export interface RenderedMessage {
  chunks: string[];
  buttons: Button[];
}

export function localized(
  locale: MessengerLocale,
  key: CopyKey,
  replacements: Record<string, string> = {},
): string {
  let text: string = COPY[locale][key];
  for (const [name, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function chunkText(
  value: string,
  platform: MessengerPlatform,
): string[] {
  const limit = MESSAGE_LIMITS[platform];
  const characters = Array.from(value || ' ');
  const chunks: string[] = [];
  for (let offset = 0; offset < characters.length; offset += limit) {
    const chunk = characters.slice(offset, offset + limit).join('');
    chunks.push(platform === 'telegram' ? escapeHtml(chunk) : chunk);
  }
  return chunks;
}

export function renderAskResponse(
  response: AskResponse,
  platform: MessengerPlatform,
  locale: MessengerLocale,
): RenderedMessage {
  const parts = [response.reply];
  if (response.warning !== undefined) parts.push(response.warning);
  const buttons: Button[] = [];
  const seenUrls = new Set<string>();

  for (const toolCall of response.tool_calls) {
    if (toolCall.error !== undefined) parts.push(toolCall.error);
    if (toolCall.result === undefined) continue;
    const url = confirmationUrlFromResult(toolCall.result);
    if (url !== undefined) {
      if (!seenUrls.has(url)) {
        buttons.push({
          kind: 'url',
          label: localized(locale, 'pay'),
          url,
        });
        seenUrls.add(url);
      }
    } else {
      parts.push(toolCall.result);
    }
  }

  return {
    chunks: chunkText(parts.filter(Boolean).join('\n\n'), platform),
    buttons,
  };
}

export function renderApprovalCard(
  response: ApprovalRequiredResponse,
  platform: MessengerPlatform,
  locale: MessengerLocale,
): RenderedMessage {
  const actionLines = response.proposed_actions.map((action, index) => {
    const args = stringifyArguments(action.args);
    return `${index + 1}. ${localized(locale, 'operation')}: ${action.tool}\n${localized(locale, 'parameters')}: ${args}`;
  });
  const text = [
    response.reply,
    response.warning,
    localized(locale, 'approvalTitle'),
    ...actionLines,
  ]
    .filter(Boolean)
    .join('\n\n');
  const approveData = approvalCallbackData(response.approval_id, true, platform);
  const rejectData = approvalCallbackData(response.approval_id, false, platform);
  return {
    chunks: chunkText(text, platform),
    buttons: [
      {
        kind: 'callback',
        label: localized(locale, 'approve'),
        data: approveData,
      },
      {
        kind: 'callback',
        label: localized(locale, 'reject'),
        data: rejectData,
      },
    ],
  };
}

export function renderApiError(
  status: number | undefined,
  locale: MessengerLocale,
  operation: 'ask' | 'approve' | 'other',
): string {
  if (status === 400) return localized(locale, 'api400');
  if (status === 404) {
    return localized(
      locale,
      operation === 'approve' ? 'api404Approve' : 'api404Ask',
    );
  }
  if (status === 409) return localized(locale, 'api409');
  if (status === 410) return localized(locale, 'api410');
  if (status === 502) return localized(locale, 'api502');
  if (status === 503) return localized(locale, 'api503');
  if (status === 500) return localized(locale, 'api500');
  return localized(locale, 'apiOther');
}

export function confirmationUrlFromResult(result: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(result);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || typeof parsed.confirmation_url !== 'string') {
    return undefined;
  }
  try {
    const url = new URL(parsed.confirmation_url);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function maxMessageLength(platform: MessengerPlatform): number {
  return MESSAGE_LIMITS[platform];
}

function approvalCallbackData(
  approvalId: string,
  approved: boolean,
  platform: MessengerPlatform,
): string {
  if (!approvalId || approvalId.includes(':')) {
    throw new Error('Approval ID cannot be encoded in a callback button.');
  }
  const data = `apr:${approvalId}:${approved ? 'y' : 'n'}`;
  const size =
    platform === 'telegram'
      ? Buffer.byteLength(data, 'utf8')
      : Array.from(data).length;
  const maximum = platform === 'telegram' ? 64 : 1024;
  if (size > maximum) {
    throw new Error(`Approval callback data exceeds ${maximum} units.`);
  }
  return data;
}

function stringifyArguments(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args);
  } catch {
    return '[unavailable]';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
