export type Locale = 'ru' | 'en';

export interface Messages {
  documentTitle: string;
  pageTitle: string;
  previewTitle: string;
  previewViewLabel: string;
  settingsViewLabel: string;
  previewUnavailable: string;
  previewBrandFallback: string;
  previewManagerTitle: string;
  requestLabel: string;
  requestPlaceholder: string;
  attachmentLabel: string;
  attachmentHint: string;
  chooseFile: string;
  send: string;
  footer: string;
  visualSettingsHeading: string;
  previewEyebrow: string;
  brandGroup: string;
  styleGroup: string;
  formTypographyGroup: string;
  languageLabel: string;
  themeLabel: string;
  switchToLight: string;
  switchToDark: string;
  clientGroup: string;
  backendGroup: string;
  uiGroup: string;
  nameLabel: string;
  nameHint: string;
  nameSummaryLabel: string;
  shopIdLabel: string;
  mcpTokenLabel: string;
  showMcpToken: string;
  hideMcpToken: string;
  secretHint: string;
  scenarioLabel: string;
  scenarioHint: string;
  createInvoiceDemoDisabled: string;
  approvalThresholdLabel: string;
  approvalThresholdHint: string;
  requireHumanConfirmationLabel: string;
  requireHumanConfirmationHint: string;
  maxMessagesLabel: string;
  maxMessagesHint: string;
  maxAttachmentLabel: string;
  maxAttachmentHint: string;
  modeLabel: string;
  modeHint: string;
  referenceMode: string;
  customMode: string;
  displayNameLabel: string;
  displayNameHint: string;
  accentLabel: string;
  accentHint: string;
  radiusLabel: string;
  radiusHint: string;
  shadowLabel: string;
  shadowHint: string;
  fontPairLabel: string;
  fontPairHint: string;
  formStyleLabel: string;
  formStyleHint: string;
  h1SizeLabel: string;
  h1SizeHint: string;
  customUiContract: string;
  downloadButton: string;
  downloadPreparing: string;
  downloadError: string;
  validationSummaryTitle: string;
  errors: {
    nameRequired: string;
    nameInvalid: string;
    shopIdRequired: string;
    shopIdPlaceholder: string;
    mcpTokenRequired: string;
    mcpTokenPlaceholder: string;
    scenariosRequired: string;
    approvalThreshold: string;
    requireHumanConfirmation: string;
    maxMessages: string;
    maxAttachment: string;
    invalidConfig: string;
  };
}

