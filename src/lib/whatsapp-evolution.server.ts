export async function fetchEvolutionWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function extractEvolutionMessageId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const key = rec.key && typeof rec.key === "object" ? (rec.key as Record<string, unknown>) : null;
  const data = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null;
  const dataKey = data?.key && typeof data.key === "object" ? (data.key as Record<string, unknown>) : null;
  const response = rec.response && typeof rec.response === "object" ? (rec.response as Record<string, unknown>) : null;
  const responseKey = response?.key && typeof response.key === "object" ? (response.key as Record<string, unknown>) : null;

  for (const candidate of [
    key?.id,
    dataKey?.id,
    responseKey?.id,
    rec.messageId,
    rec.id,
    data?.messageId,
    data?.id,
    response?.messageId,
    response?.id,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}