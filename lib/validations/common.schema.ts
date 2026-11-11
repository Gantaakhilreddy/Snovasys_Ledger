import { z } from 'zod';

const pageNumber = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : Number(val)),
  z.number().int().min(1).default(1)
);

const limitNumber = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? undefined : Number(val)),
  z.number().int().min(1).max(100).default(20)
);

export const paginationSchema = z.object({
  page: pageNumber,
  limit: limitNumber,
  search: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional()),
  status: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional()),
  type: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional()),
  startDate: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional()),
  endDate: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional())
});

export const uuidSchema = z.string().uuid('Invalid UUID format');
