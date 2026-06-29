import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const BRAZIL_TZ = "America/Sao_Paulo"; // UTC-3

function getZonedDate(dateInput: string | Date): Date {
  return toZonedTime(dateInput, BRAZIL_TZ);
}

export function formatBR(
  dateInput: string | Date,
  pattern: string = "dd/MM/yyyy 'às' HH:mm",
): string {
  return formatInTimeZone(getZonedDate(dateInput), BRAZIL_TZ, pattern, { locale: ptBR });
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
  return formatInTimeZone(getZonedDate(dateInput), BRAZIL_TZ, pattern, { locale: ptBR });
}

export function isLiveNow(kickoffAt: string, status: string): boolean {
  if (status !== "live") return false;
  const now = getZonedDate(new Date());
  const kickoff = getZonedDate(kickoffAt);
  return kickoff <= now;
}
