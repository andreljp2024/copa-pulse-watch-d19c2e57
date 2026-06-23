// Pix "Copia e Cola" estático (BR Code EMV) — gerador simples
// Referência: Manual de Padrões do BACEN para iniciação de pagamento Pix.

function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, max);
}

export function buildPixPayload(opts: {
  chave: string;
  nomeRecebedor: string;
  cidade?: string;
  valor?: number;
  descricao?: string;
}): string {
  const merchantAccount = emv("00", "br.gov.bcb.pix") + emv("01", opts.chave.trim());
  const additional = opts.descricao
    ? emv("05", sanitize(opts.descricao, 25))
    : emv("05", "***");

  const parts =
    emv("00", "01") +
    emv("26", merchantAccount) +
    emv("52", "0000") +
    emv("53", "986") +
    (opts.valor && opts.valor > 0 ? emv("54", opts.valor.toFixed(2)) : "") +
    emv("58", "BR") +
    emv("59", sanitize(opts.nomeRecebedor, 25)) +
    emv("60", sanitize(opts.cidade ?? "BRASIL", 15)) +
    emv("62", additional);

  const toCrc = parts + "6304";
  return toCrc + crc16(toCrc);
}
