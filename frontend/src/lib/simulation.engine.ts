import {
  SimulationAttackKey,
  SimulationIncidentEvent,
  SimulationOutcome,
} from "./simulation.types";

/**
 * Pure simulation engine, ported from the teammate's standalone red/blue HTML
 * (project/uploads/red_blue_sim_website.html). The original file is left
 * untouched; this is an in-app reimplementation of the same logic that emits
 * structured SimulationIncidentEvent objects instead of painting DOM.
 */

export const ATTACK_LABELS: Record<SimulationAttackKey, string> = {
  recon: "Network recon",
  dns: "DNS spoofing",
  mail: "SMTP relay",
  fw: "Firewall bypass",
  web: "Web exploit",
};

export const ATTACK_KEYS: SimulationAttackKey[] = [
  "recon",
  "dns",
  "mail",
  "fw",
  "web",
];

export const TARGET_NODES = ["R1", "R3", "R2", "localweb", "mailgw"];

/** Red-team (attacker) scenario lines — mirrors the HTML's redScenarios. */
const RED_SCENARIOS: Record<SimulationAttackKey, string[]> = {
  recon: [
    "Traceroute to talos.edu reveals R1→R3→R2 backbone topology",
    "Port scan enumerates open services on the edge router",
    "OS fingerprinting via crafted TCP/IP probes",
    "Banner grabbing on exposed management ports",
    "Mapping internal subnets through TTL analysis",
  ],
  dns: [
    "Spoofed DNS responses injected into resolver cache",
    "Forged NXDOMAIN replies to hijack lookups",
    "DNS cache poisoning targeting the mail record",
    "Rogue resolver advertised via DHCP option",
    "Subdomain takeover probe on stale CNAME",
  ],
  mail: [
    "Open relay test on SMTP gateway",
    "Spoofed envelope-from to bypass SPF",
    "Mass relay attempt through mailgw",
    "Credential spray against SMTP AUTH",
    "Header injection in crafted message",
  ],
  fw: [
    "Crafted fragments to bypass stateless rules",
    "Source-port spoofing to slip past R3 ACLs",
    "Tunneling C2 over allowed DNS/443",
    "Port knocking attempt with brute sequence",
    "IPv6 path probing around IPv4 filters",
  ],
  web: [
    "SQL injection probe on localweb HTTP server — testing login form",
    "Brute-forcing /admin endpoint — 100 attempts/min with common passwords",
    "Path traversal attempt on file download handler",
    "Reflected XSS probe in search parameter",
    "Auth bypass via tampered JWT on /admin",
  ],
};

/** Blue-team (defender) response lines — mirrors the HTML's blueResponses. */
const BLUE_RESPONSES: Record<SimulationAttackKey, string[]> = {
  recon: [
    "Topology obfuscation active — selective ICMP TTL manipulation enabled",
    "Scan signature detected — source throttled",
    "Decoy services injected to poison the map",
    "Edge ACL updated to drop probe traffic",
    "Recon alert raised to SOC",
  ],
  dns: [
    "Resolver responses validated — spoofed replies dropped",
    "DNSSEC validation rejected forged record",
    "Cache flushed and locked to trusted upstreams",
    "Rogue resolver isolated on the segment",
    "DNS anomaly alert sent to admin",
  ],
  mail: [
    "Relay denied — authenticated submission enforced",
    "SPF/DKIM failure quarantined the message",
    "SMTP AUTH brute-force throttled and logged",
    "Sender reputation block applied",
    "Mail gateway alert escalated to admin",
  ],
  fw: [
    "Port knocking sequence logged — invalid sequence flagged, IP blocked",
    "IPv6 disabled on unused interfaces — dual-stack attack surface reduced",
    "Fragmented packets reassembled and dropped",
    "Stateful inspection blocked the spoofed flow",
    "Edge firewall rule tightened to deny-by-default",
  ],
  web: [
    "WAF rule fired: SQL injection pattern blocked — attacker IP banned",
    "Login brute-force throttled — account lockout engaged",
    "Path traversal payload sanitized and rejected",
    "XSS payload neutralized by output encoding",
    "Tampered JWT rejected — session invalidated",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let eventCounter = 0;

/**
 * Synthesize a deterministic source IP per run. Same run_id → same IP, so the
 * adapter's dedup key groups all turns of one run together.
 */
export function sourceIpForRun(runId: string): string {
  let hash = 0;
  for (let i = 0; i < runId.length; i++) {
    hash = (hash * 31 + runId.charCodeAt(i)) & 0xffff;
  }
  const a = 1 + (hash % 254);
  const b = 1 + ((hash >> 8) % 254);
  return `198.51.100.${a === b ? (a % 254) + 1 : a}`;
}

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Resolve one attacker/defender turn into a structured event.
 * Outcome: ~72% blocked, ~28% breached — matching the original HTML.
 */
export function runAgentTurn(
  runId: string,
  attackKey: SimulationAttackKey,
  targets: string[]
): SimulationIncidentEvent {
  const target = targets.length ? pick(targets) : "R1";
  const outcome: SimulationOutcome = Math.random() < 0.72 ? "blocked" : "breached";
  eventCounter += 1;

  return {
    run_id: runId,
    event_id: `${runId}-${eventCounter}`,
    timestamp: new Date().toISOString(),
    attack_key: attackKey,
    attack_label: ATTACK_LABELS[attackKey],
    target_node: target,
    red_message: pick(RED_SCENARIOS[attackKey]),
    blue_message: pick(BLUE_RESPONSES[attackKey]),
    outcome,
    source_ip: sourceIpForRun(runId),
  };
}
