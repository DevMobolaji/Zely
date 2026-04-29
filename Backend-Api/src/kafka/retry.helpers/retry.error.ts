export class TransientError extends Error {
  public readonly isTransient = true;
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

export class PermanentError extends Error {
  public readonly isPermanent = true;
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export function serializeError(error: any) {
  if (error instanceof Error) {
    return {
      ...error, // include extra fields like isTransient or isPermanent
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

export function isRedisConnectionError(err: any): boolean {
  return (
    err.name === 'MaxRetriesPerRequestError' ||  // ioredis — exhausted retries
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' ||
    err.message?.includes('Connection is closed') || // ioredis offline queue disabled
    err.message?.includes('Redis client not initialized') // your RedisConnection guard
  );
}

export function isBullQueueError(err: any): boolean {
  return (
    err.message?.toLowerCase().includes('queue') ||
    isRedisConnectionError(err) // Bull uses Redis internally
  );
}

export function isPermanentBusinessError(err: any): boolean {
  return (
    err.message?.includes('Invalid email') ||
    err.message?.includes('User not found')
  );
}
