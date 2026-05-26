/**
 * Unwraps farm envelope responses like `{sessions: [...]}`.
 * Returns a plain array of T; empty array if the shape is unexpected.
 */
export function unwrapEnvelope<T>(data: unknown, envelopeKey: string): T[] {
  if (!data || typeof data !== "object") return [];
  const payload = (data as Record<string, unknown>)[envelopeKey];
  return Array.isArray(payload) ? (payload as T[]) : [];
}
