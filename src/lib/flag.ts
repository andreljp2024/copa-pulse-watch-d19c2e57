// Converte código FIFA/IOC (3 letras) em emoji bandeira (regional indicators).
// Cobre nações participantes/candidatas à Copa 2026 e principais seleções.

const FIFA_TO_ISO2: Record<string, string> = {
  BRA: "BR", ARG: "AR", URU: "UY", CHI: "CL", PAR: "PY", PER: "PE", COL: "CO",
  ECU: "EC", VEN: "VE", BOL: "BO", USA: "US", MEX: "MX", CAN: "CA", CRC: "CR",
  PAN: "PA", HON: "HN", SLV: "SV", GUA: "GT", JAM: "JM", HAI: "HT", CUW: "CW",
  TRI: "TT", GER: "DE", ALE: "DE", FRA: "FR", ESP: "ES", ITA: "IT", POR: "PT",
  NED: "NL", HOL: "NL", BEL: "BE", ENG: "GB", SCO: "GB", WAL: "GB", NIR: "GB",
  IRL: "IE", SUI: "CH", AUT: "AT", CRO: "HR", SRB: "RS", POL: "PL", DEN: "DK",
  SWE: "SE", NOR: "NO", FIN: "FI", ISL: "IS", CZE: "CZ", SVK: "SK", HUN: "HU",
  ROU: "RO", BUL: "BG", GRE: "GR", TUR: "TR", UKR: "UA", RUS: "RU", BLR: "BY",
  ALB: "AL", BIH: "BA", MKD: "MK", SVN: "SI", MNE: "ME", KOS: "XK", LUX: "LU",
  ISR: "IL", KSA: "SA", ARB: "SA", QAT: "QA", UAE: "AE", IRN: "IR", IRQ: "IQ",
  JOR: "JO", LBN: "LB", SYR: "SY", KUW: "KW", BHR: "BH", OMA: "OM", YEM: "YE",
  JPN: "JP", KOR: "KR", PRK: "KP", CHN: "CN", HKG: "HK", TPE: "TW", VIE: "VN",
  THA: "TH", MAS: "MY", SIN: "SG", IDN: "ID", PHI: "PH", IND: "IN", UZB: "UZ",
  KAZ: "KZ", TKM: "TM", KGZ: "KG", TJK: "TJ", AUS: "AU", NZL: "NZ", FIJ: "FJ",
  RSA: "ZA", NGA: "NG", GHA: "GH", CIV: "CI", SEN: "SN", CMR: "CM", MAR: "MA",
  MRC: "MA", TUN: "TN", ALG: "DZ", EGY: "EG", LBY: "LY", SUD: "SD", ETH: "ET",
  KEN: "KE", UGA: "UG", TAN: "TZ", ANG: "AO", MOZ: "MZ", ZIM: "ZW", ZAM: "ZM",
  MLI: "ML", BFA: "BF", NIG: "NE", GUI: "GN", COD: "CD", CGO: "CG", GAB: "GA",
  BEN: "BJ", TOG: "TG", CPV: "CV", MTN: "MR", GAM: "GM", SLE: "SL", LBR: "LR",
  CTA: "CF", GEQ: "GQ",
};

export function flagEmoji(code?: string | null): string {
  if (!code) return "";
  const iso = FIFA_TO_ISO2[code.toUpperCase()] ?? (code.length === 2 ? code.toUpperCase() : "");
  if (iso.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + iso.charCodeAt(0) - 65, A + iso.charCodeAt(1) - 65);
}
