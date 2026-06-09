"use client";

import { Search, Filter } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Severity, TicketStatus } from "@/lib/ticket.types";

export interface QueueFilters {
  search: string;
  severity: Severity | "all";
  status: TicketStatus | "all";
  attackType: string | "all";
  endpoint: string | "all";
  timeRange: "all" | "1h" | "24h" | "7d";
}

export const DEFAULT_FILTERS: QueueFilters = {
  search: "",
  severity: "all",
  status: "all",
  attackType: "all",
  endpoint: "all",
  timeRange: "all",
};

interface Props {
  filters: QueueFilters;
  onChange: (next: QueueFilters) => void;
  attackTypes: string[];
  endpoints: string[];
}

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: TicketStatus[] = [
  "new",
  "auto_contained",
  "needs_review",
  "investigating",
  "escalated",
  "resolved",
  "false_positive",
];

export function TicketFilters({
  filters,
  onChange,
  attackTypes,
  endpoints,
}: Props) {
  const set = <K extends keyof QueueFilters>(key: K, value: QueueFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search ticket ID, title, IP, endpoint…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:inline-flex">
          <Filter className="size-3.5" />
          Filters
        </span>

        <Select
          className="h-9"
          value={filters.severity}
          onChange={(e) => set("severity", e.target.value as QueueFilters["severity"])}
          aria-label="Severity"
        >
          <option value="all">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          className="h-9"
          value={filters.status}
          onChange={(e) => set("status", e.target.value as QueueFilters["status"])}
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>

        <Select
          className="h-9 max-w-[160px]"
          value={filters.attackType}
          onChange={(e) => set("attackType", e.target.value)}
          aria-label="Attack type"
        >
          <option value="all">All attack types</option>
          {attackTypes.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </Select>

        <Select
          className="h-9 max-w-[170px]"
          value={filters.endpoint}
          onChange={(e) => set("endpoint", e.target.value)}
          aria-label="Endpoint"
        >
          <option value="all">All endpoints</option>
          {endpoints.map((ep) => (
            <option key={ep} value={ep}>
              {ep}
            </option>
          ))}
        </Select>

        <Select
          className="h-9"
          value={filters.timeRange}
          onChange={(e) => set("timeRange", e.target.value as QueueFilters["timeRange"])}
          aria-label="Time range"
        >
          <option value="all">All time</option>
          <option value="1h">Last 1h</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
        </Select>
      </div>
    </div>
  );
}
