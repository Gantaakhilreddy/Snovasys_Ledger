import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { withdrawSchema } from '@/lib/validations/transaction.schema';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/middleware/idempotency.middleware';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.user.role === 'AUDITOR') {
      return apiError('Forbidden: Auditors cannot execute withdrawals.', 403);
    }

    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    const body = await req.json();

    const idempCheck = await checkIdempotency(
      idempotencyKey,
      auth.user.id,
      '/api/v1/transactions/withdraw',
      body
    );
    if (idempCheck.cachedResponse) {
      return idempCheck.cachedResponse;
    }

    const validated = withdrawSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const result = await TransactionService.withdraw(
      { ...validated.data, idempotencyKey: idempotencyKey || undefined },
      auth.user.id,
      auth.user.role
    );

    const responseBody = {
      success: true,
      message: 'Withdrawal processed successfully',
      data: result,
      timestamp: new Date().toISOString()
    };

    if (idempotencyKey) {
      await saveIdempotencyResponse(idempotencyKey, auth.user.id, 200, responseBody);
    }

    return apiSuccess(result, 200, 'Withdrawal processed successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized')
      ? 401
      : error.message?.includes('Forbidden')
      ? 403
      : error.message?.includes('Conflict')
      ? 409
      : error.message?.includes('Insufficient balance')
      ? 422
      : 400;

    return apiError(error.message || 'Withdrawal failed', status);
  }
}

