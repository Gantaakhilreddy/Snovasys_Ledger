import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN']);
    const { id } = await context.params;

    const result = await TransactionService.approveDeposit(id, auth.user.id);

    return apiSuccess(result, 200, 'Deposit successfully approved and credited to account.');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized')
      ? 401
      : error.message?.includes('Forbidden')
      ? 403
      : 400;
    return apiError(error.message || 'Failed to approve deposit', status);
  }
}

