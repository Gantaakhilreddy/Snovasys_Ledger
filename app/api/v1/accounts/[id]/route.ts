import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { AccountService } from '@/lib/services/account.service';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';
import { query } from '@/lib/database/db';
import { AuditService } from '@/lib/services/audit.service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const auth = await authenticateRequest(req);
    const account = await AccountService.getAccountById(id, auth.user.role, auth.user.id);

    if (!account) {
      return apiError('Account not found', 404);
    }

    return apiSuccess({ account, ...account }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to fetch account', status);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const auth = await authenticateRequest(req);
    if (auth.user.role !== 'ADMIN') {
      return apiError('Forbidden: Only administrators can update account properties.', 403);
    }

    const body = await req.json();
    const existing = await AccountService.getAccountById(id, auth.user.role, auth.user.id);
    if (!existing) {
      return apiError('Account not found', 404);
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [existing.id];
    let pIdx = 2;

    if (body.account_type && ['SAVINGS', 'CHECKING', 'BUSINESS'].includes(body.account_type)) {
      updates.push(`account_type = $${pIdx++}`);
      params.push(body.account_type);
    }

    const res = await query(`
      UPDATE accounts
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *;
    `, params);

    const updated = res.rows[0];

    await AuditService.log({
      userId: auth.user.id,
      action: 'ACCOUNT_UPDATED',
      entityType: 'ACCOUNT',
      entityId: existing.id,
      oldData: existing,
      newData: updated,
      status: 'SUCCESS'
    });

    return apiSuccess({ account: updated, ...updated }, 200, 'Account updated successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to update account', status);
  }
}

