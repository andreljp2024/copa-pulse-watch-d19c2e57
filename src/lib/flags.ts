// Converte código FIFA (3 letras) para bandeira emoji (ISO-2)
const FIFA_TO_ISO2: Record<string, string> = {
  BRA: "BR", ARG: "AR", URU: "UY", PAR: "PY", CHI: "CL", COL: "CO", PER: "PE",
  ECU: "EC", VEN: "VE", BOL: "BO", MEX: "MX", USA: "US", CAN: "CA", CRC: "CR",
  PAN: "PA", HON: "HN", JAM: "JM", GUA: "GT", SLV: "SV", HAI: "HT", TRI: "TT",
  ENG: "GB", SCO: "GB", WAL: "GB", NIR: "GB", IRL: "IE", FRA: "FR", GER: "DE",
  ESP: "ES", POR: "PT", ITA: "IT", NED: "NL", BEL: "BE", SUI: "CH", AUT: "AT",
  POL: "PL", CZE: "CZ", SVK: "SK", HUN: "HU", ROU: "RO", BUL: "BG", GRE: "GR",
  TUR: "TR", RUS: "RU", UKR: "UA", SRB: "RS", CRO: "HR", SVN: "SI", BIH: "BA",
  MKD: "MK", ALB: "AL", MNE: "ME", KOS: "XK", DEN: "DK", SWE: "SE", NOR: "NO",
  FIN: "FI", ISL: "IS", EST: "EE", LAT: "LV", LTU: "LT",
  JPN: "JP", KOR: "KR", PRK: "KP", CHN: "CN", HKG: "HK", TPE: "TW", IND: "IN",
  IDN: "ID", MAS: "MY", SIN: "SG", THA: "TH", VIE: "VN", PHI: "PH", AUS: "AU",
  NZL: "NZ", KSA: "SA", QAT: "QA", UAE: "AE", IRN: "IR", IRQ: "IQ", SYR: "SY",
  LIB: "LB", JOR: "JO", PLE: "PS", OMA: "OM", BHR: "BH", KUW: "KW", YEM: "YE",
  UZB: "UZ", KAZ: "KZ", KGZ: "KG", TJK: "TJ", TKM: "TM", AFG: "AF", PAK: "PK",
  BAN: "BD", SRI: "LK", NEP: "NP", MAR: "MA", ALG: "DZ", TUN: "TN", LBY: "LY",
  EGY: "EG", SUD: "SD", SEN: "SN", CIV: "CI", GHA: "GH", NGA: "NG", CMR: "CM",
  RSA: "ZA", ANG: "AO", MOZ: "MZ", ZIM: "ZW", KEN: "KE", UGA: "UG", TAN: "TZ",
  ETH: "ET", MLI: "ML", BFA: "BF", TOG: "TG", BEN: "BJ", GUI: "GN", CGO: "CG",
  COD: "CD", GAB: "GA", GNB: "GW", NIG: "NE", CTA: "CF", CPV: "CV", MTN: "MR",
  ISR: "IL",
};

export function flagEmojiFromCode(code?: string | null): string {
  const raw = (code ?? "").trim().toUpperCase();
  if (!raw) return "🏳️";
  const iso2 = raw.length === 2 ? raw : FIFA_TO_ISO2[raw] ?? raw.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(iso2)) return "🏳️";
  return String.fromCodePoint(...[...iso2].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
