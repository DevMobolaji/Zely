// events/validateEvent.ts
import { ZodTypeAny } from "zod";
import { PermanentError } from "../consumer/retry.error";

export function validateWithSchema<T>(
  schema: ZodTypeAny,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new PermanentError(
      `Schema validation failed: ${result.error.message}`
    );
  }
  return result.data as T;
}
