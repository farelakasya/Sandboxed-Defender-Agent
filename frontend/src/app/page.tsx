import { DashboardClient } from "./DashboardClient";

/**
 * Dashboard landing page — "/".
 * The bare-minimum overview with KPIs and links to each feature. Replaces the
 * old redirect so "/" is a real page.
 */
export default function Home() {
  return <DashboardClient />;
}
