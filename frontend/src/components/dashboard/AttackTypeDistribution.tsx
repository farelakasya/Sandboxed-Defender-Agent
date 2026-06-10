import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackTypeCount } from "@/lib/dashboard.utils";
import { humanizeAttackType } from "@/lib/ticket.utils";

export function AttackTypeDistribution({
  distribution,
}: {
  distribution: AttackTypeCount[];
}) {
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <TrendingUp className="size-4 text-primary" />
          Attack Type Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No attacks recorded yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {distribution.map((d) => (
              <li key={d.attack_type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {humanizeAttackType(d.attack_type)}
                  </span>
                  <span className="font-semibold tabular-nums text-muted-foreground">
                    {d.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(d.count / max) * 100}%` }}
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
