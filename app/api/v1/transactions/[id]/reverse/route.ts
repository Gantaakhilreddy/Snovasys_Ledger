import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { reversalSchema } from '@/lib/validations/transaction.schema';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN']);
    const { id } = await context.params;
    uuidSchema.parse(id);

    const body = await req.json();
    const validated = reversalSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const result = await TransactionService.reverse(id, validated.data, auth.user.id);
    return apiSuccess(result, 200, 'Transaction reversal processed successfully with compensating ledger entries');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized')
      ? 401
      : error.message?.includes('Forbidden')
      ? 403
      : error.message?.includes('already been reversed')
      ? 409
      : error.message?.includes('insufficient')
      ? 422
      : 400;

    return apiError(error.message || 'Transaction reversal failed', status);
  }
}

