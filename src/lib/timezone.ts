import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

// Fuso padrão do sistema: America/Sao_Paulo (UTC-3).
const BRAZIL_TZ = "America/Sao_Paulo";

export function formatBR(
  dateInput: string | Date,
  pattern: string = "dd/MM/yyyy 'às' HH:mm",
): string {
  // IMPORTANTE: passar a Date UTC crua. formatInTimeZone já converte para BRAZIL_TZ.
  return formatInTimeZone(dateInput, BRAZIL_TZ, pattern, { locale: ptBR });
}

export function formatBRShort(dateInput: string | Date): string {
  return formatBR(dateInput, "EEE, dd MMM • HH:mm");
}

export function formatBRFull(dateInput: string | Date): string {
  return formatBR(dateInput, "EEEE, dd 'de' MMMM • HH:mm");
}

export function formatBRDateOnly(dateInput: string | Date): string {
  return formatBR(dateInput, "dd/MM/yyyy");
}

export function formatBRTimeOnly(dateInput: string | Date): string {
  return formatBR(dateInput, "HH:mm");
}

export function formatBRCustom(dateInput: string | Date, pattern: string): string {
  return formatBR(dateInput, pattern);
}

/**
 * "Ao vivo" apenas em tempo real: exige status='live' vindo do backend.
 * Comparação de horário usa instantes UTC (Date.now vs Date do kickoff),
 * independente do fuso — UTC-3 é apenas para exibição.
 */
export function isLiveNow(kickoffAt: string, status: string): boolean {
  if (status !== "live") return false;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (Number.isNaN(kickoffMs)) return false;
  return kickoffMs <= Date.now();
}

/** Data "agora" convertida para o fuso de São Paulo (uso raro; prefira formatBR). */
export function nowInBR(): Date {
  return toZonedTime(new Date(), BRAZIL_TZ);
}

/** Converte UTC ISO -> string "yyyy-MM-ddTHH:mm" no fuso BR para input datetime-local. */
export function toDatetimeLocalBR(iso: string | Date): string {
  return formatInTimeZone(iso, BRAZIL_TZ, "yyyy-MM-dd'T'HH:mm");
}

/** Converte string "yyyy-MM-ddTHH:mm" (assumida como BR) -> Date UTC. */
export function fromDatetimeLocalBR(local: string): Date {
  return fromZonedTime(local, BRAZIL_TZ);
}
