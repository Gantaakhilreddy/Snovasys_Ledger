import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
  timestamp: string;
}

export function apiSuccess<T>(data: T, status: number = 200, message?: string) {
  const body: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(body, { status });
}

export function apiPaginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message?: string
) {
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const body = {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(body, { status: 200 });
}

export function apiError(message: string, status: number = 400, details?: any) {
  const body: ApiResponse = {
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(body, { status });
}

