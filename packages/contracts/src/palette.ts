import type { ClientAccent } from './enums.js';

export interface AccentPaletteEntry {
  light: {
    bg: string;
    fg: string;
    hover: string;
  };
  dark: {
    bg: string;
    fg: string;
    hover: string;
  };
}

export const ACCENT_PALETTE = {
  navy: {
    light: { bg: '#1a365d', fg: '#ffffff', hover: '#142b4a' },
    dark: { bg: '#60a5fa', fg: '#111827', hover: '#93c5fd' },
  },
  terracotta: {
    light: { bg: '#9a3412', fg: '#ffffff', hover: '#7c2d12' },
    dark: { bg: '#fb923c', fg: '#111827', hover: '#fdba74' },
  },
  forest: {
    light: { bg: '#166534', fg: '#ffffff', hover: '#14532d' },
    dark: { bg: '#4ade80', fg: '#111827', hover: '#86efac' },
  },
  graphite: {
    light: { bg: '#374151', fg: '#ffffff', hover: '#1f2937' },
    dark: { bg: '#d1d5db', fg: '#111827', hover: '#e5e7eb' },
  },
  cobalt: {
    light: { bg: '#1d4ed8', fg: '#ffffff', hover: '#1e40af' },
    dark: { bg: '#60a5fa', fg: '#111827', hover: '#93c5fd' },
  },
  crimson: {
    light: { bg: '#b91c1c', fg: '#ffffff', hover: '#991b1b' },
    dark: { bg: '#f87171', fg: '#111827', hover: '#fca5a5' },
  },
} as const satisfies Record<ClientAccent, AccentPaletteEntry>;
