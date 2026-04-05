import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: Error | FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    // Zod validation errors → 400
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    // Application errors → custom status
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      });
    }

    // Prisma unique constraint violation → 409
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
        },
      });
    }

    // Prisma record not found → 404
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    }

    // Fastify rate limit → 429
    if ('statusCode' in error && (error as FastifyError).statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
    }

    // Everything else → 500
    app.log.error(error);
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});
