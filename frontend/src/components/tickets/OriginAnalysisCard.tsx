import { Globe, UserX, Fingerprint, Activity, Contact } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "./Field";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatActorType, formatDateTime } from "@/lib/ticket.utils";

export function OriginAnalysisCard({ ticket }: { ticket: SecurityTicket }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Globe className="size-4 text-primary" />
          Origin / Source Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Source IP" mono>
            {ticket.source_ip ?? "Multiple IPs"}
          </Field>
          <Field label="Actor Type">
            <span className="inline-flex items-center gap-1.5">
              <UserX className="size-3.5 text-orange-400" />
              {formatActorType(ticket.actor_type)}
            </span>
          </Field>

          <Field label="Matched Pattern">
            <span className="inline-flex items-center gap-1.5">
              <Fingerprint className="size-3.5 text-primary" />
              {ticket.matched_pattern ?? "—"}
            </span>
          </Field>
          <Field label="Request Count">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="size-3.5 text-muted-foreground" />
              {ticket.request_count}
            </span>
          </Field>

          {ticket.user_id && (
            <Field label="User ID" mono>
              <span className="inline-flex items-center gap-1.5">
                <Contact className="size-3.5 text-muted-foreground" />
                {ticket.user_id}
              </span>
            </Field>
          )}

          <Field label="First Seen" mono>
            {formatDateTime(ticket.first_seen)}
          </Field>
          <Field label="Last Seen" mono>
            {formatDateTime(ticket.last_seen)}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
