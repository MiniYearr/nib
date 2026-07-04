import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { chatCompletion, probeEndpoint } from './client';

let server: Server | undefined;

function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler);
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address() as { port: number };
      resolve(`http://127.0.0.1:${address.port}/v1`);
    });
  });
}

afterEach(() => {
  server?.close();
  server = undefined;
});

describe('probeEndpoint', () => {
  it('is true for a live /models endpoint and false otherwise', async () => {
    const baseUrl = await listen((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"data":[{"id":"fake"}]}');
      } else {
        res.writeHead(404).end();
      }
    });
    expect(await probeEndpoint(baseUrl)).toBe(true);
    expect(await probeEndpoint('http://127.0.0.1:9', 400)).toBe(false);
  });
});

describe('chatCompletion', () => {
  it('collects SSE deltas in order', async () => {
    const baseUrl = await listen((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunks = ['Hel', 'lo ', 'world'];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });

    const deltas: string[] = [];
    const full = await chatCompletion({
      baseUrl,
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: (text) => deltas.push(text),
    });
    expect(full).toBe('Hello world');
    expect(deltas).toEqual(['Hel', 'lo ', 'world']);
  });

  it('falls back to non-streaming JSON bodies', async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'plain reply' } }] }));
    });
    expect(
      await chatCompletion({ baseUrl, messages: [{ role: 'user', content: 'hi' }] }),
    ).toBe('plain reply');
  });

  it('throws on http errors', async () => {
    const baseUrl = await listen((_req, res) => res.writeHead(500).end());
    await expect(
      chatCompletion({ baseUrl, messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/500/);
  });
});
