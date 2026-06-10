import {
  BellRing,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatDateTime } from "@/lib/ticket.utils";

/**
 * Read-only display of the automatic developer/on-call notification status.
 *
 * The defender workflow notifies automatically — there is intentionally NO
 * manual "Notify" action here. This card only surfaces what the backend
 * reported (status, channel, recipient, timestamp), with a sensible fallback
 * message when no notification metadata is present.
 */

type NotificationStatus = "sent" | "pending" | "failed" | "not_required" | "unknown";

const STATUS_META: Record<
  NotificationStatus,
  { label: string; icon: typeof BellRing; tone: string; ring: string }
> = {
  sent: {
    label: "Sent",
    icon: CheckCircle2,
    tone: "text-emerald-400",
    ring: "border-emerald-500/40 bg-emerald-500/10",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    tone: "text-amber-400",
    ring: "border-amber-500/40 bg-amber-500/10",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    tone: "text-red-400",
    ring: "border-red-500/40 bg-red-500/10",
  },
  not_required: {
    label: "Not required",
    icon: MinusCircle,
    tone: "text-muted-foreground",
    ring: "border-border bg-muted/30",
  },
  unknown: {
    label: "Automatic",
    icon: HelpCircle,
    tone: "text-cyan-400",
    ring: "border-cyan-500/40 bg-cyan-500/10",
  },
};

function resolveStatus(value: unknown): NotificationStatus {
  return value === "sent" ||
    value === "pending" ||
    value === "failed" ||
    value === "not_required"
    ? value
    : "unknown";
}

export function NotificationStatusCard({ ticket }: { ticket: SecurityTicket }) {
  const notification = ticket.developer_notification;
  const status = resolveStatus(notification?.status);
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <BellRing className="size-4 text-primary" />
          Notification Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${meta.ring}`}
          >
            <Icon className={`size-4 ${meta.tone}`} />
          </span>
          <div>
            <p className={`text-sm font-semibold ${meta.tone}`}>{meta.label}</p>
            <p className="text-xs text-muted-foreground">
              Handled automatically by the defender workflow.
            </p>
          </div>
        </div>

        {notification ? (
          <dl className="space-y-1.5 text-xs">
            {notification.channel ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Channel</dt>
                <dd className="font-medium capitalize text-foreground">
                  {notification.channel}
                </dd>
              </div>
            ) : null}
            {notification.recipient ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium text-foreground">
                  {notification.recipient}
                </dd>
              </div>
            ) : null}
            {notification.timestamp ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Notified</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTime(notification.timestamp)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            Notification handled automatically by defender workflow.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
