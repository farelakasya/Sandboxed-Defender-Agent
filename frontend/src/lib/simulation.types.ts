/**
 * Types describing the output of the red/blue attacker/defender simulator.
 *
 * The original simulator (project/uploads/red_blue_sim_website.html) is plain
 * HTML and emits no structured data — it only paints DOM. The in-app Next
 * version (/simulations/red-blue) reuses the same logic and emits these typed
 * events so the ticketing system can consume them.
 *
 * TODO(api): when a backend simulator exists, these events should arrive from
 * POST /api/tickets/from-simulation (or a websocket) instead of being built
 * client-side.
 */

/** The five attack vectors the simulator supports. */
export type SimulationAttackKey = "recon" | "dns" | "mail" | "fw" | "web";

/** Outcome of a single attacker turn after the defender responds. */
export type SimulationOutcome = "blocked" | "breached";

/**
 * One meaningful attacker/defender turn. This is the canonical hand-off shape
 * between the simulator and the ticketing adapter.
 */
export interface SimulationIncidentEvent {
  /** One id per "Launch simulation" run; shared by all turns in that run. */
  run_id: string;
  /** Unique id per attack turn. */
  event_id: string;
  /** ISO timestamp of the turn. */
  timestamp: string;

  attack_key: SimulationAttackKey;
  /** Human label, e.g. "Web exploit". */
  attack_label: string;
  /** Targeted topology node, e.g. "R1" / "localweb". */
  target_node: string;

  /** Red-team (attacker) log line. */
  red_message: string;
  /** Blue-team (defender) log line. */
  blue_message: string;

  outcome: SimulationOutcome;

  /**
   * Synthesized per run (the simulator has no real source IP). Deterministic
   * for a given run_id so upsert grouping works across turns of the same run.
   */
  source_ip: string;
}
