import { describe, expect, it } from 'vitest';
import {
  ApiClientError,
  createApiClient,
} from '../src/apiClient.js';

function response(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createTestClient(initialResponse: Response) {
  let nextResponse = initialResponse;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return nextResponse;
  };
  return {
    api: createApiClient('http://127.0.0.1:3000/', fetcher),
    requests,
    setResponse(value: Response) {
      nextResponse = value;
    },
  };
}

const completed = {
  reply: 'Payment link created.',
  requires_approval: false,
  tool_calls: [],
};

const approval = {
  reply: 'Review this payment.',
  requires_approval: true,
  approval_id: 'approval-1',
  proposed_action: {
    tool: 'create_payment',
    args: { amount: { value: '100.00', currency: 'RUB' } },
    requires_confirmation: true,
  },
  proposed_actions: [
    {
      tool: 'create_payment',
      args: { amount: { value: '100.00', currency: 'RUB' } },
      requires_confirmation: true,
    },
  ],
  tool_calls: [],
};
const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';

describe('messenger API client', () => {
  it('posts the expected messages DTO and parses a 200 response', async () => {
    const { api, requests } = createTestClient(response(200, completed));

    await expect(
      api.ask('online-school', [
        { role: 'user', content: 'Create a payment link' },
      ]),
    ).resolves.toEqual(completed);

    expect(requests[0]?.url).toBe('http://127.0.0.1:3000/api/ask');
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      client: 'online-school',
      messages: [{ role: 'user', content: 'Create a payment link' }],
    });
  });

  it('parses a 202 approval response', async () => {
    const { api } = createTestClient(response(202, approval));

    await expect(
      api.ask('online-school', [{ role: 'user', content: 'Pay 100 RUB' }]),
    ).resolves.toEqual(approval);
  });

  it('sends and parses a conversation session ID', async () => {
    const { api, requests } = createTestClient(
      response(200, { ...completed, session_id: SESSION_ID }),
    );

    await expect(
      api.ask(
        'online-school',
        [{ role: 'user', content: 'Check the previous payment' }],
        undefined,
        SESSION_ID,
      ),
    ).resolves.toMatchObject({ session_id: SESSION_ID });

    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      client: 'online-school',
      messages: [{ role: 'user', content: 'Check the previous payment' }],
      session_id: SESSION_ID,
    });
  });

  it('parses both complete and repeated-approval responses from approve', async () => {
    const testClient = createTestClient(
      response(200, { ...completed, approved: true }),
    );
    await expect(testClient.api.approve('approval-1', true)).resolves.toEqual({
      ...completed,
      approved: true,
    });

    testClient.setResponse(response(202, { ...approval, approval_id: 'approval-2' }));
    await expect(
      testClient.api.approve('approval-1', true),
    ).resolves.toMatchObject({
      requires_approval: true,
      approval_id: 'approval-2',
    });
  });

  it.each([400, 404, 409, 410, 500, 502])(
    'preserves API error status %s',
    async (status) => {
      const { api } = createTestClient(
        response(status, { error: 'Request failed.' }),
      );

      await expect(
        api.ask('online-school', [{ role: 'user', content: 'request' }]),
      ).rejects.toMatchObject({
        name: 'ApiClientError',
        status,
        message: 'Request failed.',
      });
    },
  );

  it('rejects malformed success payloads instead of returning them as success', async () => {
    const { api } = createTestClient(response(200, { reply: 'missing fields' }));

    await expect(
      api.ask('online-school', [{ role: 'user', content: 'request' }]),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('reads the public client endpoint without requesting any secret fields', async () => {
    const { api, requests } = createTestClient(
      response(200, {
        brand: { display_name: 'Online School' },
        allowed_scenarios: ['create_payment'],
        approval_threshold: 1000,
      }),
    );

    await expect(api.getPublicClient('online-school')).resolves.toEqual({
      brand: { display_name: 'Online School' },
      allowed_scenarios: ['create_payment'],
      approval_threshold: 1000,
    });
    expect(requests[0]?.url).toBe(
      'http://127.0.0.1:3000/api/clients/online-school/public',
    );
  });
});
