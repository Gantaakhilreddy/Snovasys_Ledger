import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validations/auth.schema';
import { transferSchema, depositSchema, withdrawSchema } from '@/lib/validations/transaction.schema';

describe('Zod Request Validation Schemas', () => {
  it('should validate robust password rules on registration', () => {
    // Valid password
    const valid = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'SecurePassword@123',
      full_name: 'Test User'
    });
    expect(valid.success).toBe(true);

    // Weak password without numbers/specials
    const weak = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password',
      full_name: 'Test User'
    });
    expect(weak.success).toBe(false);
  });

  it('should validate transfer payload constraints', () => {
    const validTransfer = transferSchema.safeParse({
      sourceAccountId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      destinationAccountId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      amountPaise: 50000,
      description: 'Rent payment'
    });
    expect(validTransfer.success).toBe(true);

    // Invalid negative or zero amount
    const invalidAmount = transferSchema.safeParse({
      sourceAccountId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      destinationAccountId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      amountPaise: -500
    });
    expect(invalidAmount.success).toBe(false);

    // Missing destination account
    const missingDest = transferSchema.safeParse({
      sourceAccountId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      amountPaise: 1000
    });
    expect(missingDest.success).toBe(false);
  });
});
