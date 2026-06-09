import { GitCommitVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatDateTime } from "@/lib/ticket.utils";

export function TicketTimeline({ ticket }: { ticket: SecurityTicket }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <GitCommitVertical className="size-4 text-primary" />
          Incident Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-6 pl-2">
          <span
            className="absolute left-[7px] top-1.5 h-[calc(100%-1.5rem)] w-px bg-border"
            aria-hidden
          />
          {ticket.timeline.map((t) => (
            <li key={t.id} className="relative flex gap-4">
              <span className="z-10 mt-1 flex size-3.5 shrink-0 items-center justify-center">
                <span className="size-2.5 rounded-full border-2 border-primary bg-background" />
              </span>
              <div className="flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t.event}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDateTime(t.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
