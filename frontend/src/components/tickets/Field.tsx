import { cn } from "@/lib/utils";

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
