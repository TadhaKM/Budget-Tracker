/**
 * Shared Zod schemas for route parameter validation.
 */

import { z } from 'zod';

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

/** Parse and validate :id from request.params. Throws ZodError if invalid. */
export function parseIdParam(params: unknown): { id: string } {
  return IdParamSchema.parse(params);
}
