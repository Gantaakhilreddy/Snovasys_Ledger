import { z } from 'zod';

export const registerSchema = z.object({
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
  phone: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR']).optional().default('ACCOUNT_HOLDER')
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email address is required')
});

