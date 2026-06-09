"use client";

import { useState } from "react";
import { MessagesSquare, Bot, Cog, User, ShieldCheck, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TicketActivityActor, TicketActivityItem } from "@/lib/ticket.types";
import { formatDateTime } from "@/lib/ticket.utils";

const ACTOR_META: Record<
  TicketActivityActor,
  { icon: typeof Bot; ring: string; text: string }
> = {
  "AI Defender": {
    icon: Bot,
    ring: "border-primary/40 bg-primary/10",
    text: "text-primary",
  },
  System: {
    icon: Cog,
    ring: "border-border bg-muted",
    text: "text-muted-foreground",
  },
  Developer: {
    icon: User,
    ring: "border-emerald-500/40 bg-emerald-500/10",
    text: "text-emerald-400",
  },
  Admin: {
    icon: ShieldCheck,
    ring: "border-orange-500/40 bg-orange-500/10",
    text: "text-orange-400",
  },
};

interface Props {
  activity: TicketActivityItem[];
  onAddComment: (message: string) => void;
}

export function TicketActivity({ activity, onAddComment }: Props) {
  const [draft, setDraft] = useState("");

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setDraft("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <MessagesSquare className="size-4 text-primary" />
          Ticket Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-4">
          {activity.map((item) => {
            const meta = ACTOR_META[item.actor];
            const Icon = meta.icon;
            return (
              <li key={item.id} className="flex gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    meta.ring
                  )}
                >
                  <Icon className={cn("size-4", meta.text)} />
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm font-semibold", meta.text)}>
                      {item.actor}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">{item.message}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Local mock comment input (posts as Developer). */}
        <div className="space-y-2 border-t border-border pt-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a developer note…"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Posts locally as “Developer”. ⌘/Ctrl + Enter to send.
            </span>
            <Button size="sm" onClick={submit} disabled={!draft.trim()}>
              <Send />
              Comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
