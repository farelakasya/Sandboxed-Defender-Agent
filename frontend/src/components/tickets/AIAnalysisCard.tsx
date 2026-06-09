import { Sparkles, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityTicket } from "@/lib/ticket.types";

export function AIAnalysisCard({ ticket }: { ticket: SecurityTicket }) {
  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle>
          <Sparkles className="size-4 text-primary" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <Bot className="size-4 text-primary" />
          </span>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {ticket.detected_by}
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {ticket.ai_analysis}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
