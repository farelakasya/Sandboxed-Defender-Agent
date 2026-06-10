/**
 * Fraud simulation engine — ported from the standalone
 * project/Payment Fraud Simulation.html (left untouched).
 *
 * Mirrors the structure of simulation.engine.ts: five vectors, RED (attacker)
 * and BLUE (defender) message banks, ~72% block rate, deterministic per-run
 * source IP / device fingerprint. Emits FraudSimTurn objects that the adapter
 * turns into DetectionEvents.
 */
import type { FraudVectorKey } from "./fraud-to-detection.adapter";
import { FRAUD_VECTOR_KEYS, fraudVectorLabel } from "./fraud-to-detection.adapter";

export { FRAUD_VECTOR_KEYS, fraudVectorLabel };
export type { FraudVectorKey };

/** OWASP mapping per vector (from the original HTML). */
export const FRAUD_OWASP: Record<
  FraudVectorKey,
  { id: string; sev: "HIGH" | "MEDIUM" }
> = {
  card: { id: "A04", sev: "HIGH" },
  ato: { id: "A07", sev: "HIGH" },
  chargeback: { id: "A06", sev: "HIGH" },
  promo: { id: "A01", sev: "MEDIUM" },
  bot: { id: "A02", sev: "HIGH" },
};

/** Target systems the fraud sim can hit (from the original HTML). */
export const FRAUD_TARGETS = [
  "Checkout API",
  "Payment Gateway",
  "Auth Service",
  "Promo Engine",
  "Orders API",
];

/** Red-team (attacker) scenario lines — mirrors the HTML's RED bank. */
const RED: Record<FraudVectorKey, string[]> = {
  card: [
    "Loading BIN list for Visa 4532-xxxx series — submitting $0.01 micro-charges to validate stolen cards",
    "200 micro-transactions fired on /api/payment in 90s — 14 valid cards confirmed at 7% hit rate",
    "Rotating residential proxy pool (47 IPs, 3/min) to evade velocity limits at payment gateway",
    "Carding bot bypassed basic CAPTCHA — using 2captcha API ($0.001/solve) at 1,200 solves/min",
    "Escalating: 14 confirmed cards queued for $340-avg orders before cardholders notice the test charge",
  ],
  ato: [
    "Credential stuffing: loading 2.4M combo list from Collection #1 data breach against /api/auth/login",
    "Distributing load across 340 residential proxies to evade per-IP rate limiting on auth endpoint",
    "Valid credential hit on user #44821 — initiating silent session hijack via forged cookie",
    "Low-and-slow ATO: 1 attempt per account per 3h to stay below anomaly detection threshold",
    "OAuth token stolen from phishing campaign — replaying across mobile and web sessions",
  ],
  chargeback: [
    "Placing 12 high-value orders ($450–$900 ea.) on stolen card before cardholder reports fraud to issuer",
    "Friendly fraud: ordering $1,200 electronics, then filing 'item not received' dispute with Visa",
    "Coordinated chargeback ring: 8 mule accounts ordering and disputing within overlapping 72h window",
    "Routing through fresh VPN endpoint + new device to hide repeat chargeback pattern across merchants",
    "Digital goods chargeback: claiming non-delivery on 6 fulfilled gift card orders — no physical proof",
  ],
  promo: [
    "Creating 38 disposable +alias accounts (user+1@, user+2@...) to claim $20 new-user bonus each",
    "Promo stacking exploit: combining stackable codes for effective 100% discount on $340 checkout",
    "Multi-accounting: 15 accounts created from same device fingerprint to farm $15 referral bonuses",
    "Automated code scraper testing 500+ coupon codes at 50 req/sec — harvesting active promo codes",
    "Android emulator farm (12 VMs) claiming mobile-exclusive first-order discounts across fake profiles",
  ],
  bot: [
    "Sneaker bot deployed: 4,500 checkout attempts in 8 min on limited-edition Nike Air Max drop",
    "Inventory denial attack: bots holding 200 cart slots simultaneously, blocking real shoppers",
    "Headless Chrome farm executing full JS checkout flow to bypass basic script-detection filters",
    "Rotating user-agent strings + spoofing WebGL/Canvas fingerprint across 80 browser profiles",
    "AI-driven CAPTCHA solving service processing 1,200 challenges/min at 97% success rate",
  ],
};

