import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { UserService } from '@/lib/services/user.service';
import { updateRoleSchema } from '@/lib/validations/user.schema';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN']);
    const { id } = await context.params;
    uuidSchema.parse(id);

    const body = await req.json();
    const validated = updateRoleSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const updated = await UserService.updateRole(id, validated.data.role, auth.user.id);
    return apiSuccess({ user: updated }, 200, 'User role updated successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to update user role', status);
  }
}

