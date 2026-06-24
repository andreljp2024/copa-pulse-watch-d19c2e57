// Map FIFA 3-letter codes (stored in teams.code) to ISO 3166-1 alpha-2
// used by flagcdn.com to render real country flags.
const FIFA_TO_ISO2: Record<string, string> = {
  ALG: "dz", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba", BRA: "br",
  CAN: "ca", CIV: "ci", COD: "cd", COL: "co", CPV: "cv", CRO: "hr", CUW: "cw",
  CZE: "cz", ECU: "ec", EGY: "eg", ENG: "gb-eng", ESP: "es", FRA: "fr",
  GER: "de", GHA: "gh", HAI: "ht", IRN: "ir", IRQ: "iq", JOR: "jo", JPN: "jp",
  KOR: "kr", KSA: "sa", MAR: "ma", MEX: "mx", NED: "nl", NOR: "no", NZL: "nz",
  PAN: "pa", PAR: "py", POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct",
  SEN: "sn", SUI: "ch", SWE: "se", TUN: "tn", TUR: "tr", URU: "uy", URY: "uy",
  USA: "us", UZB: "uz", WAL: "gb-wls", NIR: "gb-nir", IRL: "ie", ITA: "it",
  POL: "pl", DEN: "dk", SRB: "rs", UKR: "ua", RUS: "ru", HUN: "hu", GRE: "gr",
  ROU: "ro", SVK: "sk", SVN: "si", ISL: "is", FIN: "fi", CHN: "cn", PRK: "kp",
  THA: "th", VIE: "vn", IND: "in", PHI: "ph", IDN: "id", MAS: "my", SGP: "sg",
  CMR: "cm", NGA: "ng", ALB: "al", ARM: "am", AZE: "az", BLR: "by", GEO: "ge",
  KAZ: "kz", LUX: "lu", MDA: "md", MKD: "mk", MLT: "mt", MNE: "me", BUL: "bg",
  CRC: "cr", HON: "hn", JAM: "jm", SLV: "sv", GUA: "gt", TRI: "tt", VEN: "ve",
  BOL: "bo", CHI: "cl", PER: "pe", ANG: "ao", BFA: "bf", ZAM: "zm", ZIM: "zw",
  KEN: "ke", UGA: "ug", TAN: "tz", GAB: "ga", MLI: "ml", MTN: "mr", SDN: "sd",
  GUI: "gn", SLE: "sl", TOG: "tg", BEN: "bj", NIG: "ne", LBY: "ly", SYR: "sy",
  LBN: "lb", PLE: "ps", BHR: "bh", OMA: "om", KUW: "kw", YEM: "ye", AFG: "af",
  PAK: "pk", BAN: "bd", SRI: "lk", NEP: "np",
};

export function flagUrl(code?: string | null, fallback?: string | null): string | null {
  if (!code) return fallback ?? null;
  const iso = FIFA_TO_ISO2[code.toUpperCase()];
  if (!iso) return fallback ?? null;
  return `https://flagcdn.com/w160/${iso}.png`;
}
