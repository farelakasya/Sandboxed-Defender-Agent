"use client";

import { useMemo, useState } from "react";
import { FileSearch, ChevronDown, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EvidenceLog, SecurityTicket } from "@/lib/ticket.types";
import { formatDateTime } from "@/lib/ticket.utils";

const ALL = "all";

function statusCodeStyle(code: number): string {
  if (code >= 500) return "text-red-400";
  if (code === 403 || code === 401) return "text-orange-400";
  if (code === 404) return "text-amber-400";
  if (code === 429) return "text-violet-400";
  if (code >= 200 && code < 300) return "text-emerald-400";
  return "text-muted-foreground";
}

export function EvidenceLogTable({ ticket }: { ticket: SecurityTicket }) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [endpointFilter, setEndpointFilter] = useState<string>(ALL);
  const [rawOpen, setRawOpen] = useState(false);

  const statusCodes = useMemo(
    () =>
      Array.from(new Set(ticket.evidence_logs.map((l) => l.status_code))).sort(),
    [ticket.evidence_logs]
  );
  const endpoints = useMemo(
    () => Array.from(new Set(ticket.evidence_logs.map((l) => l.endpoint))),
    [ticket.evidence_logs]
  );

  const filtered: EvidenceLog[] = ticket.evidence_logs.filter((l) => {
    const statusOk =
      statusFilter === ALL || String(l.status_code) === statusFilter;
    const endpointOk = endpointFilter === ALL || l.endpoint === endpointFilter;
    return statusOk && endpointOk;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex-wrap justify-between gap-3">
          <span className="flex items-center gap-2">
            <FileSearch className="size-4 text-primary" />
            Evidence
            <Badge variant="muted">{filtered.length} entries</Badge>
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status code"
            >
              <option value={ALL}>All statuses</option>
              {statusCodes.map((c) => (
                <option key={c} value={String(c)}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              aria-label="Filter by endpoint"
            >
              <option value={ALL}>All endpoints</option>
              {endpoints.map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </Select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Timestamp</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">User Agent</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    {ticket.evidence_logs.length === 0
                      ? "N/A — no evidence logs recorded."
                      : "No log entries match the current filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                        {log.method}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{log.endpoint}</td>
                    <td
                      className={cn(
                        "px-3 py-2 font-mono text-xs font-bold",
                        statusCodeStyle(log.status_code)
                      )}
                    >
                      {log.status_code}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {log.ip}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {log.user_agent}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {log.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* View Raw Logs — expandable */}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setRawOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/30"
          >
            <span className="flex items-center gap-2">
              <Code2 className="size-4 text-muted-foreground" />
              View Raw Logs
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                rawOpen && "rotate-180"
              )}
            />
          </button>
          {rawOpen && (
            <pre className="max-h-72 overflow-auto border-t border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(filtered, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
