export interface SqlErrorLike {
  number: number;
  message: string;
}

export const isSqlErrorLike = (error: unknown): error is SqlErrorLike => {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.number === 'number' && typeof candidate.message === 'string';
};

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;
