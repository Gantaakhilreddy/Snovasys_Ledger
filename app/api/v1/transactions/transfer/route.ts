import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { transferSchema } from '@/lib/validations/transaction.schema';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/middleware/idempotency.middleware';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.user.role === 'AUDITOR') {
      return apiError('Forbidden: Auditors cannot execute fund transfers.', 403);
    }

    // Rate limiting per user
    const rl = checkRateLimit(auth.user.id, { keyPrefix: 'tx-xfer', limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return apiError('Too many transfer requests. Please slow down.', 429);
    }

    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    const body = await req.json();

    // Idempotency check
    const idempCheck = await checkIdempotency(
      idempotencyKey,
      auth.user.id,
      '/api/v1/transactions/transfer',
      body
    );
    if (idempCheck.cachedResponse) {
      return idempCheck.cachedResponse;
    }

    const validated = transferSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const transferResult = await TransactionService.transfer(
      { ...validated.data, idempotencyKey: idempotencyKey || undefined },
      auth.user.id,
      auth.user.role
    );

    const responseBody = {
      success: true,
      message: 'Money transfer completed successfully',
      data: transferResult,
      timestamp: new Date().toISOString()
    };

    if (idempotencyKey) {
      await saveIdempotencyResponse(idempotencyKey, auth.user.id, 200, responseBody);
    }

    return apiSuccess(transferResult, 200, 'Money transfer completed successfully');
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

    return apiError(error.message || 'Transfer failed', status);
  }
}

