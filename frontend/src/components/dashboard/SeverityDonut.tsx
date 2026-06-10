"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeveritySlice } from "@/lib/dashboard.utils";
import { Severity } from "@/lib/ticket.types";

// Hex colors aligned with the app's severity palette (tailwind 400 shades).
const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "#f87171",
  HIGH: "#fb923c",
  MEDIUM: "#fbbf24",
  LOW: "#34d399",
};

interface Props {
  distribution: SeveritySlice[];
  total: number;
  highRiskShare: number;
}

// Donut geometry. Normal/hover radii follow the requested 145/156 ratio
// (+11px pop), scaled to this compact card. Tweak HOVER_RADIUS to change the
// pop distance.
const BASE_RADIUS = 72;
const HOVER_RADIUS = 83; // +11px, same delta as 145 -> 156

/**
 * Recharts active-shape renderer: the hovered slice expands outward to
 * HOVER_RADIUS and keeps full opacity (dimming of others is handled per-Cell).
 */
function renderActiveShape(props: PieSectorDataItem) {
  const { outerRadius: _ignored, ...rest } = props;
  return (
    <Sector
      {...rest}
      outerRadius={HOVER_RADIUS}
      // subtle ring to emphasize the active arc
      stroke="hsl(var(--card))"
      strokeWidth={2}
    />
  );
}

/** Cursor-following tooltip: severity label, count, and % of total. */
function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: SeveritySlice }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  const pct = total > 0 ? (slice.count / total) * 100 : 0;
  const color = SEVERITY_COLOR[slice.severity];
  return (
    <div
      className="relative z-50 rounded-lg text-xs"
      // Frosted dark card: mostly-opaque background + blur so nothing shows
      // through, severity-colored border, and a soft floating shadow.
      style={{
        minWidth: 160,
        padding: "12px 14px",
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${color}`,
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
      }}
    >
      <div
        className="flex items-center gap-1.5 font-semibold"
        style={{ color }}
      >
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {slice.severity}
      </div>
      <div className="mt-1 text-slate-300">
        {slice.count} {slice.count === 1 ? "ticket" : "tickets"}
      </div>
      <div className="text-slate-400">{pct.toFixed(1)}% of total</div>
    </div>
  );
}

export function SeverityDonut({ distribution, total, highRiskShare }: Props) {
  // Shared hover state — driven by BOTH the slices and the legend rows.
  const [activeSeverity, setActiveSeverity] = useState<Severity | null>(null);

  // Only non-empty slices are drawn; legend still lists every severity.
  const data = distribution.filter((d) => d.count > 0);
  const activeIndex = data.findIndex((d) => d.severity === activeSeverity);

  const hovered =
    activeSeverity != null
      ? distribution.find((d) => d.severity === activeSeverity) ?? null
      : null;
  const hoveredPct =
    hovered && total > 0 ? (hovered.count / total) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <ShieldAlert className="size-4 text-primary" />
          Risk Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div
            className="relative h-40 w-40 shrink-0"
            role="img"
            aria-label={
              total === 0
                ? "Risk breakdown donut chart: no tickets yet"
                : `Risk breakdown donut chart: ${distribution
                    .map((d) => `${d.count} ${d.severity}`)
                    .join(", ")}, ${total} total`
            }
          >
            {total === 0 ? (
              <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-border text-center text-xs text-muted-foreground">
                No tickets yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={<DonutTooltip total={total} />}
                    wrapperStyle={{ outline: "none", zIndex: 50 }}
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={BASE_RADIUS}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                    activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, i) =>
                      setActiveSeverity(data[i]?.severity ?? null)
                    }
                    onMouseLeave={() => setActiveSeverity(null)}
                  >
                    {data.map((d) => {
                      const dimmed =
                        activeSeverity != null && activeSeverity !== d.severity;
                      return (
                        <Cell
                          key={d.severity}
                          fill={SEVERITY_COLOR[d.severity]}
                          // Non-hovered slices dim; hovered keeps full opacity.
                          fillOpacity={dimmed ? 0.35 : 1}
                          style={{ transition: "fill-opacity 180ms ease" }}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Center label — swaps to the hovered severity's detail on hover. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {hovered ? (
                <>
                  <span
                    className="text-sm font-bold uppercase tracking-wide"
                    style={{ color: SEVERITY_COLOR[hovered.severity] }}
                  >
                    {hovered.severity}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {hovered.count}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {hoveredPct.toFixed(1)}% of total
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {total}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Total Tickets
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Legend — hoverable, mirrors the slice active state. */}
          <ul className="flex-1 space-y-1">
            {distribution.map((d) => {
              const isActive = activeSeverity === d.severity;
              const dimmed = activeSeverity != null && !isActive;
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              return (
                <li key={d.severity}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveSeverity(d.severity)}
                    onMouseLeave={() => setActiveSeverity(null)}
                    onFocus={() => setActiveSeverity(d.severity)}
                    onBlur={() => setActiveSeverity(null)}
                    aria-label={`${d.severity}: ${d.count} tickets, ${pct.toFixed(
                      1
                    )}% of total`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors duration-200",
                      // Legend hover: subtle background.
                      isActive && "bg-white/10",
                      dimmed && "opacity-50"
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full transition-transform duration-200"
                      style={{
                        backgroundColor: SEVERITY_COLOR[d.severity],
                        transform: isActive ? "scale(1.35)" : "scale(1)",
                      }}
                    />
                    <span
                      className={cn(
                        "transition-colors duration-200",
                        // Text turns white on hover.
                        isActive ? "font-medium text-white" : "text-muted-foreground"
                      )}
                    >
                      {d.severity}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums text-foreground">
                      {d.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{highRiskShare}%</span>{" "}
          of active tickets are high-risk (CRITICAL or HIGH).
        </p>
      </CardContent>
    </Card>
  );
}
