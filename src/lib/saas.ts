// Helpers para o SaaS Bolão Copa 2026

// Contato do Dev responsável pelo Bolão AI (cortesia para torcedores brasileiros).
// Ajuste este número (formato internacional, só dígitos) para o WhatsApp real do dev.
export const DEV_WHATSAPP = "5511999999999";
export const DEV_NOME = "Dev do Bolão AI";
export const LIMITE_PALPITES_FREE = 50;
export const LIMITE_PALPITES_AVISO = 40;

export function buildDevWhatsAppLink(mensagem: string): string {
  return `https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}

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

export function interpolate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
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
    "⚽ Olá! Quero participar do *{{nome_bolao}}* 🏆\n\n👤 Nome: {{nome_torcedor}}\n📱 WhatsApp: {{whatsapp_torcedor}}\n\n🆚 Jogo: {{bandeira_a}} {{selecao_a}} x {{bandeira_b}} {{selecao_b}}\n🎯 Palpite: *{{palpite_a}} x {{palpite_b}}*\n💰 Valor: *R$ {{valor_palpite}}*\n\n💳 Já vou fazer o Pix e envio o comprovante por aqui. 🙌🍀",
  confirmacao_pagamento:
    "👍 Olá, {{nome_torcedor}}!\n\n✅ Seu palpite foi *confirmado* no *{{nome_bolao}}* 🏆\n\n🆚 Jogo: {{bandeira_a}} {{selecao_a}} x {{bandeira_b}} {{selecao_b}}\n🎯 Seu palpite: *{{palpite_a}} x {{palpite_b}}*\n💵 Valor: R$ {{valor_palpite}}\n📌 Status: *Pago ✅*\n\nBoa sorte! 🍀⚽",
  ganhador:
    "🏆🎉🥳 PARABÉNS, {{nome_torcedor}}! 🎊✨\n\n🤩 Não acreditamos... VOCÊ CRAVOU! 😱⚽\n\n🎯 Placar oficial:\n{{bandeira_a}} {{selecao_a}} *{{placar_a}} x {{placar_b}}* {{bandeira_b}} {{selecao_b}} 🥅🔥\n\n🎲 Seu palpite: *{{palpite_a}} x {{palpite_b}}* ✅\n\n💰🥇 Você entrou para a lista de *GANHADORES* do *{{nome_bolao}}*! 🏅💚💛\n\n🤝 Em breve entramos em contato para combinar o pagamento do prêmio. 🎁\n\nAproveita e comemora! 🕺💃🎶🍻",
  lembrete_pagamento:
    "⏰ Olá, {{nome_torcedor}}!\n\nSeu palpite no *{{nome_bolao}}* ainda está *pendente de pagamento* 💳\n\n🏦 Pix para: *{{nome_recebedor}}*\n🔑 Chave: `{{chave_pix}}`\n🏛️ Banco: {{banco}}\n\n📎 Envie o comprovante por aqui para confirmarmos. 🙌⚽",
};

export function publicBolaoUrl(slug: string): string {
  if (typeof window === "undefined") return `/bolao/${slug}`;
  return `${window.location.origin}/bolao/${slug}`;
}
