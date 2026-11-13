export type Locale = 'ru' | 'en';

export interface Messages {
  documentTitle: string;
  brandFallback: string;
  title: string;
  languageSwitcher: string;
  switchToLight: string;
  switchToDark: string;
  loadingClient: string;
  clientNotFound: string;
  requestSection: string;
  resultsSection: string;
  requestLabel: string;
  requestPlaceholder: string;
  attachmentLabel: string;
  attachmentHint: string;
  chooseFile: string;
  removeFile: string;
  bytes: string;
  fileTooLarge: string;
  fileReadError: string;
  sending: string;
  send: string;
  requestFailure: string;
  approvalFailure: string;
  serverError: string;
  approvalDataIncomplete: string;
  processed: string;
  paymentApproved: string;
  paymentRejected: string;
  responseTitle: string;
  toolCallsTitle: string;
  arguments: string;
  responseDetails: string;
  pay: string;
  missingResult: string;
  approvalLabel: string;
  approvalTitle: string;
  safeActions: string;
  riskyActions: string;
  operation: string;
  confirmation: string;
  yes: string;
  no: string;
  approveAll: string;
  rejectAll: string;
  footer: string;
}

export const translations: Record<Locale, Messages> = {
  ru: {
    documentTitle: 'YooKassa · Менеджер платежей',
    brandFallback: 'ОНЛАЙН-ШКОЛА',
    title: 'Менеджер платежей',
    languageSwitcher: 'Выбрать язык',
    switchToLight: 'Включить светлую тему',
    switchToDark: 'Включить тёмную тему',
    loadingClient: 'Загружаем настройки клиента…',
    clientNotFound: 'Не удалось загрузить настройки клиента.',
    requestSection: 'Форма запроса',
    resultsSection: 'Результаты работы',
    requestLabel: 'Что нужно сделать',
    requestPlaceholder:
      'Например: создай платёжную ссылку на 5 000 ₽ за курс английского',
    attachmentLabel: 'Приложить файл',
    attachmentHint: 'Список в формате CSV или TXT, до {limit} КБ',
    chooseFile: 'Выбрать',
    removeFile: 'Удалить файл',
    bytes: 'байт',
    fileTooLarge: 'Размер файла не должен превышать {limit} КБ.',
    fileReadError: 'Не удалось прочитать файл.',
    sending: 'Отправка…',
    send: 'Отправить',
    requestFailure: 'Не удалось отправить запрос.',
    approvalFailure: 'Не удалось отправить решение.',
    serverError: 'Ошибка API',
    approvalDataIncomplete: 'API вернул неполные данные для подтверждения.',
    processed: 'Запрос обработан.',
    paymentApproved: 'Платёж одобрен.',
    paymentRejected: 'Платёж отклонён.',
    responseTitle: 'Ответ API',
    toolCallsTitle: 'Вызовы инструментов',
    arguments: 'Аргументы',
    responseDetails: 'Детали ответа',
    pay: 'Перейти к оплате',
    missingResult: 'Результат отсутствует',
    approvalLabel: 'Проверка операции',
    approvalTitle: 'Требуется подтверждение',
    safeActions: 'Выполняется автоматически',
    riskyActions: 'Требует подтверждения',
    operation: 'Операция',
    confirmation: 'Подтверждение',
    yes: 'Да',
    no: 'Нет',
    approveAll: 'Одобрить всё',
    rejectAll: 'Отклонить всё',
    footer: 'Проверяйте сумму и назначение перед подтверждением платежа.',
  },
  en: {
    documentTitle: 'YooKassa · Payment manager',
    brandFallback: 'ONLINE SCHOOL',
    title: 'Payment manager',
    languageSwitcher: 'Choose language',
    switchToLight: 'Switch to light theme',
    switchToDark: 'Switch to dark theme',
    loadingClient: 'Loading client settings…',
    clientNotFound: 'Could not load client settings.',
    requestSection: 'Request form',
    resultsSection: 'Results',
    requestLabel: 'What should be done?',
    requestPlaceholder:
      'For example: create a ₽5,000 payment link for an English course',
    attachmentLabel: 'Attach a file',
    attachmentHint: 'CSV or TXT list, up to {limit} KB',
    chooseFile: 'Choose file',
    removeFile: 'Remove file',
    bytes: 'bytes',
    fileTooLarge: 'The file must not exceed {limit} KB.',
    fileReadError: 'Could not read the file.',
    sending: 'Sending…',
    send: 'Send',
    requestFailure: 'Could not send the request.',
    approvalFailure: 'Could not submit the decision.',
    serverError: 'API error',
    approvalDataIncomplete: 'The API returned incomplete approval data.',
    processed: 'Request processed.',
    paymentApproved: 'Payment approved.',
    paymentRejected: 'Payment rejected.',
    responseTitle: 'API response',
    toolCallsTitle: 'Tool calls',
    arguments: 'Arguments',
    responseDetails: 'Response details',
    pay: 'Open checkout',
    missingResult: 'No result available',
    approvalLabel: 'Operation review',
    approvalTitle: 'Approval required',
    safeActions: 'Runs automatically',
    riskyActions: 'Requires approval',
    operation: 'Operation',
    confirmation: 'Confirmation',
    yes: 'Yes',
    no: 'No',
    approveAll: 'Approve all',
    rejectAll: 'Reject all',
    footer: 'Check the amount and purpose before approving a payment.',
  },
};

export type MessageKey = keyof Messages;

export function translate(locale: Locale, key: MessageKey): string {
  return translations[locale][key];
}
