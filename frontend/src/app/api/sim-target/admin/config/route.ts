import { handleSimTarget } from "@/lib/sim-target";

/**
 * GET /api/sim-target/admin/config — simulated admin config read. Returns 403
 * for external/unknown actors. No real config is exposed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSimTarget(request, "GET", "/api/sim-target/admin/config", {
    attack_type: "admin_endpoint_probing",
    asset: "admin_api",
    defaultActor: "external",
  });
}
