import { z } from 'zod';

// ── Error envelope ──

export const ErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
});

// ── Pagination ──

export const PaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.number().optional(),
});

export const CursorPaginationRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const DateRangeRequestSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ── Common types ──

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type CursorPaginationRequest = z.infer<typeof CursorPaginationRequestSchema>;
export type DateRangeRequest = z.infer<typeof DateRangeRequestSchema>;
