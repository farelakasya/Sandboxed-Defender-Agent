import { Crosshair, Server, Bot, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "./Field";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatSource, humanizeAttackType } from "@/lib/ticket.utils";

export function AttackSummaryCard({ ticket }: { ticket: SecurityTicket }) {
  const confidencePct = Math.round(ticket.confidence * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Crosshair className="size-4 text-primary" />
          Attack Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Attack Type">{humanizeAttackType(ticket.attack_type)}</Field>
          <Field label="Threat Category">{ticket.threat_category}</Field>

          <Field label="Confidence Score">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              <span className="font-semibold">{confidencePct}%</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          </Field>
          <Field label="Affected Endpoint" mono>
            <span className="inline-flex items-center gap-1.5">
              <Server className="size-3.5 text-muted-foreground" />
              {ticket.affected_endpoint}
            </span>
          </Field>

          <Field label="Source">{formatSource(ticket.source)}</Field>
          <Field label="Source IP" mono>
            {ticket.source_ip ?? "Multiple IPs"}
          </Field>

          <Field label="User Agent" mono>
            {ticket.user_agent ?? "—"}
          </Field>
          <Field label="Detected By">
            <span className="inline-flex items-center gap-1.5">
              <Bot className="size-3.5 text-primary" />
              {ticket.detected_by}
            </span>
          </Field>

          <Field label="Detection Source" className="sm:col-span-2">
            {ticket.detection_source}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
