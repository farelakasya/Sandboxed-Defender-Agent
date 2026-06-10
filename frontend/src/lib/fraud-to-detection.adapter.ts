/**
 * Adapter: fraud-simulation turn → DetectionEvent.
 *
 * The in-app fraud simulation (rebuilt from project/Payment Fraud Simulation.html)
 * emits one of five fraud vectors per turn. This module translates each turn into
 * a canonical DetectionEvent so it flows through the SAME unified pipeline as
 * attack sims and Lambda findings — no isolated fraud ticket system.
 *
 * Pure + framework-free.
 */
import type {
  DetectionEvent,
  DetectionType,
} from "./detectionEvent.types";

/** The five fraud vectors from the original HTML. */
export type FraudVectorKey = "card" | "ato" | "chargeback" | "promo" | "bot";

/** Map the short HTML key to the pipeline's event_type slug + a domain hint. */
const VECTOR_META: Record<
  FraudVectorKey,
  { event_type: string; label: string; domain_hint: DetectionType; asset: string }
> = {
  card: {
    event_type: "card_cracking",
    label: "Card Cracking",
    domain_hint: "attack",
    asset: "Payment API",
  },
  ato: {
    event_type: "account_takeover",
    label: "Account Takeover",
    domain_hint: "fraud",
    asset: "Auth API",
  },
  chargeback: {
    event_type: "chargeback_fraud",
    label: "Chargeback Fraud",
    domain_hint: "fraud",
    asset: "Orders API",
  },
  promo: {
    event_type: "promo_abuse",
    label: "Promo Abuse",
    domain_hint: "fraud",
    asset: "Promotions API",
  },
  bot: {
    event_type: "bot_checkout",
    label: "Bot Checkout",
    domain_hint: "attack",
    asset: "Checkout API",
  },
};

export function fraudVectorLabel(key: FraudVectorKey): string {
  return VECTOR_META[key].label;
}

export const FRAUD_VECTOR_KEYS: FraudVectorKey[] = [
  "card",
  "ato",
  "chargeback",
  "promo",
  "bot",
];

/** Input describing one fraud-simulation turn. */
export interface FraudSimTurn {
  run_id: string;
  vector: FraudVectorKey;
  /** Target node/system label, e.g. "Checkout API". */
  target: string;
  /** Whether the defender blocked it (vs. partial breach). */
  outcome: "blocked" | "breached";
  /** Red-team (attacker) log line. */
  red_message: string;
  /** Blue-team (defender) log line. */
  blue_message: string;
  /** Synthesized, stable per-run so the pipeline dedups turns of one run. */
  source_ip: string;
  /** Optional synthesized device fingerprint (fraud-specific signal). */
  device_id?: string;
}

/**
 * normalizeFraudSimulationEventToDetectionEvent — build a DetectionEvent from a
 * fraud-simulation turn. The classifier then assigns the multi-label
 * (attack/fraud/anomaly) classification.
 */
export function normalizeFraudSimulationEventToDetectionEvent(
  turn: FraudSimTurn
): DetectionEvent {
  const meta = VECTOR_META[turn.vector];
  const ts = new Date().toISOString();

  return {
    event_id: `fraud-${turn.run_id}-${turn.vector}-${Date.now().toString(36)}`,
    created_at: ts,
    source: "fraud_simulation",
    mode: "simulation",
    event_type: meta.event_type,
    domain_hint: meta.domain_hint,
    actor: {
      actor_name: "Simulated fraud actor",
      source_ip: turn.source_ip,
      device_id: turn.device_id,
      user_agent: "fraud-sim/1.0",
    },
    target: {
      asset: meta.asset,
      resource: turn.target,
      endpoint: turn.target,
      method: "POST",
    },
    evidence: [
      {
        timestamp: ts,
        type: "transaction",
        summary: stripTags(turn.red_message),
      },
      {
        timestamp: ts,
        type: "observation",
        summary: `Defender: ${stripTags(turn.blue_message)} (${turn.outcome}).`,
      },
    ],
    raw: { turn },
  };
}

/** Strip simple HTML tags the simulator wraps around log messages. */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}
