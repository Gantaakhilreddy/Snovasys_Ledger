import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Valid email address is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  phone: z.string().max(50).optional().nullable(),
  role: z.enum(['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR']),
  status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).optional().default('ACTIVE')
});

export const updateUserSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  status: z.enum(['ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED']).optional()
});

export const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'])
});
