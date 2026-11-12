import { CLIENT_LIMITS } from './limits.js';

export const CLIENT_CONFIG_DEFAULTS = {
  ui: {
    mode: 'reference-ui',
    accent: 'navy',
    radius: 2,
    shadow: 'soft',
    font_pair: 'manrope+jetbrains',
    form_style: 'flat',
    h1_size: 'm',
  },
  limits: {
    max_messages: CLIENT_LIMITS.max_messages.default,
    max_attachment_kb: CLIENT_LIMITS.max_attachment_kb.default,
  },
} as const;