export const translations = {
  ru: {
    documentTitle: 'YooKassa · Конфигуратор клиента',
    pageTitle: 'Конфигуратор клиента',
    previewTitle: 'Предпросмотр',
    previewViewLabel: 'Предпросмотр',
    settingsViewLabel: 'Настройки',
    previewUnavailable: 'Предпросмотр доступен только для Reference UI',
    previewBrandFallback: 'Название сервиса',
    previewManagerTitle: 'Менеджер платежей',
    requestLabel: 'Что нужно сделать',
    requestPlaceholder:
      'Например: создай платёжную ссылку на 5 000 ₽ за курс английского',
    attachmentLabel: 'Приложить файл',
    attachmentHint: 'Список в формате CSV или TXT, до {limit} КБ',
    chooseFile: 'Выбрать',
    send: 'Отправить',
    footer: 'Проверяйте сумму и назначение перед подтверждением платежа.',
    visualSettingsHeading: 'Визуальные настройки Reference UI',
    previewEyebrow: 'Предпросмотр клиентского экрана',
    brandGroup: 'Бренд',
    styleGroup: 'Стиль',
    formTypographyGroup: 'Форма и типографика',
    languageLabel: 'Язык интерфейса',
    themeLabel: 'Переключить тему',
    switchToLight: 'Светлая тема',
    switchToDark: 'Тёмная тема',
    clientGroup: 'Клиент',
    backendGroup: 'Backend',
    uiGroup: 'Интерфейс',
    nameLabel: 'Имя клиента',
    nameHint:
      'Только строчная латиница, цифры и дефис. Пример: online-school.',
    nameSummaryLabel: 'Имя клиента (латиница)',
    shopIdLabel: 'Shop ID',
    mcpTokenLabel: 'MCP-токен',
    showMcpToken: 'Показать MCP-токен',
    hideMcpToken: 'Скрыть MCP-токен',
    secretHint: 'Хранится только в .env, не в config.yaml.',
    scenarioLabel: 'Разрешённые сценарии',
    scenarioHint: 'Выберите хотя бы один доступный MCP-инструмент.',
    createInvoiceDemoDisabled:
      'Отключён в демо из-за сложности валидации cart.',
    approvalThresholdLabel: 'Порог подтверждения',
    approvalThresholdHint:
      'Платежи до порога проходят автоматически, свыше требуют подтверждения.',
    requireHumanConfirmationLabel: 'Подтверждать каждую операцию',
    requireHumanConfirmationHint:
      'Подтверждать все операции, независимо от суммы.',
    maxMessagesLabel: 'Максимум сообщений',
    maxMessagesHint: 'Целое число от {min} до {max}. По умолчанию: {default}.',
    maxAttachmentLabel: 'Максимальный размер вложения (КБ)',
    maxAttachmentHint:
      'Целое число от {min} до {max} КБ. По умолчанию: {default} КБ.',
    modeLabel: 'Режим интерфейса',
    modeHint: 'Выберите reference UI или собственный интерфейс.',
    referenceMode: 'Reference UI',
    customMode: 'Собственный UI',
    displayNameLabel: 'Название сервиса',
    displayNameHint: 'Название в шапке reference UI.',
    accentLabel: 'Акцентный цвет',
    accentHint: 'Цвет кнопки и акцентов.',
    radiusLabel: 'Радиус углов',
    radiusHint: 'Скругление элементов.',
    shadowLabel: 'Тени',
    shadowHint: 'Интенсивность теней.',
    fontPairLabel: 'Пара шрифтов',
    fontPairHint: 'Основной и моноширинный шрифты.',
    formStyleLabel: 'Стиль формы',
    formStyleHint: 'Плоская форма или карточка.',
    h1SizeLabel: 'Размер заголовка',
    h1SizeHint: 'Размер основного заголовка.',
    customUiContract:
      'Ваш UI работает по контракту /api/ask, /api/approve, /api/clients/:name/public. См. docs/api-contract.md.',
    downloadButton: 'Скачать',
    downloadPreparing: 'Готовим архив…',
    downloadError: 'Не удалось сформировать архив.',
    validationSummaryTitle: 'Исправьте эти поля перед скачиванием:',
    errors: {
      nameRequired: 'Укажите имя папки клиента.',
      nameInvalid: 'Формат: строчная латиница, цифры и дефис, от 2 до 31 символа.',
      shopIdRequired: 'Укажите Shop ID.',
      shopIdPlaceholder: 'Замените значение-плейсхолдер на настоящий Shop ID.',
      mcpTokenRequired: 'Укажите MCP-токен.',
      mcpTokenPlaceholder: 'Замените значение-плейсхолдер на настоящий токен.',
      scenariosRequired: 'Выберите хотя бы один сценарий.',
      approvalThreshold: 'Укажите число не меньше 0.',
      requireHumanConfirmation: 'Укажите, нужно ли подтверждать операции.',
      maxMessages: 'Введите целое число от {min} до {max}.',
      maxAttachment: 'Введите целое число от {min} до {max}.',
      invalidConfig: 'Проверьте значение этого поля.',
    },
  },
  en: {
    documentTitle: 'YooKassa · Client configurator',
    pageTitle: 'Client configurator',
    previewTitle: 'Preview',
    previewViewLabel: 'Preview',
    settingsViewLabel: 'Settings',
    previewUnavailable: 'Preview is available only for the Reference UI',
    previewBrandFallback: 'Service name',
    previewManagerTitle: 'Payment manager',
    requestLabel: 'What should be done?',
    requestPlaceholder:
      'For example: create a ₽5,000 payment link for an English course',
    attachmentLabel: 'Attach a file',
    attachmentHint: 'CSV or TXT list, up to {limit} KB',
    chooseFile: 'Choose file',
    send: 'Send',
    footer: 'Check the amount and purpose before approving a payment.',
    visualSettingsHeading: 'Reference UI appearance',
    previewEyebrow: 'Client screen preview',
    brandGroup: 'Brand',
    styleGroup: 'Style',
    formTypographyGroup: 'Form and typography',
    languageLabel: 'Interface language',
    themeLabel: 'Toggle theme',
    switchToLight: 'Light theme',
    switchToDark: 'Dark theme',
    clientGroup: 'Client',
    backendGroup: 'Backend',
    uiGroup: 'UI',
    nameLabel: 'Client name',
    nameHint:
      'Lowercase Latin letters, digits, and hyphens only. Example: online-school.',
    nameSummaryLabel: 'Client name (Latin letters)',
    shopIdLabel: 'Shop ID',
    mcpTokenLabel: 'MCP token',
    showMcpToken: 'Show MCP token',
    hideMcpToken: 'Hide MCP token',
    secretHint: 'Stored only in .env, never in config.yaml.',
    scenarioLabel: 'Allowed scenarios',
    scenarioHint: 'Select at least one available MCP tool.',
    createInvoiceDemoDisabled:
      'Disabled in the demo because cart validation is complex.',
    approvalThresholdLabel: 'Approval threshold',
    approvalThresholdHint:
      'Payments up to the threshold are automatic; higher amounts require approval.',
    requireHumanConfirmationLabel: 'Confirm every operation',
    requireHumanConfirmationHint:
      'Require confirmation for every operation, regardless of amount.',
    maxMessagesLabel: 'Maximum messages',
    maxMessagesHint: 'Whole number from {min} to {max}. Default: {default}.',
    maxAttachmentLabel: 'Maximum attachment size (KB)',
    maxAttachmentHint:
      'Whole number from {min} to {max} KB. Default: {default} KB.',
    modeLabel: 'UI mode',
    modeHint: 'Choose the reference UI or your own interface.',
    referenceMode: 'Reference UI',
    customMode: 'Custom UI',
    displayNameLabel: 'Service name',
    displayNameHint: 'Name shown in the reference UI header.',
    accentLabel: 'Accent color',
    accentHint: 'Button and accent color.',
    radiusLabel: 'Corner radius',
    radiusHint: 'Corner radius for elements.',
    shadowLabel: 'Shadows',
    shadowHint: 'Shadow strength.',
    fontPairLabel: 'Font pair',
    fontPairHint: 'Body and monospace fonts.',
    formStyleLabel: 'Form style',
    formStyleHint: 'Flat form or card.',
    h1SizeLabel: 'Heading size',
    h1SizeHint: 'Main heading size.',
    customUiContract:
      'Your UI uses the /api/ask, /api/approve, and /api/clients/:name/public contracts. See docs/api-contract.md.',
    downloadButton: 'Download',
    downloadPreparing: 'Preparing archive…',
    downloadError: 'Could not generate archive.',
    validationSummaryTitle: 'Fix these fields before downloading:',
    errors: {
      nameRequired: 'Enter the client folder name.',
      nameInvalid: 'Use 2 to 31 lowercase letters, digits, and hyphens.',
      shopIdRequired: 'Enter the Shop ID.',
      shopIdPlaceholder: 'Replace the placeholder with a real Shop ID.',
      mcpTokenRequired: 'Enter the MCP token.',
      mcpTokenPlaceholder: 'Replace the placeholder with a real token.',
      scenariosRequired: 'Select at least one scenario.',
      approvalThreshold: 'Enter a number greater than or equal to 0.',
      requireHumanConfirmation: 'Choose whether operations require confirmation.',
      maxMessages: 'Enter a whole number from {min} to {max}.',
      maxAttachment: 'Enter a whole number from {min} to {max}.',
      invalidConfig: 'Check this field value.',
    },
  },
} satisfies Record<Locale, Messages>;
