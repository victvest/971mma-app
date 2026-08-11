import { FunctionsHttpError } from '@supabase/supabase-js';
import type { ApiError, ApiErrorCode } from '@/lib/apiError';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';
import { recordPerfEdgeInvocation } from '@/shared/performance';
import { getSupabaseClient } from '@/services/supabase/client';

type EdgeErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

const EDGE_CODE_MAP: Record<string, ApiErrorCode> = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  NOT_LINKED: 'NOT_FOUND',
  ALREADY_CHECKED_IN: 'UNKNOWN',
  AMBIGUOUS_MATCH: 'UNKNOWN',
  UPSTREAM_ERROR: 'SERVER_ERROR',
  INVALID_CREDENTIALS: 'UNAUTHORIZED',
  EMAIL_NOT_FOUND: 'NOT_FOUND',
  WRONG_PASSWORD: 'UNAUTHORIZED',
  EMAIL_NOT_CONFIRMED: 'FORBIDDEN',
  ACCOUNT_DISABLED: 'FORBIDDEN',
  BAD_REQUEST: 'UNKNOWN',
  RATE_LIMITED: 'UNKNOWN',
  TOKEN_INVALID: 'UNKNOWN',
  TOKEN_EXPIRED: 'UNKNOWN',
  OUTSIDE_GEOFENCE: 'UNKNOWN',
};

async function normalizeInvokeError(error: unknown): Promise<ApiError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as EdgeErrorBody;
      if (body?.error) return normalizeBodyError(body);
    } catch {
      // Fall through to the generic FunctionsHttpError message below.
    }
  }

  return {
    message: toUserFacingErrorMessage(error, {
      fallback: 'Something went wrong. Please try again, or talk to the front desk for help.',
    }),
    code: 'UNKNOWN',
    status: null,
  };
}

function normalizeBodyError(body: EdgeErrorBody): ApiError {
  const code = body.error?.code ?? 'UNKNOWN';
  const mappedCode = EDGE_CODE_MAP[code] ?? 'UNKNOWN';
  return {
    message: toUserFacingErrorMessage(
      { message: body.error?.message ?? '', rawCode: code, code: mappedCode },
      {
        fallback: 'Something went wrong. Please try again, or talk to the front desk for help.',
      },
    ),
    code: mappedCode,
    status: null,
    rawCode: body.error?.code,
  };
}

export async function invokeEdge<
  TResponse,
  TBody extends Record<string, unknown> = Record<string, unknown>,
>(name: string, body?: TBody): Promise<TResponse> {
  recordPerfEdgeInvocation(name);

  const { data, error } = await getSupabaseClient().functions.invoke<TResponse>(name, {
    body,
  });

  if (error) {
    throw await normalizeInvokeError(error);
  }

  const maybeError = data as EdgeErrorBody | null;
  if (maybeError?.error) {
    throw normalizeBodyError(maybeError);
  }

  if (!data) {
    throw {
      message: 'Something went wrong. Please try again, or talk to the front desk for help.',
      code: 'UNKNOWN',
      status: null,
    } satisfies ApiError;
  }

  return data;
}
