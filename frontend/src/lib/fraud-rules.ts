/**
 * Fraud detection rules — defaults + localStorage persistence.
 *
 * Ported from the standalone Fraud Simulation HTML. Same localStorage key
 * (`fraudsim_rules_v2`) and same default 10-rule set, so the rebuilt editor is
 * persistence-compatible with the original page.
 *
 * TODO(unified): active rules currently shape simulation classification only via
 * the existing detection-pipeline RULES. A future step can let edited rules here
 * influence classification/risk scoring or export to a real fraud engine.
 */

export interface FraudRule {
  id: string;
  title: string;
  enabled: boolean;
  body: string;
}

export const FRAUD_RULES_LS_KEY = "fraudsim_rules_v2";

export const DEFAULT_FRAUD_RULES: FraudRule[] = [
  {
    id: "rule-a01",
    title: "A01 · Broken Access Control — Promo & Multi-Accounting",
    enabled: true,
    body: `# Promo API lacks per-device session binding (OWASP 2025 A01)
IF  promo.device_redemptions >= 1
 OR email.canonical IN device.known_email_set
 OR device.account_age_hours < 24
THEN reject_promo, log_event(type="broken_access_control")`,
  },
  {
    id: "rule-a02",
    title: "A02 · Security Misconfiguration — Bot Checkout",
    enabled: true,
    body: `# Misconfigured rate limits allow bot checkout abuse (OWASP 2025 A02)
IF  device.request_rate_per_min > 60
 OR endpoint.rate_limit_header == null
 OR device.headless_signal == true
THEN block_checkout, serve_captcha_challenge, alert_devops(severity="HIGH")`,
  },
  {
    id: "rule-a03",
    title: "A03 · Software Supply Chain Failures — SDK Integrity",
    enabled: true,
    body: `# Outdated / unverified payment SDK (OWASP 2025 A03)
IF  dependency.payment_sdk_version < "3.0.0"
 OR dependency.integrity_hash_verified == false
 OR csp.subresource_integrity_missing == true
THEN block_checkout_load, alert_security_team(cve="CVE-2022-39220")`,
  },
  {
    id: "rule-a04",
    title: "A04 · Cryptographic Failures — Card Cracking / PAN Exposure",
    enabled: true,
    body: `# PAN or CVV exposed in logs or error responses (OWASP 2025 A04)
IF  log.contains_pan == true
 OR response.body MATCHES "[0-9]{13,19}"
 OR tls.version < 1.2
THEN sanitize_log, block_response, alert_pci_team

# Micro-charge BIN-list card cracking
IF  payment.amount < 1.00
AND device.payment_attempts_10min > 5
AND device.distinct_bins_24h > 2
THEN block_payment, flag_device(reason="card_cracking")`,
  },
  {
    id: "rule-a05",
    title: "A05 · Injection — Payment API Input Validation",
    enabled: true,
    body: `# SQL/NoSQL injection in payment and promo fields (OWASP 2025 A05)
IF  input.payment_ref MATCHES "[\"';--]"
 OR input.promo_code MATCHES "\\$where|\\$gt|\\$ne"
 OR input.order_id MATCHES "[^a-zA-Z0-9\\-_]"
THEN reject_input, log_event(type="injection_attempt", severity="HIGH")`,
  },
  {
    id: "rule-a06",
    title: "A06 · Insecure Design — Chargeback Fraud",
    enabled: true,
    body: `# High-value order without 3DS or evidence collection (OWASP 2025 A06)
IF  order.total > 300
AND payment.three_ds_completed == false
THEN require_3ds, hold_for_review(hours=24)

# Repeat chargeback account pattern
IF  account.chargebacks_90d > 1
 OR account.dispute_rate > 0.02
THEN block_future_orders, build_evidence_package, flag_for_review`,
  },
  {
    id: "rule-a07",
    title: "A07 · Authentication Failures — Account Takeover",
    enabled: true,
    body: `# Credential stuffing / slow ATO (OWASP 2025 A07)
IF  auth.failed_attempts_15min > 5
AND (device.is_new == true OR geo.country_changed == true)
THEN require_mfa, log_event(severity="HIGH")

# Session hijack / token replay
IF  session.visitor_id != token.issued_visitor_id
THEN revoke_token, lock_account, notify_user_push`,
  },
  {
    id: "rule-a08",
    title: "A08 · Software or Data Integrity Failures — Cart Tampering",
    enabled: true,
    body: `# Client-side cart price tampering (OWASP 2025 A08)
IF  cart.server_price != cart.client_submitted_price
 OR webhook.signature_valid == false
 OR order.discount_rate > 0.5 AND promo.server_verified == false
THEN reject_order, alert_fraud_team(type="integrity_violation")`,
  },
  {
    id: "rule-a09",
    title: "A09 · Security Logging and Alerting Failures — Velocity Gaps",
    enabled: true,
    body: `# Missing fraud velocity alerts (OWASP 2025 A09)
IF  device.payment_attempts_1h > 10
AND alert.velocity_triggered == false
THEN force_alert(channel="pagerduty"), create_audit_entry(mandatory=true)

# Incomplete chargeback audit trail
IF  audit.chargeback_trail_complete == false
 OR log.failed_login_aggregated == false
THEN flag_audit_gap, notify_compliance_team`,
  },
  {
    id: "rule-a10",
    title: "A10 · Mishandling of Exceptional Conditions — Error Leakage",
    enabled: true,
    body: `# Error responses leaking card/PAN data (OWASP 2025 A10)
IF  error.response CONTAINS "card_number"
 OR error.response CONTAINS "cvv"
 OR error.stack_trace_exposed == true
THEN sanitize_error_response, log_event(type="data_leak")

# Retry logic abuse on payment failure
IF  retry.count > 3
AND retry.backoff_applied == false
THEN apply_backoff(multiplier=2), flag_device(reason="retry_abuse")`,
  },
];

/** Deep-clone the defaults so callers never mutate the shared array. */
export function cloneDefaultRules(): FraudRule[] {
  return DEFAULT_FRAUD_RULES.map((r) => ({ ...r }));
}

export function loadFraudRules(): FraudRule[] {
  if (typeof window === "undefined") return cloneDefaultRules();
  try {
    const raw = window.localStorage.getItem(FRAUD_RULES_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as FraudRule[];
    }
  } catch {
    // fall through to defaults
  }
  return cloneDefaultRules();
}

export function saveFraudRules(rules: FraudRule[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FRAUD_RULES_LS_KEY, JSON.stringify(rules));
  } catch {
    // ignore quota / serialization errors
  }
}

export function newRuleId(): string {
  return "rule-" + Math.random().toString(36).slice(2, 8);
}

/** Serialize enabled rules to the clipboard "copy all" format from the HTML. */
export function serializeEnabledRules(rules: FraudRule[]): string {
  return rules
    .filter((r) => r.enabled)
    .map((r) => `# === ${r.title} ===\n${r.body}`)
    .join("\n\n");
}
