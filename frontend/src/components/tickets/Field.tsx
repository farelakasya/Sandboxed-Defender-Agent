import { cn } from "@/lib/utils";

/** Subtle-but-visible "N/A" marker for missing backend fields (backend mode). */
export function Na() {
  return <span className="italic text-muted-foreground/60">N/A</span>;
}

/**
 * Renders `children` when `value` is present, otherwise a muted N/A. "Present"
 * excludes null/undefined, empty strings, and empty arrays. Use for backend
 * fields that may be absent — never fabricate a default.
 */
export function NaOr({
  value,
  children,
}: {
  value: unknown;
  children?: React.ReactNode;
}) {
  const missing =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);
  if (missing) return <Na />;
  return <>{children ?? String(value)}</>;
}

/** Labeled key/value row used inside the detail info cards. */
export function Field({
  label,
  children,
  mono,
  className,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm text-foreground", mono && "font-mono text-[13px]")}>
        {children}
      </span>
    </div>
  );
}
