import express, { type Express } from 'express';
import { createApproveRouter } from './routes/approve.js';
import { createAskRouter } from './routes/ask.js';
import { createChatHistoryRouter } from './routes/chatHistory.js';
import { createClientPublicRouter } from './routes/clientPublic.js';
import { errorHandler, corsMiddleware } from './http.js';
import { CLIENTS_DIR, MCP_SERVER_URL } from './config.js';

export interface CreateAppOptions {
  clientsDir?: string;
  historyDir?: string;
  mcpUrl?: string;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const clientsDir = options.clientsDir ?? CLIENTS_DIR;
  const mcpUrl = options.mcpUrl ?? MCP_SERVER_URL;
  const historyDir = options.historyDir;
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(express.json({ limit: '2mb' }));
  // TODO: Add JWT authentication and tenant-level authorization before production.
  app.use('/api/clients', createClientPublicRouter({ clientsDir }));
  app.use('/api', createAskRouter({ clientsDir, historyDir, mcpUrl }));
  app.use('/api', createApproveRouter({ clientsDir, historyDir, mcpUrl }));
  app.use('/api', createChatHistoryRouter({ historyDir }));
  app.use(errorHandler);

  return app;
}

export { PROJECT_ROOT, MCP_SERVER_URL } from './config.js';
export { createProviderFromEnv } from './factory.js';
export * from './types.js';
export type {
  ClientAttachment,
  ClientConfig,
  ClientSecrets,
} from './config.js';
export type {
  AgentConfig,
  AgentResult,
  ContinuationState,
} from './agentTypes.js';
