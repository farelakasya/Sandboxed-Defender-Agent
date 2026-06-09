import personasMock from "../mocks/attacker-personas.mock.json";
import endpointsMock from "../mocks/endpoints.mock.json";
import incidentsMock from "../mocks/incidents.mock.json";
import { AttackerPersona } from "../contracts/agent.schema";
import { SimulationEndpoint } from "../contracts/simulation.schema";
import { Incident, IncidentSchema } from "../contracts/incident.schema";
import { setPersonas } from "./persona.service";
import { setEndpoints } from "./simulation.service";
import { store } from "./store";

/**
 * Seeds the in-memory store from the mock files so the API is useful the
 * moment the server boots. Idempotent: replaces whatever is currently loaded.
 */
export function seedStore(): void {
  setPersonas(personasMock as AttackerPersona[]);
  setEndpoints(endpointsMock as SimulationEndpoint[]);
  store.incidents = (incidentsMock as Incident[]).map((i) => IncidentSchema.parse(i));
}
