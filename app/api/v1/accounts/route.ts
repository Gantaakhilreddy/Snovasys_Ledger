import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { AccountService } from '@/lib/services/account.service';
import { createAccountSchema } from '@/lib/validations/account.schema';
import { paginationSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiPaginated, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();
    const validated = createAccountSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    // Determine target userId
    let targetUserId = auth.user.id;
    if (auth.user.role === 'ADMIN' && validated.data.userId) {
      targetUserId = validated.data.userId;
    } else if (auth.user.role === 'ACCOUNT_HOLDER' && validated.data.userId && validated.data.userId !== auth.user.id) {
      return apiError('Forbidden: You can only create accounts for yourself.', 403);
    }

    // Only Admin can specify an initial deposit upon creation
    const initialDepositPaise = auth.user.role === 'ADMIN' ? validated.data.initialDepositPaise : 0;

    const account = await AccountService.createAccount({
      userId: targetUserId,
      accountType: validated.data.accountType,
      initialDepositPaise,
      actorId: auth.user.id
    });

    return apiSuccess({ account }, 201, 'Financial account created successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to create account', status);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);

    const pagination = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined
    });

    const ownerUserId = searchParams.get('userId') || undefined;
    const accountType = searchParams.get('accountType') || undefined;

    const { accounts, total } = await AccountService.listAccounts(
      auth.user.role,
      auth.user.id,
      {
        ownerUserId,
        status: pagination.status,
        accountType,
        search: pagination.search,
        page: pagination.page,
        limit: pagination.limit
      }
    );

    return apiPaginated(accounts, { page: pagination.page, limit: pagination.limit, total });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to list accounts', status);
  }
}

