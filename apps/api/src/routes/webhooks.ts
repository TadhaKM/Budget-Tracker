import type { FastifyInstance } from 'fastify';

export async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/truelayer — receive real-time transaction updates
  app.post('/truelayer', async (request, reply) => {
    // TODO: Verify TrueLayer webhook signature
    // TODO: Enqueue sync:webhook job via BullMQ
    app.log.info('TrueLayer webhook received');
    return reply.code(200).send({ received: true });
  });
}
