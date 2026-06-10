"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, UserX, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getAttackers } from "@/lib/attackers.service";
import type { AttackerPersona } from "@/lib/attacker.types";
import { humanizeAttackType } from "@/lib/ticket.utils";

/**
 * Attacker persona selector for the Bedrock red-team setup.
 *
 * Loads personas from getAttackers() (API-backed, mock fallback). Selection is
 * tracked by attacker.id and surfaced to the parent — never by display name.
 * Handles loading / error / empty states so the page never crashes.
 */

interface Props {
  selectedId: string | null;
  onSelect: (attacker: AttackerPersona) => void;
}

type LoadState = "loading" | "ready" | "error";

const CATEGORY_LABEL: Record<NonNullable<AttackerPersona["category"]>, string> = {
  external: "External",
  internal: "Internal",
  stale_account: "Stale Account",
  bot: "Bot",
  unknown: "Unknown",
};

export function AttackerSelector({ selectedId, onSelect }: Props) {
  const [attackers, setAttackers] = useState<AttackerPersona[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  /** Tracks whether getAttackers fell back to mocks (best-effort). */
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let active = true;
    setState("loading");
    getAttackers()
      .then((list) => {
        if (!active) return;
        setAttackers(list);
        setState("ready");
      })
      .catch(() => {
        // getAttackers already swallows errors, but guard anyway.
        if (!active) return;
        setUsedFallback(true);
        setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading attacker profiles…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        <AlertTriangle className="size-4" />
        Couldn’t reach the attacker API. {usedFallback ? "Showing built-in profiles." : "Try again shortly."}
      </div>
    );
  }

  if (attackers.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
        <UserX className="size-4" />
        No attacker profiles available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attackers.map((a) => {
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-red-500/40 bg-red-500/10"
                : "border-border bg-background/40 hover:border-red-500/30"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldQuestion
                  className={cn(
                    "size-4 shrink-0",
                    selected ? "text-red-400" : "text-muted-foreground"
                  )}
                />
                {a.display_name}
              </span>
              {a.category && (
                <Badge variant="outline" className="shrink-0">
                  {CATEGORY_LABEL[a.category]}
                </Badge>
              )}
            </div>

            {a.description && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {a.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {a.skill_level && (
                <Badge variant="muted">skill: {a.skill_level}</Badge>
              )}
              {a.risk_appetite && (
                <Badge variant="muted">risk: {a.risk_appetite}</Badge>
              )}
            </div>

            {a.supported_attack_types && a.supported_attack_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {a.supported_attack_types.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {humanizeAttackType(t)}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
