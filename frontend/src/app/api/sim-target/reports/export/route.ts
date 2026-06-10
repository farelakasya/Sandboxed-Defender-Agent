import { handleSimTarget } from "@/lib/sim-target";

/**
 * GET /api/sim-target/reports/export — simulated bulk export. Returns 403 unless
 * the actor is internal (stand-in for an admin/auditor role).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSimTarget(
    request,
    "GET",
    "/api/sim-target/reports/export",
    {
      attack_type: "report_export_abuse",
      asset: "reports_api",
      defaultActor: "external",
    }
  );
}
