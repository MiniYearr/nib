import type { ChatMessage } from './shared';

export interface ChatRequest {
  baseUrl: string;
  messages: ChatMessage[];
  model?: string;
  onDelta?(text: string): void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** True when an OpenAI-compatible server answers at `baseUrl` (e.g. ".../v1"). */
export async function probeEndpoint(baseUrl: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Streams a chat completion, invoking `onDelta` per token chunk and returning
 * the full text. Falls back transparently to a non-streaming JSON body when
 * the server doesn't send SSE.
 */
export async function chatCompletion(request: ChatRequest): Promise<string> {
  const url = `${request.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model ?? 'default',
      messages: request.messages,
      stream: true,
    }),
    signal: request.signal ?? AbortSignal.timeout(request.timeoutMs ?? 120_000),
  });
  if (!response.ok) {
    throw new Error(`assistant endpoint returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content ?? '';
    if (text) request.onDelta?.(text);
    return text;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          request.onDelta?.(delta);
        }
      } catch {
        // Partial or non-JSON keep-alive line — skip.
      }
    }
  }
  return full;
}
