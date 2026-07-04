import { createServer, type Server } from 'node:http';

export interface FakeAi {
  baseUrl: string;
  close(): void;
}

export const FAKE_REPLY = 'Hello from the fake model!';
export const FAKE_FACT = 'User is testing Nib';

/**
 * Minimal OpenAI-compatible server: /models for probes, streaming SSE for
 * chat, and a canned JSON fact array when it sees the extraction prompt —
 * letting CI exercise the full assistant pipeline with no real model.
 */
export function startFakeAi(): Promise<FakeAi> {
  const server: Server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"data":[{"id":"fake-model"}]}');
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const parsed = JSON.parse(body) as { messages: { content: string }[] };
        const isExtraction = parsed.messages.some((message) =>
          message.content.includes('extract durable facts'),
        );
        if (isExtraction) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ choices: [{ message: { content: `["${FAKE_FACT}"]` } }] }),
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        for (const chunk of ['Hello from ', 'the fake ', 'model!']) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });
      return;
    }
    res.writeHead(404).end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        close: () => server.close(),
      });
    });
  });
}
