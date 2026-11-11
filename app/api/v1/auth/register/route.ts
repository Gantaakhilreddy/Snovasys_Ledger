import { NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validations/auth.schema';
import { AuthService } from '@/lib/services/auth.service';
import { apiSuccess, apiError } from '@/lib/utils/response';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(ip, { keyPrefix: 'reg', limit: 10, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return apiError('Too many registration requests. Please try again later.', 429);
    }

    const body = await req.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    // Public registration is restricted strictly to ACCOUNT_HOLDER and requires Admin Approval
    const result = await AuthService.register({
      ...validated.data,
      role: 'ACCOUNT_HOLDER',
      status: 'PENDING',
      ipAddress: ip,
      userAgent
    });

    return apiSuccess(
      result,
      201,
      'Account holder registration submitted successfully. Your account is pending administrator approval before access is activated.'
    );
  } catch (error: any) {
    return apiError(error.message || 'Registration failed', 400);
  }
}

