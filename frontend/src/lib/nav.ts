import {
  LayoutDashboard,
  Ticket,
  ShieldAlert,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for app navigation.
 *
 * Add/rename/reorder items here only — the sidebar renders straight from this
 * array, so future routes are a one-line change. Keep labels short and hrefs
 * stable.
 *
 * `external: true` marks links served outside the Next router (e.g. static HTML
 * in /public or a teammate-hosted page); those render as plain anchors.
 *
 * `match` lists path prefixes that should keep the item highlighted, so nested
 * routes like /security/tickets/[ticketId] still light up "Tickets".
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes (besides href) that mark this item active. */
  match?: string[];
  /** Served outside the Next router — render as a normal <a> (new tab). */
  external?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
      {
        label: "Tickets",
        href: "/security/tickets",
        icon: Ticket,
        // Keep "Tickets" active on the detail route too.
        match: ["/security/tickets"],
      },
    ],
  },
  {
    title: "Simulations",
    items: [
      {
        // In-app simulator: emits structured events into the ticket store.
        label: "Red/Blue Simulation",
        href: "/simulations/red-blue",
        icon: ShieldAlert,
        match: ["/simulations/red-blue"],
      },
      {
        // In-app fraud simulator: feeds the unified detection pipeline.
        label: "Fraud Simulation",
        href: "/testing/fraud",
        icon: CreditCard,
        match: ["/testing/fraud"],
      },
      {
        // Teammate's original standalone HTML, served as-is from /public.
        label: "Red/Blue Simulation (raw)",
        href: "/red-blue-simulation.html",
        icon: ShieldAlert,
        external: true,
      },
      {
        // Original fraud HTML — static, served from /public, kept untouched.
        label: "Fraud Simulation (raw)",
        href: "/fraud-simulation.html",
        icon: CreditCard,
        external: true,
      },
    ],
  },
];

/** Flat list, handy for tests or a future command palette. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/**
 * Decide whether a nav item is active for the current pathname.
 * - "/" is active only on an exact match (avoids matching everything).
 * - otherwise active if pathname equals href or starts with any `match` prefix.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.external) return false;
  if (item.href === "/") return pathname === "/";
  const prefixes = item.match ?? [item.href];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
