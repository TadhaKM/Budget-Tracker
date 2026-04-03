import fp from 'fastify-plugin';
import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ error: 'Missing authorization token' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    // Look up our internal user ID from the Supabase ID
    const user = await app.prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      select: { id: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return reply.code(401).send({ error: 'User not found' });
    }

    request.userId = user.id;
  });
});
