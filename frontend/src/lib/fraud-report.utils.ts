/**
 * Derived OWASP report data for the Fraud Simulation page.
 *
 * Ports the openReport() logic from the standalone HTML: every count is derived
 * from live simulation state (per-vector attack/block/breach tallies), never
 * hardcoded. Pure + framework-free so it's trivially testable.
 */
import type { FraudVectorKey } from "./fraud-to-detection.adapter";

/** Per-vector tally: attacks / blocked / breached. */
export interface VecTally {
  atk: number;
  blk: number;
  brch: number;
}

export type PerVec = Record<FraudVectorKey, VecTally>;

export function emptyPerVec(): PerVec {
  return {
    card: { atk: 0, blk: 0, brch: 0 },
    ato: { atk: 0, blk: 0, brch: 0 },
    chargeback: { atk: 0, blk: 0, brch: 0 },
    promo: { atk: 0, blk: 0, brch: 0 },
    bot: { atk: 0, blk: 0, brch: 0 },
  };
}

export const ATK_NAMES: Record<FraudVectorKey, string> = {
  card: "Card Cracking",
  ato: "Account Takeover",
  chargeback: "Chargeback Fraud",
  promo: "Promo Abuse",
  bot: "Bot Checkout",
};

export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  bestPractice: number;
  information: number;
  total: number;
}

export type OwaspSeverity = "HIGH" | "MED";

export interface OwaspCategoryRow {
  id: string;
  vulnerability: string;
  detail: string;
  severity: OwaspSeverity;
  probes: number;
  breached: number;
}

export interface OwaspReport {
  /** No simulation has run yet. */
  notRun: boolean;
  /** "Card Cracking · Account Takeover · …" or a placeholder. */
  activeVectors: string;
  totals: {
    identified: number;
    confirmed: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    blocked: number;
    breached: number;
    probes: number;
  };
  identified: SeverityBreakdown;
  confirmed: SeverityBreakdown;
  categories: OwaspCategoryRow[];
}

/** HIGH-severity vectors map to A07/A04; MEDIUM maps to A01 (mirrors the HTML). */
const HIGH_VECS: FraudVectorKey[] = ["card", "ato", "chargeback", "bot"];
const MED_VECS: FraudVectorKey[] = ["promo"];

function sum(perVec: PerVec, keys: FraudVectorKey[], field: keyof VecTally) {
  return keys.reduce((s, k) => s + perVec[k][field], 0);
}

/**
 * calculateOwaspReport — derive the full report from per-vector state plus the
 * aggregate attack/block/breach counts. Matches the original HTML exactly.
 */
export function calculateOwaspReport(
  perVec: PerVec,
  aggregates: { attacks: number; blocked: number; breaches: number }
): OwaspReport {
  const { attacks, blocked, breaches } = aggregates;
  const notRun = attacks === 0;

  // Identified (probes): HIGH/MED by vector; "Low" = blocked probes (mitigated).
  const idHigh = sum(perVec, HIGH_VECS, "atk");
  const idMed = sum(perVec, MED_VECS, "atk");
  const idLow = blocked;

  // Confirmed (breaches): HIGH/MED by vector.
  const cfHigh = sum(perVec, HIGH_VECS, "brch");
  const cfMed = sum(perVec, MED_VECS, "brch");

  const identified: SeverityBreakdown = {
    critical: 0,
    high: idHigh,
    medium: idMed,
    low: idLow,
    bestPractice: 0,
    information: 0,
    total: attacks,
  };

  const confirmed: SeverityBreakdown = {
    critical: 0,
    high: cfHigh,
    medium: cfMed,
    low: 0,
    bestPractice: 0,
    information: 0,
    total: breaches,
  };

  const activeVectors =
    (Object.keys(perVec) as FraudVectorKey[])
      .filter((k) => perVec[k].atk > 0)
      .map((k) => ATK_NAMES[k])
      .join(" · ") || "No vectors run yet";

  // OWASP 2025 category rows — per-category probe + breach tallies (from HTML).
  const categories: OwaspCategoryRow[] = [
    {
      id: "A01",
      vulnerability: "Broken Access Control",
      detail:
        "Promo API accepts stacked codes without per-device session binding; multi-accounting via email aliases bypasses new-user restrictions",
      severity: "MED",
      probes: perVec.promo.atk,
      breached: perVec.promo.brch,
    },
    {
      id: "A02",
      vulnerability: "Security Misconfiguration",
      detail:
        "Missing rate-limit headers on /api/checkout; CORS wildcard on payment endpoint; bot traffic unrestricted due to missing WAF rules",
      severity: "HIGH",
      probes: perVec.bot.atk,
      breached: perVec.bot.brch,
    },
    {
      id: "A03",
      vulnerability: "Software Supply Chain Failures",
      detail:
        "Payment SDK v2.1 (EOL) — CVE-2022-39220; CAPTCHA library 3 major versions behind; no SRI hashes on third-party checkout scripts",
      severity: "MED",
      probes: attacks > 0 ? 1 : 0,
      breached: 0,
    },
    {
      id: "A04",
      vulnerability: "Cryptographic Failures",
      detail:
        "Partial PAN visible in error log output during card cracking probe; card data present in plaintext debug trace; TLS 1.1 still accepted on legacy gateway",
      severity: "HIGH",
      probes: perVec.card.atk,
      breached: perVec.card.brch,
    },
    {
      id: "A05",
      vulnerability: "Injection",
      detail:
        "Payment reference and promo code fields lack input sanitisation; NoSQL injection possible via $where on order lookup endpoint",
      severity: "HIGH",
      probes: attacks > 0 ? 1 : 0,
      breached: 0,
    },
    {
      id: "A06",
      vulnerability: "Insecure Design",
      detail:
        "No 3DS enforcement on high-value orders; no chargeback evidence collection pipeline; cart hold has no per-device limit enabling inventory denial",
      severity: "HIGH",
      probes: perVec.chargeback.atk,
      breached: perVec.chargeback.brch,
    },
    {
      id: "A07",
      vulnerability: "Authentication Failures",
      detail:
        "No rate limiting on /api/auth/login enabling credential stuffing; payment sessions not bound to device fingerprint enabling ATO and session replay",
      severity: "HIGH",
      probes: perVec.ato.atk,
      breached: perVec.ato.brch,
    },
    {
      id: "A08",
      vulnerability: "Software or Data Integrity Failures",
      detail:
        "Client-submitted cart totals accepted without server-side revalidation; unsigned webhooks processed; discount rates not re-verified on checkout submission",
      severity: "MED",
      probes: breaches > 0 ? 1 : 0,
      breached: 0,
    },
    {
      id: "A09",
      vulnerability: "Security Logging and Alerting Failures",
      detail:
        "No velocity alert when card attempts exceed 10/device/hour; incomplete chargeback audit trail; failed logins not aggregated for real-time pattern detection",
      severity: "MED",
      probes: attacks > 0 ? 1 : 0,
      breached: breaches,
    },
    {
      id: "A10",
      vulnerability: "Mishandling of Exceptional Conditions",
      detail:
        "Payment error responses expose raw card data and stack traces; no exponential backoff on payment retries enabling retry-loop abuse",
      severity: "MED",
      probes: breaches > 0 ? breaches : 0,
      breached: breaches,
    },
  ];

  return {
    notRun,
    activeVectors,
    totals: {
      identified: attacks,
      confirmed: breaches,
      critical: 0,
      high: idHigh,
      medium: idMed,
      low: idLow,
      blocked,
      breached: breaches,
      probes: attacks,
    },
    identified,
    confirmed,
    categories,
  };
}
