"use client";

import { useState } from "react";
import { Swords, Play, Loader2, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AttackerSelector } from "./AttackerSelector";
import { TargetSelector } from "./TargetSelector";
import type { AttackerPersona } from "@/lib/attacker.types";
import {
  buildSimulationLaunchPayload,
  canLaunchSimulation,
  LAUNCH_HELPER_TEXT,
  type SimulationTarget,
} from "@/lib/simulation-launch.adapter";

/**
 * Bedrock red-team setup card.
 *
 * Lets a user pick a target endpoint + an API-loaded attacker persona, then
 * "launches" a controlled, SIMULATED attack. For the local hackathon MVP the
 * launch fires the selected dummy /api/sim-target/* endpoint directly — that
 * route classifies + stores a red-team event, which the RedTeamEventSync bridge
 * imports into the ticket store. When the collaborator's Bedrock launcher is
 * ready, swap the fetch below for POST /api/redteam/launch (payload already
 * built via buildSimulationLaunchPayload).
 */
export function BedrockSetupCard() {
  const { toast } = useToast();
  const [attacker, setAttacker] = useState<AttackerPersona | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // attackers load inside AttackerSelector; treat "no selection yet" as the
  // gating signal rather than threading a loading flag up.
  const canLaunch = canLaunchSimulation({
    hasTarget: !!endpoint,
    hasAttacker: !!attacker,
    attackersLoading: false,
  });

  async function launch() {
    if (!attacker || !endpoint) return;
    setLaunching(true);

    // Build the canonical launch payload (the shape Bedrock will receive).
    const target: SimulationTarget = {
      base_url:
        typeof window !== "undefined" ? window.location.origin : "",
      environment: "demo",
      selected_endpoint: endpoint,
    };
    const payload = buildSimulationLaunchPayload(target, attacker);
    // TODO(api): POST /api/redteam/launch with `payload` to start a Bedrock run.
    // Until then, fire the dummy target directly so the pipeline is live.
    void payload;

    try {
      const res = await fetch(endpoint, {
        method: endpoint.includes("/login") ||
          endpoint.includes("/reset-user-data") ||
          endpoint.endsWith("/leads")
          ? "POST"
          : "GET",
        headers: {
          "Content-Type": "application/json",
          "x-sim-persona": attacker.name,
          "x-sim-actor-type": attacker.category ?? "external",
        },
        body: JSON.stringify({
          run_id: `RUN-${Date.now().toString(36)}`,
          attacker: { persona_name: attacker.name },
        }),
      });
      const data = await res.json();
      toast({
        variant: "alert",
        title: "Simulated attack launched",
        description: `${attacker.display_name} → ${endpoint} (HTTP ${data.status_code ?? res.status}). Ticket syncing…`,
      });
    } catch {
      toast({
        variant: "alert",
        title: "Launch failed",
        description: "Could not reach the simulated target endpoint.",
      });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Bot className="size-4 text-primary" />
          Bedrock Red-Team Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Target endpoint
          </p>
          <TargetSelector
            selectedEndpoint={endpoint}
            onSelect={setEndpoint}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attacker profile
          </p>
          <AttackerSelector
            selectedId={attacker?.id ?? null}
            onSelect={setAttacker}
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={launch} disabled={!canLaunch || launching}>
            {launching ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
            Launch red-team simulation
          </Button>
          {!canLaunch && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Swords className="size-3.5" />
              {LAUNCH_HELPER_TEXT}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
