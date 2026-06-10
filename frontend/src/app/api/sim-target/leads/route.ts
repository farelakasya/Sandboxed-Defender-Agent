import { handleSimTarget } from "@/lib/sim-target";

/**
 * GET  /api/sim-target/leads — list leads (simulated, no real data).
 * POST /api/sim-target/leads — create a lead (simulated).
 * Treated as insider/client-data access for classification.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSimTarget(request, "GET", "/api/sim-target/leads", {
    attack_type: "insider_data_access",
    asset: "leads_api",
    defaultActor: "internal",
  });
}

export async function POST(request: Request) {
  return handleSimTarget(request, "POST", "/api/sim-target/leads", {
    attack_type: "insider_data_access",
    asset: "leads_api",
    defaultActor: "internal",
  });
}
