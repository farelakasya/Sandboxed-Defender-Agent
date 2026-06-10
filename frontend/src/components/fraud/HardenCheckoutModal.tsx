"use client";

import { Modal } from "@/components/ui/modal";

/**
 * Harden Checkout API (A04 + A01) — remediation modal.
 * Content ported verbatim from the standalone Fraud Simulation HTML.
 */

const ITEMS: { title: string; body: string }[] = [
  {
    title: "Rate-limit payment attempts per device fingerprint",
    body: "Max 3 payment attempts per VisitorID per 10-min window. Return 429 with Retry-After. Log all attempts with device fingerprint for downstream fraud analysis and dispute evidence.",
  },
  {
    title: "Detect and block headless browsers at checkout",
    body: "Check navigator.webdriver, canvas fingerprint consistency, mouse trajectory entropy, and TLS fingerprint. Reject sessions with bot-detection signal score above 0.6. Use Cloudflare Turnstile or equivalent invisible challenge.",
  },
  {
    title: "Enforce server-side promo code validation",
    body: "Validate discount codes server-side against (userID + deviceID + promoCode) tuple. One redemption per device fingerprint per campaign. Never trust client-computed discount — always recalculate total on server.",
  },
  {
    title: "Build chargeback evidence collection pipeline",
    body: "Log VisitorID, IP geolocation, user-agent, delivery confirmation, and order metadata at checkout. Retain for 540 days (Visa/Mastercard dispute window). Auto-generate dispute packages within 72h of chargeback notification.",
  },
  {
    title: "Limit cart reservation abuse",
    body: "Restrict cart holds to 8 min per session. Max 2 concurrent holds per VisitorID. Release inventory immediately on duplicate device signal or VPN detection above risk threshold.",
  },
];

export function HardenCheckoutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Harden Checkout API (A04 + A01)">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
          Hardening steps for{" "}
          <strong className="text-foreground">
            OWASP A04 (Insecure Design) + A01 (Broken Access Control)
          </strong>
          . Addresses bot checkout, card cracking, chargeback fraud, and promo
          abuse patterns.
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
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
