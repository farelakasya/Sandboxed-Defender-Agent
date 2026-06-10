"use client";

import { Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/**
 * Fix Authentication Failures (A07) — remediation modal.
 * Content ported verbatim from the standalone Fraud Simulation HTML.
 */

interface RemediationItem {
  title: string;
  body: string;
  /** Optional confirmed-outcome badge (used by the real-case item). */
  outcome?: string;
}

const ITEMS: RemediationItem[] = [
  {
    title: "Rate-limit /api/auth/login with sliding-window",
    body: "Max 5 failed attempts per IP per 15 min. Return HTTP 429 with Retry-After. Apply exponential backoff on repeated failures. Trigger CAPTCHA after 3 consecutive failures.",
  },
  {
    title: "Bind payment sessions to device fingerprint",
    body: "Capture VisitorID at checkout initiation. Reject payment completions where session VisitorID differs from initiation VisitorID. Invalidate sessions on device change mid-flow.",
  },
  {
    title: "Check credentials against breach databases",
    body: "Query HaveIBeenPwned API (k-anonymity model) on every login. Force password reset on confirmed-breached credentials. Alert users to suspicious login geography (new country, new device).",
  },
  {
    title: "Enforce step-up MFA for high-risk signals",
    body: "Trigger additional authentication when: new device fingerprint, new country, previous failed attempts, cart value > $500, or ML fraud score > 70/100.",
  },
  {
    title: "Real case — Headout (2023)",
    body: 'The travel-experience platform Headout was targeted by coordinated ATO and chargeback attacks. After integrating Fingerprint device intelligence to bind each transaction to a unique VisitorID, they cut fraudulent chargebacks by 90%. "We previously could never identify the devices used by fraudulent actors the way we can today."',
    outcome: "Confirmed outcome: 90% chargeback reduction",
  },
];

export function FixAuthFailuresModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Fix Authentication Failures (A07)">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
          Remediation for{" "}
          <strong className="text-foreground">
            OWASP A07 — Identification and Authentication Failures
          </strong>
          . Addresses card cracking and account takeover attack patterns observed
          in simulation.
        </div>

        <ol className="space-y-3">
          {ITEMS.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="text-sm">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
                {item.outcome && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                    <Check className="size-3" />
                    {item.outcome}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
