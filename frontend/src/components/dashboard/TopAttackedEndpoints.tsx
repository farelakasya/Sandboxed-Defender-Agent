import { Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EndpointCount } from "@/lib/dashboard.utils";

export function TopAttackedEndpoints({
  endpoints,
}: {
  endpoints: EndpointCount[];
}) {
  const max = Math.max(1, ...endpoints.map((e) => e.attempts));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <Server className="size-4 text-primary" />
          Top Attacked Endpoints
        </CardTitle>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No endpoints targeted yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {endpoints.map((e, i) => (
              <li key={e.endpoint} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground/60">
                      {i + 1}
                    </span>
                    <span className="truncate font-mono text-xs text-foreground">
                      {e.endpoint}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.attempts} attempts
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-500/70"
                    style={{ width: `${(e.attempts / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
