import type { NextFunction, Request, Response } from 'express';

const UI_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.get('Origin');
  if (origin !== undefined && UI_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status =
    error instanceof HttpError
      ? error.status
      : isRecord(error) && typeof error.status === 'number'
        ? error.status
        : 500;
  const message =
    error instanceof HttpError
      ? error.message
      : status < 500 && error instanceof Error
        ? error.message
        : 'Internal server error.';

  if (status >= 500) {
    console.error('Request failed:', errorMessage(error));
  }
  res.status(status).json({ error: message });
}
