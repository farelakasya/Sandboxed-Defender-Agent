import { handleSimTarget } from "@/lib/sim-target";

/**
 * GET /api/sim-target/clients/[id] — fetch a client record (simulated, no real
 * data). Classified as insider data access.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleSimTarget(
    request,
    "GET",
    `/api/sim-target/clients/${id}`,
    {
      attack_type: "insider_data_access",
      asset: "clients_api",
      defaultActor: "internal",
    }
  );
}
