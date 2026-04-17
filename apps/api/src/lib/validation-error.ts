import type { ZodError } from "zod";

/** Single line of text suitable for `error` in JSON API responses. */
export function zodErrorToClientMessage(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join(". ");
}
