import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { UserService } from '@/lib/services/user.service';
import { paginationSchema } from '@/lib/validations/common.schema';
import { createUserSchema } from '@/lib/validations/user.schema';
import { apiPaginated, apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);

    const { searchParams } = new URL(req.url);
    const pagination = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined
    });

    const role = searchParams.get('role') || undefined;

    const { users, total } = await UserService.listUsers({
      role,
      status: pagination.status,
      search: pagination.search,
      page: pagination.page,
      limit: pagination.limit
    });

    return apiPaginated(users, { page: pagination.page, limit: pagination.limit, total });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to list users', status);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Strictly only Administrators can provision new users of any role
    const auth = await authorizeRoles(req, ['ADMIN']);

    const body = await req.json();
    const validated = createUserSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const ip = req.headers.get('x-forwarded-for') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const newUser = await UserService.createUser(
      validated.data,
      auth.user.id,
      ip,
      userAgent
    );

    return apiSuccess(
      { user: newUser },
      201,
      `User ${newUser.full_name} (${newUser.role}) successfully provisioned.`
    );
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to create user', status);
  }
}

