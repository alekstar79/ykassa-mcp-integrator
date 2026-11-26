import { Router } from 'express';
import {
  CHAT_HISTORY_DIR,
  readChatHistory,
  resolveSessionId,
} from '../chatHistory.js';
import { HttpError } from '../http.js';
import { validateClientName } from '../config.js';

export interface ChatHistoryRouterOptions {
  historyDir?: string;
}

export function createChatHistoryRouter(
  options: ChatHistoryRouterOptions = {},
): Router {
  const router = Router();
  const historyDir = options.historyDir ?? CHAT_HISTORY_DIR;

  router.get('/history', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const clientName = validateClientName(req.query.client);
      if (typeof req.query.session_id !== 'string') {
        throw new HttpError(400, '"session_id" is required.');
      }
      const sessionId = resolveSessionId(req.query.session_id);
      const messages = await readChatHistory(
        clientName,
        sessionId,
        historyDir,
      );

      res.json({
        session_id: sessionId,
        messages: messages.map((message) => ({
          id: message.id,
          turn_id: message.turnId,
          created_at: message.createdAt,
          role: message.role,
          content: message.content,
          ...(message.toolCalls === undefined
            ? {}
            : {
                tool_calls: message.toolCalls.map((toolCall) => ({
                  name: toolCall.name,
                  args: toolCall.args,
                  ...(toolCall.result === undefined
                    ? {}
                    : { result: toolCall.result }),
                  ...(toolCall.error === undefined
                    ? {}
                    : { error: toolCall.error }),
                })),
              }),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
