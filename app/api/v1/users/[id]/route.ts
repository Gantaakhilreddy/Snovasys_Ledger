import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { UserService } from '@/lib/services/user.service';
import { updateUserSchema } from '@/lib/validations/user.schema';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    uuidSchema.parse(id);

    const auth = await authenticateRequest(req);
    if (auth.user.role === 'ACCOUNT_HOLDER' && auth.user.id !== id) {
      return apiError('Forbidden: You can only view your own profile.', 403);
    }

    const user = await UserService.getUserById(id);
    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({ user }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to fetch user', status);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    uuidSchema.parse(id);

    const auth = await authenticateRequest(req);
    if (auth.user.role === 'ACCOUNT_HOLDER' && auth.user.id !== id) {
      return apiError('Forbidden: You can only update your own profile.', 403);
    }

    const body = await req.json();
    const validated = updateUserSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    // Only Admin can modify account status
    if (validated.data.status && auth.user.role !== 'ADMIN') {
      return apiError('Forbidden: Only administrators can update account status.', 403);
    }

    const updated = await UserService.updateUser(id, validated.data, auth.user.id);
    return apiSuccess({ user: updated }, 200, 'User profile updated successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to update user', status);
  }
}

