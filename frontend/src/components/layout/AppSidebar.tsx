"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldHalf, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getVisibleNavSections,
  isNavItemActive,
  type NavItem,
} from "@/lib/nav";

/**
 * Global app sidebar. Renders entirely from NAV_SECTIONS (see lib/nav.ts) so
 * navigation is configured in one place. Uses the existing design tokens — no
 * new colors/spacing introduced.
 */
export function AppSidebar() {
  const pathname = usePathname();
  // Legacy/raw simulator sections are hidden unless the flag is enabled.
  const sections = getVisibleNavSections();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card/50 lg:flex lg:flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
          <ShieldHalf className="size-4 text-primary" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Sandboxed Defender
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isNavItemActive(item, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <p className="px-2 text-[11px] text-muted-foreground/70">
          Demo · mock data
        </p>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const className = cn(
    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );

  // External (static HTML in /public) → plain anchor, opens in a new tab.
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <ExternalLink className="size-3.5 shrink-0 opacity-50" />
      </a>
    );
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
