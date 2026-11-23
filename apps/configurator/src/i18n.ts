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
  messengersGroup: string;
  messengersHint: string;
  uiGroup: string;
  nameLabel: string;
  nameHint: string;
  nameSummaryLabel: string;
  shopIdLabel: string;
  mcpTokenLabel: string;
  showMcpToken: string;
  hideMcpToken: string;
  secretHint: string;
  archiveSecretsHint: string;
  telegramTitle: string;
  maxTitle: string;
  telegramEnabledLabel: string;
  maxEnabledLabel: string;
  telegramBotTokenLabel: string;
  maxBotTokenLabel: string;
  showMessengerToken: string;
  hideMessengerToken: string;
  allowedUserIdsLabel: string;
  allowedUserIdsHint: string;
  messengerLocaleLabel: string;
  localeRu: string;
  localeEn: string;
  scenarioLabel: string;
  scenarioHint: string;
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
  messengerMode: string;
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
    messengerTokenRequired: string;
    messengerTokenPlaceholder: string;
    messengerAllowlistRequired: string;
    messengerRequired: string;
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
      'Например: выставь счёт на 5 000 ₽ за курс английского',
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
    messengersGroup: 'Мессенджеры',
    messengersHint:
      'Для работающего бота укажите токен и хотя бы один разрешённый ID пользователя. Пустой список запрещает доступ всем.',
    uiGroup: 'Профиль клиента',
    nameLabel: 'Имя клиента',
    nameHint:
      'Только строчная латиница, цифры и дефис. Пример: online-school.',
    nameSummaryLabel: 'Имя клиента (латиница)',
    shopIdLabel: 'Shop ID',
    mcpTokenLabel: 'MCP-токен',
    showMcpToken: 'Показать MCP-токен',
    hideMcpToken: 'Скрыть MCP-токен',
    secretHint: 'Хранится в .env, отдельно от config.yaml.',
    archiveSecretsHint:
      'Скачиваемый архив содержит секреты в .env. Храните его безопасно и не коммитьте .env.',
    telegramTitle: 'Telegram',
    maxTitle: 'MAX',
    telegramEnabledLabel: 'Включить Telegram',
    maxEnabledLabel: 'Включить MAX',
    telegramBotTokenLabel: 'Токен Telegram-бота',
    maxBotTokenLabel: 'Токен MAX-бота',
    showMessengerToken: 'Показать токен',
    hideMessengerToken: 'Скрыть токен',
    allowedUserIdsLabel: 'Разрешённые ID пользователей',
    allowedUserIdsHint:
      'Один ID отправителя на строку. Доступ по умолчанию запрещён.',
    messengerLocaleLabel: 'Язык ответов бота',
    localeRu: 'Русский',
    localeEn: 'Английский',
    scenarioLabel: 'Разрешённые сценарии',
    scenarioHint: 'Выберите хотя бы один доступный MCP-инструмент.',
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
    modeLabel: 'Тип клиентского приложения',
    modeHint:
      'Выберите один вариант. Для другого интерфейса создайте отдельного клиента.',
    referenceMode: 'Reference UI',
    customMode: 'Собственный UI (только API)',
    messengerMode: 'Мессенджер(ы)',
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
      'Интерфейс не входит в архив. Запускается только API. Разработайте свой UI по контракту из docs/api-contract.md.',
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
      messengerTokenRequired: 'Укажите токен включённого бота.',
      messengerTokenPlaceholder:
        'Замените значение-плейсхолдер на настоящий токен бота.',
      messengerAllowlistRequired:
        'Добавьте хотя бы один ID пользователя для включённого бота.',
      messengerRequired:
        'Включите Telegram или MAX для клиентского приложения типа «Мессенджер(ы)».',
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
      'For example: create an invoice for 5,000 RUB for an English course',
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
    messengersGroup: 'Messengers',
    messengersHint:
      'For a working bot, enter its token and at least one allowed user ID. An empty list denies access to everyone.',
    uiGroup: 'Client profile',
    nameLabel: 'Client name',
    nameHint:
      'Lowercase Latin letters, digits, and hyphens only. Example: online-school.',
    nameSummaryLabel: 'Client name (Latin letters)',
    shopIdLabel: 'Shop ID',
    mcpTokenLabel: 'MCP token',
    showMcpToken: 'Show MCP token',
    hideMcpToken: 'Hide MCP token',
    secretHint: 'Stored in .env, separate from config.yaml.',
    archiveSecretsHint:
      'The downloaded archive contains secrets in .env. Store it securely and do not commit .env.',
    telegramTitle: 'Telegram',
    maxTitle: 'MAX',
    telegramEnabledLabel: 'Enable Telegram',
    maxEnabledLabel: 'Enable MAX',
    telegramBotTokenLabel: 'Telegram bot token',
    maxBotTokenLabel: 'MAX bot token',
    showMessengerToken: 'Show token',
    hideMessengerToken: 'Hide token',
    allowedUserIdsLabel: 'Allowed user IDs',
    allowedUserIdsHint:
      'One sender ID per line. Access is denied by default.',
    messengerLocaleLabel: 'Bot response language',
    localeRu: 'Russian',
    localeEn: 'English',
    scenarioLabel: 'Allowed scenarios',
    scenarioHint: 'Select at least one available MCP tool.',
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
    modeLabel: 'Client application type',
    modeHint:
      'Choose one option. Create another client for a different interface.',
    referenceMode: 'Reference UI',
    customMode: 'Custom UI (API only)',
    messengerMode: 'Messenger(s)',
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
      'The archive includes no UI, only the API. Build your own UI using the contract in docs/api-contract.md.',
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
      messengerTokenRequired: 'Enter the enabled bot token.',
      messengerTokenPlaceholder: 'Replace the placeholder with a real bot token.',
      messengerAllowlistRequired:
        'Add at least one user ID for the enabled bot.',
      messengerRequired:
        'Enable Telegram or MAX for the Messenger(s) client type.',
      scenariosRequired: 'Select at least one scenario.',
      approvalThreshold: 'Enter a number greater than or equal to 0.',
      requireHumanConfirmation: 'Choose whether operations require confirmation.',
      maxMessages: 'Enter a whole number from {min} to {max}.',
      maxAttachment: 'Enter a whole number from {min} to {max}.',
      invalidConfig: 'Check this field value.',
    },
  },
} satisfies Record<Locale, Messages>;
