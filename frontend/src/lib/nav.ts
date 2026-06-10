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
  /**
   * Hidden from the navbar unless NEXT_PUBLIC_SHOW_LEGACY_SIMULATORS=true.
   * Used for capabilities the current backend doesn't support (e.g. fraud
   * launch). The route/page still exists; this only controls navbar visibility.
   */
  legacy?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  /**
   * Legacy/internal section — hidden from the primary navbar unless
   * NEXT_PUBLIC_SHOW_LEGACY_SIMULATORS=true. The links/files still exist and
   * the direct URLs remain accessible; this only controls navbar visibility.
   */
  legacy?: boolean;
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
        label: "Detection Tickets",
        href: "/security/tickets",
        icon: Ticket,
        // Keep this active on the detail route too.
        match: ["/security/tickets"],
      },
    ],
  },
  {
    title: "Testing Lab",
    items: [
      {
        // In-app red-team launcher: vector → /api/testing/launch → report.
        label: "Red-Team Launch",
        href: "/simulations/red-blue",
        icon: ShieldAlert,
        match: ["/simulations/red-blue"],
      },
      {
        // Fraud launch is NOT supported by the Tier2 AI-Pentest backend; hidden
        // from the navbar by default (page still exists for the in-browser sim).
        label: "Fraud Launch",
        href: "/testing/fraud",
        icon: CreditCard,
        match: ["/testing/fraud"],
        legacy: true,
      },
    ],
  },
  {
    title: "Legacy Simulators",
    legacy: true,
    items: [
      {
        // Teammate's original standalone HTML, served as-is from /public.
        label: "Raw Red/Blue Simulator",
        href: "/red-blue-simulation.html",
        icon: ShieldAlert,
        external: true,
      },
      {
        // Original fraud HTML — static, served from /public, kept untouched.
        label: "Raw Fraud Simulator",
        href: "/fraud-simulation.html",
        icon: CreditCard,
        external: true,
      },
    ],
  },
];

/**
 * Whether legacy/raw simulator sections should appear in the navbar.
 * Controlled by NEXT_PUBLIC_SHOW_LEGACY_SIMULATORS (default: hidden).
 * The raw HTML files and their direct URLs (e.g. /red-blue-simulation.html)
 * stay accessible regardless — this only affects navbar visibility.
 */
export function showLegacySimulators(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_LEGACY_SIMULATORS === "true";
}

/**
 * Nav sections to render in the sidebar. Legacy sections are dropped unless the
 * flag is enabled. Use this (not NAV_SECTIONS) for rendering the navbar.
 */
export function getVisibleNavSections(): NavSection[] {
  const showLegacy = showLegacySimulators();
  return NAV_SECTIONS
    // Drop whole legacy sections (e.g. Legacy Simulators) unless enabled.
    .filter((s) => !s.legacy || showLegacy)
    // Drop legacy items (e.g. Fraud Launch) unless enabled; drop now-empty sections.
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.legacy || showLegacy) }))
    .filter((s) => s.items.length > 0);
}

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
