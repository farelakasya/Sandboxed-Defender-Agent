import { RedBlueSimClient } from "./RedBlueSimClient";

/**
 * In-app Red/Blue attacker/defender simulator — /simulations/red-blue
 *
 * Reuses the teammate's standalone HTML logic (left untouched) but emits
 * structured SimulationIncidentEvent objects that flow into the ticket store
 * via upsertTicketFromSimulation().
 */
export default function RedBlueSimulationPage() {
  return <RedBlueSimClient />;
}
