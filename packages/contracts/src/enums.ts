export const CLIENT_UI_MODES = ['reference-ui', 'custom-ui'] as const;
export const CLIENT_ACCENTS = [
  'navy',
  'terracotta',
  'forest',
  'graphite',
  'cobalt',
  'crimson',
] as const;
export const CLIENT_RADII = [0, 2, 4, 8] as const;
export const CLIENT_SHADOWS = ['none', 'soft', 'medium'] as const;
export const CLIENT_FONT_PAIRS = [
  'manrope+jetbrains',
  'inter+jetbrains',
] as const;
export const CLIENT_FORM_STYLES = ['flat', 'card'] as const;
export const CLIENT_H1_SIZES = ['s', 'm', 'l'] as const;

export type ClientUiMode = (typeof CLIENT_UI_MODES)[number];
export type ClientAccent = (typeof CLIENT_ACCENTS)[number];
export type ClientRadius = (typeof CLIENT_RADII)[number];
export type ClientShadow = (typeof CLIENT_SHADOWS)[number];
export type ClientFontPair = (typeof CLIENT_FONT_PAIRS)[number];
export type ClientFormStyle = (typeof CLIENT_FORM_STYLES)[number];
export type ClientH1Size = (typeof CLIENT_H1_SIZES)[number];
