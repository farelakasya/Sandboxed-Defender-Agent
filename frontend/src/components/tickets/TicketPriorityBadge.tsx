import { cn } from "@/lib/utils";
import { Priority } from "@/lib/ticket.types";
import { getPriorityStyle } from "@/lib/ticket.utils";

export function TicketPriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const s = getPriorityStyle(priority);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold",
        s.badge,
        className
      )}
    >
      {s.label}
    </span>
  );
}
