import { handleSimTarget } from "@/lib/sim-target";

/**
 * GET /api/sim-target/admin/users — simulated admin user listing. Returns 403
 * for external/unknown actors. No real users are returned.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSimTarget(request, "GET", "/api/sim-target/admin/users", {
    attack_type: "admin_endpoint_probing",
    asset: "admin_api",
    defaultActor: "external",
  });
}
