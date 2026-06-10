import type { AttackerPersona } from "@/lib/attacker.types";

/**
 * Built-in attacker personas for the safe hackathon simulation.
 *
 * These back GET /api/redteam/attackers and the service-layer mock fallback.
 * They are dummy profiles — selecting one only shapes which simulated attack
 * the Bedrock agent (or the dummy target routes) will perform. No real actor,
 * no real credentials.
 */
export const MOCK_ATTACKERS: AttackerPersona[] = [
  {
    id: "external-admin-hunter",
    name: "External Admin Endpoint Hunter",
    display_name: "External Admin Endpoint Hunter",
    description: "External actor probing admin endpoints for weak authorization.",
    category: "external",
    skill_level: "medium",
    risk_appetite: "high",
    default_attack_type: "admin_endpoint_probing",
    supported_attack_types: [
      "admin_endpoint_probing",
      "network_recon",
      "web_exploit",
    ],
    tags: ["admin", "external", "recon"],
  },
  {
    id: "credential-stuffing-bot",
    name: "Credential Stuffing Bot",
    display_name: "Credential Stuffing Bot",
    description: "Automated bot replaying leaked credentials against login.",
    category: "bot",
    skill_level: "low",
    risk_appetite: "high",
    default_attack_type: "credential_stuffing",
    supported_attack_types: ["credential_stuffing", "web_exploit"],
    tags: ["login", "bot", "brute-force"],
  },
  {
    id: "malicious-insider-rm",
    name: "Malicious Insider RM",
    display_name: "Malicious Insider RM",
    description:
      "Internal relationship manager accessing client records beyond their book.",
    category: "internal",
    skill_level: "medium",
    risk_appetite: "medium",
    default_attack_type: "insider_data_access",
    supported_attack_types: ["insider_data_access", "report_export_abuse"],
    tags: ["insider", "client-data"],
  },
  {
    id: "report-export-abuser",
    name: "Report Export Abuser",
    display_name: "Report Export Abuser",
    description: "Actor abusing the report export endpoint to exfiltrate data.",
    category: "internal",
    skill_level: "medium",
    risk_appetite: "high",
    default_attack_type: "report_export_abuse",
    supported_attack_types: ["report_export_abuse", "insider_data_access"],
    tags: ["export", "exfiltration"],
  },
  {
    id: "stale-account-user",
    name: "Stale Account User",
    display_name: "Stale Account User",
    description:
      "Deactivated/offboarded account still holding valid access tokens.",
    category: "stale_account",
    skill_level: "low",
    risk_appetite: "medium",
    default_attack_type: "stale_account_abuse",
    supported_attack_types: ["stale_account_abuse", "insider_data_access"],
    tags: ["stale", "offboarding"],
  },
  {
    id: "network-recon-agent",
    name: "Network Recon Agent",
    display_name: "Network Recon Agent",
    description: "Scans network topology and enumerates exposed services.",
    category: "external",
    skill_level: "high",
    risk_appetite: "low",
    default_attack_type: "network_recon",
    supported_attack_types: ["network_recon", "dns_spoofing", "smtp_relay_abuse"],
    tags: ["recon", "scanning"],
  },
  {
    id: "web-exploit-operator",
    name: "Web Exploit Operator",
    display_name: "Web Exploit Operator",
    description: "Probes web app for injection, traversal and auth-bypass flaws.",
    category: "external",
    skill_level: "high",
    risk_appetite: "high",
    default_attack_type: "web_exploit",
    supported_attack_types: ["web_exploit", "admin_endpoint_probing"],
    tags: ["web", "exploit", "injection"],
  },
  {
    id: "firewall-bypass-tester",
    name: "Firewall Bypass Tester",
    display_name: "Firewall Bypass Tester",
    description: "Tests perimeter controls with crafted/fragmented traffic.",
    category: "external",
    skill_level: "high",
    risk_appetite: "medium",
    default_attack_type: "firewall_bypass",
    supported_attack_types: ["firewall_bypass", "network_recon", "dns_spoofing"],
    tags: ["firewall", "perimeter", "evasion"],
  },
];
