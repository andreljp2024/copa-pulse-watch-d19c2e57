// Helpers para o SaaS Bolão Copa 2026

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function brl(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function interpolate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function buildWhatsAppLink(numero: string, mensagem: string): string {
  const phone = onlyDigits(numero);
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

export const DEFAULT_TEMPLATES = {
  novo_palpite:
    "Olá! Quero participar do {{nome_bolao}}.\n\nNome: {{nome_torcedor}}\nWhatsApp: {{whatsapp_torcedor}}\nJogo: {{selecao_a}} x {{selecao_b}}\nPalpite: {{palpite_a}} x {{palpite_b}}\nValor: R$ {{valor_palpite}}\n\nDados Pix:\nRecebedor: {{nome_recebedor}}\nBanco: {{banco}}\nChave Pix: {{chave_pix}}\n\nApós o pagamento, envio o comprovante por aqui.",
  confirmacao_pagamento:
    "Olá, {{nome_torcedor}}!\n\nSeu pagamento foi confirmado no {{nome_bolao}}.\n\nJogo: {{selecao_a}} x {{selecao_b}}\nSeu palpite: {{palpite_a}} x {{palpite_b}}\nStatus: Pago\n\nBoa sorte!",
  ganhador:
    "Parabéns, {{nome_torcedor}}!\n\nVocê acertou o placar do jogo:\n\n{{selecao_a}} {{placar_a}} x {{placar_b}} {{selecao_b}}\n\nSeu palpite:\n{{palpite_a}} x {{palpite_b}}\n\nVocê está na lista de ganhadores do {{nome_bolao}}.",
  lembrete_pagamento:
    "Olá, {{nome_torcedor}}! Seu palpite no {{nome_bolao}} ainda está pendente de pagamento. Faça o Pix para {{nome_recebedor}} (chave: {{chave_pix}}) e envie o comprovante por aqui.",
};

export function publicBolaoUrl(slug: string): string {
  if (typeof window === "undefined") return `/bolao/${slug}`;
  return `${window.location.origin}/bolao/${slug}`;
}
