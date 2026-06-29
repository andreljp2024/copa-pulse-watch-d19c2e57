/**
 * Mapeia erros técnicos (Supabase, rede, etc.) para mensagens amigáveis em PT-BR.
 * Nunca expõe stack traces ou nomes de tabela para o usuário final.
 */
export function friendlyError(
  err: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): string {
  const errMessage = err instanceof Error ? err.message : String(err);
  const raw = errMessage.toLowerCase();

  // Auth (Supabase)
  if (raw.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (raw.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (raw.includes("user already registered")) return "Este e-mail já está cadastrado. Faça login.";
  if (raw.includes("password should be at least"))
    return "A senha precisa ter ao menos 6 caracteres.";
  if (raw.includes("rate limit") || raw.includes("too many requests"))
    return "Muitas tentativas. Aguarde alguns instantes.";
  if (raw.includes("unsupported provider")) return "Login social ainda não está configurado.";

  // Autorização / RLS
  if (
    raw.includes("forbidden") ||
    raw.includes("permission denied") ||
    raw.includes("row-level security")
  ) {
    return "Você não tem permissão para esta ação.";
  }
  if (raw.includes("unauthorized") || raw.includes("jwt"))
    return "Sessão expirada. Faça login novamente.";

  // Validação
  if (raw.includes("invalid input") || raw.includes("zoderror") || raw.includes("validation")) {
    return "Dados inválidos. Verifique os campos preenchidos.";
  }

  // Rede
  if (raw.includes("failed to fetch") || raw.includes("network") || raw.includes("timeout")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  // Banco
  if (raw.includes("duplicate key") || raw.includes("unique constraint"))
    return "Este registro já existe.";
  if (raw.includes("foreign key"))
    return "Referência inválida. Atualize a página e tente novamente.";

  return fallback;
}

/** Log estruturado server-side; nunca chame em código de cliente com PII. */
export function logServerError(label: string, err: unknown, meta: Record<string, unknown> = {}) {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[${label}]`, message, meta);
}
