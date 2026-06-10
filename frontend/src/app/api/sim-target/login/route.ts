import { handleSimTarget } from "@/lib/sim-target";

/** POST /api/sim-target/login — simulated login. Returns 401 (stuffing). */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSimTarget(request, "POST", "/api/sim-target/login", {
    attack_type: "credential_stuffing",
    asset: "auth_api",
    defaultActor: "external",
  });
}
