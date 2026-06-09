"use client";

import { useEffect, useState } from "react";

/**
 * Returns true once the component has mounted on the client. Used to avoid
 * hydration mismatches: the persisted Zustand store reads from localStorage,
 * which only exists in the browser, so store-backed UI must wait for mount
 * before rendering localStorage-derived data.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
