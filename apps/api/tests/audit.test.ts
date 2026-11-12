import { afterEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, ...fsMocks };
});

import { appendCallLog } from '../src/audit.js';

describe('appendCallLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the log directory and writes a tenant-tagged JSON line', async () => {
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.appendFile.mockResolvedValue(undefined);

    await appendCallLog('test-shop-only', {
      tool: 'get_payment',
      args: { id: 'pay-test' },
    });

    expect(fsMocks.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('/logs'),
      { recursive: true },
    );
    const jsonLine = String(fsMocks.appendFile.mock.calls[0]?.[1]);
    expect(JSON.parse(jsonLine)).toMatchObject({
      shop_id: 'test-shop-only',
      tool: 'get_payment',
      args: { id: 'pay-test' },
    });
  });

  it('logs write failures without throwing', async () => {
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.appendFile.mockRejectedValue(new Error('disk unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(appendCallLog('test-shop-only', {})).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Could not write the MCP call log:',
      'disk unavailable',
    );
  });
});
