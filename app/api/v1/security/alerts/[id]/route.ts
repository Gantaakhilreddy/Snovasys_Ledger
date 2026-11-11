import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { SecurityService } from '@/lib/services/security.service';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';
import { z } from 'zod';

const updateAlertSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolution_notes: z.string().max(500).optional()
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);
    const { id } = await context.params;
    uuidSchema.parse(id);

    const alert = await SecurityService.getAlertById(id);
    if (!alert) {
      return apiError('Security alert not found', 404);
    }

    return apiSuccess({ alert }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to fetch security alert', status);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN']);
    const { id } = await context.params;
    uuidSchema.parse(id);

    const body = await req.json();
    const validated = updateAlertSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const updated = await SecurityService.updateAlert(id, validated.data, auth.user.id);
    return apiSuccess({ alert: updated }, 200, 'Security alert updated successfully');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to update security alert', status);
  }
}

