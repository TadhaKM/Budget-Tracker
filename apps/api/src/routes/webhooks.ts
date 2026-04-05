import type { FastifyInstance } from 'fastify';
import { getBankingProvider } from '../services/truelayer.js';
import { syncWebhookQueue } from '../jobs/queues.js';

export async function webhookRoutes(app: FastifyInstance) {
  // Fastify must preserve the raw body for HMAC verification.
  // Register rawBody content type parser for this route scope.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // POST /webhooks/truelayer — receive real-time events
  app.post('/truelayer', async (request, reply) => {
    const rawBody = request.body as Buffer;
    const signature = request.headers['x-tl-webhook-signature'] as string | undefined;

    // 1. Verify signature
    if (!signature) {
      app.log.warn('Webhook received without signature header');
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing signature' } });
    }

    const provider = getBankingProvider();
    const valid = provider.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      app.log.warn('Webhook signature verification failed');
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid signature' } });
    }

    // 2. Parse the payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } });
    }

    // 3. Respond immediately, process async via BullMQ
    const event = provider.parseWebhookEvent(payload);
    await syncWebhookQueue.add(
      `webhook:${event.type}:${Date.now()}`,
      { event },
      { removeOnComplete: 100, removeOnFail: 200 },
    );

    app.log.info({ type: event.type }, 'TrueLayer webhook enqueued');
    return reply.code(200).send({ received: true });
  });
}
