import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Severity } from "@/lib/ticket.types";
import { getSeverityStyle } from "@/lib/ticket.utils";

export function TicketSeverityBadge({
  severity,
  className,
  withIcon = true,
}: {
  severity: Severity;
  className?: string;
  withIcon?: boolean;
}) {
  const s = getSeverityStyle(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
        s.badge,
        className
      )}
    >
      {withIcon ? (
        <ShieldAlert className="size-3.5" />
      ) : (
        <span className={cn("size-2 rounded-full", s.dot)} />
      )}
      {severity}
    </span>
  );
}
