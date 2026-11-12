import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  corsMiddleware,
  errorHandler,
  errorMessage,
  HttpError,
  isRecord,
} from '../src/http.js';

function createApp() {
  const app = express();
  app.use(corsMiddleware);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/bad-request', (_req, _res, next) =>
    next(new HttpError(400, 'Bad request.')),
  );
  app.get('/unprocessable', (_req, _res, next) =>
    next(Object.assign(new Error('Invalid entity.'), { status: 422 })),
  );
  app.get('/failure', (_req, _res, next) =>
    next(new Error('Sensitive internal detail.')),
  );
  app.use(errorHandler);
  return app;
}

describe('HTTP helpers', () => {
  it('recognizes plain records and rejects arrays and null', () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('formats unknown error values', () => {
    expect(errorMessage(new Error('failure'))).toBe('failure');
    expect(errorMessage('failure')).toBe('Unknown error');
  });

  it('sets CORS headers only for configured origins and answers preflight', async () => {
    const app = createApp();
    const allowed = await request(app)
      .get('/ok')
      .set('Origin', 'http://localhost:5173');
    const disallowed = await request(app)
      .get('/ok')
      .set('Origin', 'https://untrusted.example');
    const preflight = await request(app)
      .options('/ok')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:5173',
    );
  });

  it('preserves client errors and hides internal server details', async () => {
    const app = createApp();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const badRequest = await request(app).get('/bad-request');
    const unprocessable = await request(app).get('/unprocessable');
    const failure = await request(app).get('/failure');

    expect(badRequest.status).toBe(400);
    expect(badRequest.body.error).toBe('Bad request.');
    expect(unprocessable.status).toBe(422);
    expect(unprocessable.body.error).toBe('Invalid entity.');
    expect(failure.status).toBe(500);
    expect(failure.body.error).toBe('Internal server error.');
    expect(log).toHaveBeenCalledOnce();
  });
});
