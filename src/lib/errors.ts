/**
 * Mapeia erros técnicos (Supabase, rede, etc.) para mensagens amigáveis em PT-BR.
 * Nunca expõe stack traces ou nomes de tabela para o usuário final.
 */
export function friendlyError(err: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const raw = (err as any)?.message?.toString?.() ?? String(err ?? "");
  const msg = raw.toLowerCase();

  // Auth (Supabase)
  if (msg.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("user already registered")) return "Este e-mail já está cadastrado. Faça login.";
  if (msg.includes("password should be at least")) return "A senha precisa ter ao menos 6 caracteres.";
  if (msg.includes("rate limit") || msg.includes("too many requests")) return "Muitas tentativas. Aguarde alguns instantes.";
  if (msg.includes("unsupported provider")) return "Login social ainda não está configurado.";

  // Autorização / RLS
  if (msg.includes("forbidden") || msg.includes("permission denied") || msg.includes("row-level security")) {
    return "Você não tem permissão para esta ação.";
  }
  if (msg.includes("unauthorized") || msg.includes("jwt")) return "Sessão expirada. Faça login novamente.";

  // Validação
  if (msg.includes("invalid input") || msg.includes("zoderror") || msg.includes("validation")) {
    return "Dados inválidos. Verifique os campos preenchidos.";
  }

  // Rede
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  // Banco
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) return "Este registro já existe.";
  if (msg.includes("foreign key")) return "Referência inválida. Atualize a página e tente novamente.";

  return fallback;
}

/** Log estruturado server-side; nunca chame em código de cliente com PII. */
export function logServerError(label: string, err: unknown, meta: Record<string, unknown> = {}) {
  const message = (err as any)?.message ?? String(err);
  // eslint-disable-next-line no-console
  console.error(`[${label}]`, message, meta);
}
