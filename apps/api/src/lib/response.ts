/**
 * Standardised response helpers.
 *
 * All API responses follow the envelope:
 *   { data, pagination? }   — success
 *   { error: { code, message, details? } } — failure
 */

import type { FastifyReply } from 'fastify';

/** Wrap a single resource. */
export function ok<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.code(statusCode).send({ data });
}

/** Wrap a created resource. */
export function created<T>(reply: FastifyReply, data: T) {
  return ok(reply, data, 201);
}

/** Wrap a paginated list. */
export function paginated<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { nextCursor: string | null; hasMore: boolean },
) {
  return reply.code(200).send({ data, pagination });
}

/** 204 No Content. */
export function noContent(reply: FastifyReply) {
  return reply.code(204).send();
}

/** Success message. */
export function success(reply: FastifyReply, message = 'OK') {
  return reply.code(200).send({ success: true, message });
}

/**
 * Helper: apply cursor pagination to a Prisma query result.
 *
 * Pass the raw result from findMany (fetched with take+1).
 * Returns the trimmed data + pagination metadata.
 */
export function applyCursorPagination<T extends { id: string }>(
  results: T[],
  take: number,
): { data: T[]; pagination: { nextCursor: string | null; hasMore: boolean } } {
  const hasMore = results.length > take;
  const data = hasMore ? results.slice(0, take) : results;
  return {
    data,
    pagination: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    },
  };
}
