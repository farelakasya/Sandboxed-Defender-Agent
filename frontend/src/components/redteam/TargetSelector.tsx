"use client";

import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Target endpoint selector for the Bedrock red-team setup. Lists the safe dummy
 * /api/sim-target/* endpoints the attacker agent can hit. Selection is the
 * endpoint path string.
 */

export const SIM_TARGET_ENDPOINTS: { endpoint: string; label: string }[] = [
  { endpoint: "/api/sim-target/login", label: "Login" },
  { endpoint: "/api/sim-target/leads", label: "Leads" },
  { endpoint: "/api/sim-target/clients/123", label: "Client record" },
  { endpoint: "/api/sim-target/reports/export", label: "Report export" },
  {
    endpoint: "/api/sim-target/admin/reset-user-data",
    label: "Admin: reset data",
  },
  { endpoint: "/api/sim-target/admin/users", label: "Admin: users" },
  { endpoint: "/api/sim-target/admin/config", label: "Admin: config" },
];

interface Props {
  selectedEndpoint: string | null;
  onSelect: (endpoint: string) => void;
}

export function TargetSelector({ selectedEndpoint, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SIM_TARGET_ENDPOINTS.map((t) => {
        const selected = t.endpoint === selectedEndpoint;
        return (
          <button
            key={t.endpoint}
            type="button"
            onClick={() => onSelect(t.endpoint)}
            aria-pressed={selected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              selected
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Crosshair className="size-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
