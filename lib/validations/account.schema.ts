import { z } from 'zod';

export const createAccountSchema = z.object({
  userId: z.string().uuid('Invalid user UUID').optional(),
  accountType: z.enum(['SAVINGS', 'CHECKING', 'BUSINESS']).default('SAVINGS'),
  initialDepositPaise: z.number().int().min(0, 'Initial deposit cannot be negative').optional().default(0)
});

export const freezeAccountSchema = z.object({
  reason: z.string().min(3, 'A valid freeze reason is required').max(500)
});

export const unfreezeAccountSchema = z.object({
  reason: z.string().min(3, 'A valid unfreeze justification is required').max(500).optional()
});

