import { z } from 'zod';

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

export function validateSearchParams<T>(
  requestUrl: string,
  schema: z.ZodSchema<T>
): T {
  const { searchParams } = new URL(requestUrl);
  const rawValues = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(rawValues);

  if (!parsed.success) {
    throw new RequestValidationError(parsed.error.issues[0]?.message ?? 'Requisicao invalida.');
  }

  return parsed.data;
}
