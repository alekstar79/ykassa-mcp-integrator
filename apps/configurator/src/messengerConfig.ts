export function parseAllowedUserIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((userId) => userId.trim())
        .filter(Boolean),
    ),
  ];
}
