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
