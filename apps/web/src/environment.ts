const configuredApiUrl = import.meta.env.VITE_API_URL;

export const API_URL =
  configuredApiUrl === undefined
    ? 'http://localhost:3000'
    : configuredApiUrl.trim().replace(/\/+$/u, '');
