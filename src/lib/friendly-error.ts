/**
 * Traduz erros técnicos (Postgres/PostgREST/Storage/Supabase) em mensagens
 * amigáveis ao cliente. Nunca deixa vazar SQLSTATE, nomes de constraints ou
 * "duplicate key value violates ..." direto no toast.
 */

type AnyErr = unknown;

function pickCode(e: AnyErr): string | null {
  if (!e || typeof e !== "object") return null;
  const obj = e as Record<string, unknown>;
  const c = obj.code ?? obj.status ?? obj.statusCode;
  return typeof c === "string" || typeof c === "number" ? String(c) : null;
}

function pickMessage(e: AnyErr): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const m = obj.message ?? obj.error_description ?? obj.error ?? obj.hint;
    if (typeof m === "string") return m;
  }
  try {
    return String(e);
  } catch {
    return "";
  }
}

/** Mensagem pronta para toast — sempre em português, curta e acionável. */
export function friendlyError(e: AnyErr, fallback = "Algo deu errado. Tente novamente."): string {
  const code = pickCode(e);
  const raw = pickMessage(e).toLowerCase();

  // Postgres SQLSTATEs mais comuns via PostgREST
  if (code === "23505" || raw.includes("duplicate key")) {
    return "Este registro já existe.";
  }
  if (code === "23503" || raw.includes("foreign key")) {
    return "Este item está vinculado a outros dados e não pode ser alterado agora.";
  }
  if (code === "23514" || raw.includes("check constraint")) {
    return "Alguns campos estão fora do formato esperado.";
  }
  if (code === "23502" || raw.includes("not-null") || raw.includes("null value in column")) {
    return "Preencha todos os campos obrigatórios.";
  }
  if (code === "42501" || raw.includes("permission denied") || raw.includes("row-level security")) {
    return "Você não tem permissão para esta ação.";
  }
  if (code === "PGRST116" || raw.includes("no rows") || raw.includes("not found")) {
    return "Não encontramos este registro.";
  }
  if (code === "PGRST301" || raw.includes("jwt") || raw.includes("invalid token")) {
    return "Sua sessão expirou. Entre novamente.";
  }
  if (code === "401" || raw.includes("unauthorized")) {
    return "Faça login novamente para continuar.";
  }
  if (code === "403" || raw.includes("forbidden")) {
    return "Você não tem permissão para esta ação.";
  }
  if (code === "429" || raw.includes("rate limit") || raw.includes("too many")) {
    return "Muitas tentativas — aguarde alguns segundos e tente de novo.";
  }
  if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("load failed")) {
    return "Sem conexão. Verifique sua internet e tente novamente.";
  }
  if (raw.includes("storage") && (raw.includes("payload too large") || raw.includes("exceeded"))) {
    return "Arquivo muito grande. Envie uma versão menor.";
  }
  if (raw.includes("bucket") && raw.includes("not found")) {
    return "Não conseguimos salvar o arquivo agora. Tente novamente.";
  }

  return fallback;
}
