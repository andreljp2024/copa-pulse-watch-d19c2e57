// Máscaras BR — apenas formatação visual; salve sempre só dígitos no banco.
export const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

export function maskCpfCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, e, f) =>
    [a, b && `.${b}`, c && `.${c}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join(""),
  );
}

export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{0,5})(\d{0,3}).*/, (_, a, b) => (b ? `${a}-${b}` : a));
}

export type ViaCep = {
  localidade: string;
  uf: string;
  bairro?: string;
  logradouro?: string;
  erro?: boolean;
};

export async function fetchCep(cep: string): Promise<ViaCep | null> {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const json = (await res.json()) as ViaCep;
    return json.erro ? null : json;
  } catch {
    return null;
  }
}

export function isValidCpf(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(d[i], 10) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === +d[9] && calc(10) === +d[10];
}

export function isValidCnpj(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(d[i], 10) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +d[12] && calc(13) === +d[13];
}

export const isValidCpfCnpj = (v: string) => {
  const len = onlyDigits(v).length;
  return len === 11 ? isValidCpf(v) : len === 14 ? isValidCnpj(v) : false;
};

export const isValidPhoneBR = (v: string) => {
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
};

// DDDs válidos no Brasil
const DDDS_BR = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Valida WhatsApp BR: 11 dígitos, DDD válido, 9º dígito = 9, sem repetições óbvias. */
export function isValidWhatsAppBR(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (!DDDS_BR.has(ddd)) return false;
  if (d[2] !== "9") return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return true;
}
