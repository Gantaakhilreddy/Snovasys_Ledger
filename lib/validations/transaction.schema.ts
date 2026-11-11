import { z } from 'zod';

export const transferSchema = z.object({
  sourceAccountId: z.string().min(1, 'Source account is required'),
  destinationAccountId: z.string().optional(),
  destinationAccountNumber: z.string().optional(),
  amountPaise: z.number().int().positive('Transfer amount must be strictly greater than 0 paise').optional(),
  amount: z.number().positive('Transfer amount must be strictly greater than ₹0').optional(),
  description: z.string().max(255).optional().default('Account Transfer'),
  idempotencyKey: z.string().min(5).max(255).optional()
}).transform((data) => {
  const paise = data.amountPaise ?? (data.amount !== undefined ? Math.round(data.amount * 100) : 0);
  return {
    ...data,
    amountPaise: paise
  };
}).refine(
  data => data.destinationAccountId || data.destinationAccountNumber,
  { message: 'Either destinationAccountId or destinationAccountNumber must be provided' }
).refine(
  data => data.amountPaise > 0,
  { message: 'Transfer amount must be strictly greater than ₹0' }
);

export const depositSchema = z.object({
  accountId: z.string().min(1, 'Valid account identifier is required'),
  amountPaise: z.number().int().positive('Deposit amount must be strictly greater than 0 paise').optional(),
  amount: z.number().positive('Deposit amount must be strictly greater than ₹0').optional(),
  description: z.string().max(255).optional().default('Account Deposit'),
  idempotencyKey: z.string().min(5).max(255).optional()
}).transform((data) => {
  const paise = data.amountPaise ?? (data.amount !== undefined ? Math.round(data.amount * 100) : 0);
  return {
    ...data,
    amountPaise: paise
  };
}).refine(
  data => data.amountPaise > 0,
  { message: 'Deposit amount must be strictly greater than ₹0' }
);

export const withdrawSchema = z.object({
  accountId: z.string().min(1, 'Valid account identifier is required'),
  amountPaise: z.number().int().positive('Withdrawal amount must be strictly greater than 0 paise').optional(),
  amount: z.number().positive('Withdrawal amount must be strictly greater than ₹0').optional(),
  description: z.string().max(255).optional().default('Account Withdrawal'),
  idempotencyKey: z.string().min(5).max(255).optional()
}).transform((data) => {
  const paise = data.amountPaise ?? (data.amount !== undefined ? Math.round(data.amount * 100) : 0);
  return {
    ...data,
    amountPaise: paise
  };
}).refine(
  data => data.amountPaise > 0,
  { message: 'Withdrawal amount must be strictly greater than ₹0' }
);

export const reversalSchema = z.object({
  reason: z.string().min(5, 'Detailed reversal reason must be at least 5 characters').max(500)
});

