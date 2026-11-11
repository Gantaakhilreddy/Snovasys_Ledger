import { NextRequest } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validations/auth.schema';
import { AuthService } from '@/lib/services/auth.service';
import { apiSuccess, apiError } from '@/lib/utils/response';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(ip, { keyPrefix: 'pwd-rst', limit: 5, windowSeconds: 300 });
    if (!rateLimit.allowed) {
      return apiError('Too many password reset requests. Please try again later.', 429);
    }

    const body = await req.json();
    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const result = await AuthService.forgotPassword(validated.data.email, ip);
    return apiSuccess(result, 200);
  } catch (error: any) {
    return apiError(error.message || 'Password reset request failed', 400);
  }
}

