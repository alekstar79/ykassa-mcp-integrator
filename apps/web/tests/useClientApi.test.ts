import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientApi } from '../src/composables/useClientApi.js';
import type { RequestPayload } from '../src/types.js';

const fetchMock = vi.fn<typeof fetch>();
const payload: RequestPayload = {
  message: 'Выставь счёт',
  attachment: null,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useClientApi', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    window.localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets busy while waiting and parses an approval response', async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const api = useClientApi(ref('online-school'));
    const pendingRequest = api.sendRequest(payload);

    expect(api.isBusy.value).toBe(true);
    resolveResponse(
      jsonResponse({
        reply: 'Нужно подтверждение.',
        requires_approval: true,
        approval_id: 'approval-1',
        proposed_action: {
          tool: 'create_payment',
          args: { amount: { value: '100' } },
        },
        tool_calls: [],
      }),
    );
    await pendingRequest;

    expect(api.isBusy.value).toBe(false);
    expect(api.apiReply.value).toBe('Нужно подтверждение.');
    expect(api.pendingApproval.value).toEqual({
      approvalId: 'approval-1',
      actions: [
        {
          tool: 'create_payment',
          args: { amount: { value: '100' } },
          requires_confirmation: true,
        },
      ],
    });
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as { client: string; messages: Array<{ content: string }> };
    expect(requestBody.client).toBe('online-school');
    expect(requestBody.messages[0]?.content).toBe('Выставь счёт');
  });

  it('exposes API errors and always clears the busy state', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Invalid request.' }, 400),
    );
    const api = useClientApi(ref('online-school'));

    await api.sendRequest(payload);

    expect(api.errorMessage.value).toBe('Ошибка API (Invalid request.)');
    expect(api.isBusy.value).toBe(false);
    expect(api.apiReply.value).toBe('');
  });

  it('sends attachments and normalizes responses with no optional fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        requires_approval: true,
        approval_id: 'approval-3',
        proposed_actions: [
          {
            tool: 'create_payment',
            args: {},
            requires_confirmation: false,
          },
        ],
      }),
    );
    const api = useClientApi(ref('online-school'));

    await api.sendRequest({
      message: 'Создай платёж из файла',
      attachment: {
        filename: 'students.csv',
        content: 'Анна,100',
        bytes: 9,
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.attachment).toEqual({
      filename: 'students.csv',
      content: 'Анна,100',
    });
    expect(api.apiReply.value).toBe('Запрос обработан.');
    expect(api.apiWarning.value).toBe('');
    expect(api.toolCalls.value).toEqual([]);
    expect(api.pendingApproval.value).toBeNull();
  });

  it('sends saved client-default overrides with the request', async () => {
    window.localStorage.setItem(
      'ykassa_ui_defaults',
      JSON.stringify({
        currency: 'USD',
        vat_code: 3,
        capture: false,
        return_url: 'https://example.test/return',
        invoice_expiry_days: 12,
      }),
    );
    fetchMock.mockResolvedValue(jsonResponse({}));
    const api = useClientApi(ref('online-school'));

    await api.sendRequest(payload);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.overrides).toEqual({
      currency: 'USD',
      vat_code: 3,
      capture: false,
      return_url: 'https://example.test/return',
      invoice_expiry_days: 12,
    });
  });

  it('uses the current locale for fallback responses', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));
    const locale = ref<'ru' | 'en'>('en');
    const api = useClientApi(ref('online-school'), locale);

    await api.sendRequest(payload);
    expect(api.apiReply.value).toBe('Request processed.');

    locale.value = 'ru';
    expect(api.apiReply.value).toBe('Запрос обработан.');
    await api.sendRequest(payload);
    expect(api.apiReply.value).toBe('Запрос обработан.');
  });

  it('reports incomplete approval data and handles non-Error failures', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ requires_approval: true }))
      .mockRejectedValueOnce('network unavailable');
    const api = useClientApi(ref('online-school'));

    await api.sendRequest(payload);
    expect(api.errorMessage.value).toBe(
      'API вернул неполные данные для подтверждения.',
    );
    expect(api.isBusy.value).toBe(false);

    await api.sendRequest(payload);
    expect(api.errorMessage.value).toBe('Не удалось отправить запрос.');
    expect(api.isBusy.value).toBe(false);
  });

  it('posts the approval decision and appends returned tool calls', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          requires_approval: true,
          approval_id: 'approval-2',
          proposed_actions: [
            {
              tool: 'create_payment',
              args: {},
              requires_confirmation: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          reply: 'Одобрено.',
          requires_approval: false,
          tool_calls: [
            { id: 'call-1', name: 'create_payment', args: {}, result: 'ok' },
          ],
        }),
      );
    const api = useClientApi(ref('online-school'));

    await api.sendRequest(payload);
    await api.resolveApproval(true);

    expect(api.apiReply.value).toBe('Одобрено.');
    expect(api.pendingApproval.value).toBeNull();
    expect(api.toolCalls.value).toEqual([
      { id: 'call-1', name: 'create_payment', args: {}, result: 'ok' },
    ]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/approve');
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).approved,
    ).toBe(true);
  });

  it('does nothing without a pending approval and uses the rejected default reply', async () => {
    const api = useClientApi(ref('online-school'));
    await api.resolveApproval(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          requires_approval: true,
          approval_id: 'approval-reject',
          proposed_action: {
            tool: 'create_payment',
            args: {},
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ requires_approval: false }));
    await api.sendRequest(payload);
    await api.resolveApproval(false);

    expect(api.apiReply.value).toBe('Платёж отклонён.');
    expect(api.pendingApproval.value).toBeNull();
  });
});
