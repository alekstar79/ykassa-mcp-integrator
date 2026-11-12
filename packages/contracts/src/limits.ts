export const CLIENT_LIMITS = {
  max_messages: {
    min: 1,
    max: 100,
    default: 20,
  },
  max_attachment_kb: {
    min: 1,
    max: 1024,
    default: 100,
  },
} as const;
