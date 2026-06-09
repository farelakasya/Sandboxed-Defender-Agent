import { cn } from "@/lib/utils";
import { TicketStatus } from "@/lib/ticket.types";
import { getStatusStyle } from "@/lib/ticket.utils";

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const s = getStatusStyle(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        s.badge,
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
