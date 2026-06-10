import { handleSimTarget } from "@/lib/sim-target";

/**
 * POST /api/sim-target/admin/reset-user-data — simulated destructive admin
 * action. Returns 403 for external/unknown actors. NOTHING is reset.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSimTarget(
    request,
    "POST",
    "/api/sim-target/admin/reset-user-data",
    {
      attack_type: "admin_endpoint_probing",
      asset: "admin_api",
      defaultActor: "external",
    }
  );
}
