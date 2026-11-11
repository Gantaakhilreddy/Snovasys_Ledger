import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { AccountService } from '@/lib/services/account.service';
import { freezeAccountSchema } from '@/lib/validations/account.schema';
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
    const validated = freezeAccountSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const updated = await AccountService.freezeAccount(id, validated.data.reason, auth.user.id);
    return apiSuccess({ account: updated }, 200, 'Account has been frozen successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to freeze account', status);
  }
}