/** Blue-team (defender) response lines — mirrors the HTML's BLUE bank. */
const BLUE: Record<FraudVectorKey, string[]> = {
  card: [
    "Velocity rule fired: 50+ payment attempts from VisitorID fp_8a2c91d in 10 min — gateway blocked",
    "Micro-transaction pattern detected — ML fraud model flagged 200 sub-$1 charges: risk score 96/100",
    "Proxy detection: 41/47 IPs identified as residential-proxy origin — CAPTCHA challenge injected",
    "CAPTCHA farm identified via request-timing signature (0.8s avg solve) — IP range banned",
    "Device fingerprint linked all 14 validated cards to single VisitorID — issuers notified, cards frozen",
  ],
  ato: [
    "Credential stuffing detected: 2,400 failed logins from 340 IPs in 15 min — IP cluster blocked",
    "Device fingerprint fp_3d7a1bc matched across 14 failed account attempts — cluster suspended",
    "Session anomaly: account #44821 login from RO after 18-month US history — MFA challenge issued",
    "Slow-ATO surfaced by ML time-series model — step-up authentication triggered across affected segment",
    "OAuth token replay blocked: token revoked, account locked, owner notified via push notification",
  ],
  chargeback: [
    "High-value order cluster flagged: $6,800 from single VisitorID in 4h — held for manual review",
    "Compelling evidence package built: device ID, IP, geolocation, delivery timestamp — submitted to Visa",
    "Chargeback ring identified via shared-device graph analysis — 8 linked accounts suspended",
    "VPN + new device combo: risk score 88/100 — 3D Secure authentication required before fulfilment",
    "Server-side delivery logs + device fingerprint submitted as dispute evidence — 6/6 chargebacks won",
  ],
  promo: [
    "Email alias clustering: 38 accounts share same canonical address — all promo credits frozen",
    "Promo stacking blocked — server-side rule: max 1 stackable code per VisitorID per campaign",
    "Multi-accounting alert: fp_5c8e44a linked to 15 new signups within 48h — all accounts suspended",
    "Bot traffic on /api/promo detected — Turnstile challenge deployed; 94% of requests fail bot check",
    "Android emulator signal detected on 7/12 devices — mobile-exclusive discount claims rejected",
  ],
  bot: [
    "Bot detected: 4,500 req in 8 min, headless browser signal positive — IP block + CAPTCHA wall",
    "Inventory abuse: cart-hold timeout reduced to 5 min + VisitorID required for each reservation",
    "Behavioural biometrics: inhuman mouse trajectories detected — CAPTCHA served to all flagged agents",
    "TLS fingerprint mismatch detected across 80 browser profiles — sessions terminated",
    "CAPTCHA-farm timing pattern identified — switched to audio challenge; bot solve rate drops to 12%",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function newFraudRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Deterministic source IP per run, so dedup groups all turns of one run. */
export function fraudSourceIpForRun(runId: string): string {
  let hash = 0;
  for (let i = 0; i < runId.length; i++) {
    hash = (hash * 31 + runId.charCodeAt(i)) & 0xffff;
  }
  const a = 1 + (hash % 254);
  return `203.0.113.${a}`;
}

/** Deterministic device fingerprint per run (fraud-specific signal). */
export function fraudDeviceForRun(runId: string): string {
  return `fp_${runId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`;
}

export interface FraudTurnResult {
  vector: FraudVectorKey;
  target: string;
  outcome: "blocked" | "breached";
  red_message: string;
  blue_message: string;
}

/**
 * Resolve one fraud attacker/defender turn. ~72% blocked, matching the HTML.
 */
export function runFraudTurn(
  vector: FraudVectorKey,
  targets: string[]
): FraudTurnResult {
  const target = targets.length ? pick(targets) : "Checkout API";
  const outcome: FraudTurnResult["outcome"] =
    Math.random() < 0.72 ? "blocked" : "breached";
  return {
    vector,
    target,
    outcome,
    red_message: pick(RED[vector]),
    blue_message: pick(BLUE[vector]),
  };
}
