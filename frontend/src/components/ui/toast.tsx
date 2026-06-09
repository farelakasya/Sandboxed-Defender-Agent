"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { X, ShieldAlert, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal toast system (context + portal-free fixed stack) so we don't pull in
 * a toast library for the demo.
 */

type ToastVariant = "default" | "success" | "alert";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const VARIANT_META: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  default: { icon: Info, ring: "border-border", iconColor: "text-primary" },
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-500/40",
    iconColor: "text-emerald-400",
  },
  alert: {
    icon: ShieldAlert,
    ring: "border-orange-500/40",
    iconColor: "text-orange-400",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>((t) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [
      ...prev,
      { id, variant: t.variant ?? "default", title: t.title, description: t.description },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  useEffect(() => {
    const id = setTimeout(onDismiss, 4200);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 shadow-lg",
        meta.ring
      )}
      role="status"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", meta.iconColor)} />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
