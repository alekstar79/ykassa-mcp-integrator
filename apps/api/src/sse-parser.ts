import type { SSEEvent } from './types.js';

// SSE parser (Server-Sent Events)
// ---------------------------------------------------------------------------

export class SSEParserStream extends TransformStream<string, SSEEvent> {
  constructor() {
    let buffer = '';
    let event: Partial<SSEEvent> = {};

    const dispatchEvent = (controller: TransformStreamDefaultController<SSEEvent>): void => {
      if (event.data !== undefined) {
        controller.enqueue({ event: event.event, data: event.data });
      }
      event = {};
    };

    const processLine = (
      line: string,
      controller: TransformStreamDefaultController<SSEEvent>,
    ): void => {
      if (line === '') {
        dispatchEvent(controller);
        return;
      }
      if (line.startsWith(':')) {
        return;
      }

      const colonIndex = line.indexOf(':');
      const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
      const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).replace(/^ /, '');

      if (field === 'event') {
        event.event = value;
      } else if (field === 'data') {
        event.data = event.data !== undefined ? event.data + '\n' + value : value;
      }
    };

    super({
      transform(chunk: string, controller: TransformStreamDefaultController<SSEEvent>): void {
        buffer += chunk;
        // A trailing CR may be the first half of a CRLF split across chunks.
        const endIndex = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length;
        const lines = buffer.slice(0, endIndex).split(/\r\n|\r|\n/);
        buffer = (lines.pop() ?? '') + buffer.slice(endIndex);
        for (const line of lines) {
          processLine(line, controller);
        }
      },

      flush(controller: TransformStreamDefaultController<SSEEvent>): void {
        for (const line of buffer.split(/\r\n|\r|\n/)) {
          if (line) {
            processLine(line, controller);
          }
        }
        dispatchEvent(controller);
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export function tryParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
