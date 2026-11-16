export type Locale = 'ru' | 'en';

export interface Messages {
  documentTitle: string;
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
  removeFile: string;
  addActions: string;
  uploadAttachment: string;
  settings: string;
  settingsTitle: string;
  currency: string;
  vatCode: string;
  vatNoVat: string;
  vatZero: string;
  vatTen: string;
  vatTwenty: string;
  vatFive: string;
  vatSeven: string;
  vatTwentyTwo: string;
  vatTenCalculated: string;
  vatTwentyCalculated: string;
  vatFiveCalculated: string;
  vatSevenCalculated: string;
  vatTwentyTwoCalculated: string;
  capture: string;
  returnUrl: string;
  returnUrlHint: string;
  invoiceExpiryDays: string;
  saveSettings: string;
  cancel: string;
  invalidReturnUrl: string;
  invalidInvoiceExpiry: string;
  settingsSaveError: string;
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
    title: 'Менеджер платежей',
    languageSwitcher: 'Выбрать язык',
    switchToLight: 'Включить светлую тему',
    switchToDark: 'Включить тёмную тему',
    loadingClient: 'Загружаем настройки клиента…',
    clientNotFound: 'Не удалось загрузить настройки клиента.',
    requestSection: 'Форма запроса',
    resultsSection: 'Результаты работы',
    requestLabel: 'Что нужно сделать',
    requestPlaceholder: 'Например: выставь счёт на 5 000 ₽ за курс английского',
    removeFile: 'Удалить файл',
    addActions: 'Дополнительные действия',
    uploadAttachment: 'Загрузить вложение',
    settings: 'Настройки',
    settingsTitle: 'Настройки',
    currency: 'Валюта',
    vatCode: 'Код НДС',
    vatNoVat: 'без НДС',
    vatZero: '0%',
    vatTen: '10%',
    vatTwenty: '20%',
    vatFive: '5%',
    vatSeven: '7%',
    vatTwentyTwo: '22%',
    vatTenCalculated: 'расчётная ставка 10/110',
    vatTwentyCalculated: 'расчётная ставка 20/120',
    vatFiveCalculated: 'расчётная ставка 5/105',
    vatSevenCalculated: 'расчётная ставка 7/107',
    vatTwentyTwoCalculated: 'расчётная ставка 22/122',
    capture: 'Списывать платёж сразу (capture)',
    returnUrl: 'URL возврата',
    returnUrlHint: 'Если пусто, клиент останется на странице оплаты.',
    invoiceExpiryDays: 'Срок действия счёта (дней)',
    saveSettings: 'Сохранить',
    cancel: 'Отмена',
    invalidReturnUrl: 'URL должен начинаться с http:// или https://.',
    invalidInvoiceExpiry: 'Укажите целое число от 1 до 30.',
    settingsSaveError: 'Не удалось сохранить настройки в этом браузере.',
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
    title: 'Payment manager',
    languageSwitcher: 'Choose language',
    switchToLight: 'Switch to light theme',
    switchToDark: 'Switch to dark theme',
    loadingClient: 'Loading client settings…',
    clientNotFound: 'Could not load client settings.',
    requestSection: 'Request form',
    resultsSection: 'Results',
    requestLabel: 'What should be done?',
    requestPlaceholder: 'For example: create an invoice for 5,000 RUB for an English course',
    removeFile: 'Remove file',
    addActions: 'Additional actions',
    uploadAttachment: 'Upload attachment',
    settings: 'Settings',
    settingsTitle: 'Settings',
    currency: 'Currency',
    vatCode: 'VAT code',
    vatNoVat: 'no VAT',
    vatZero: '0%',
    vatTen: '10%',
    vatTwenty: '20%',
    vatFive: '5%',
    vatSeven: '7%',
    vatTwentyTwo: '22%',
    vatTenCalculated: 'calculated rate 10/110',
    vatTwentyCalculated: 'calculated rate 20/120',
    vatFiveCalculated: 'calculated rate 5/105',
    vatSevenCalculated: 'calculated rate 7/107',
    vatTwentyTwoCalculated: 'calculated rate 22/122',
    capture: 'Capture payment immediately',
    returnUrl: 'Return URL',
    returnUrlHint: 'If empty, the customer stays on the payment page.',
    invoiceExpiryDays: 'Invoice expiry (days)',
    saveSettings: 'Save',
    cancel: 'Cancel',
    invalidReturnUrl: 'The URL must start with http:// or https://.',
    invalidInvoiceExpiry: 'Enter an integer from 1 to 30.',
    settingsSaveError: 'Could not save settings in this browser.',
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
