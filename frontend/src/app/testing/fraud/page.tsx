import { FraudSimClient } from "./FraudSimClient";

/**
 * Fraud Scenario Simulation — /testing/fraud
 *
 * In-app rebuild of project/Payment Fraud Simulation.html (left untouched).
 * Each fraud turn becomes a DetectionEvent that flows through the unified
 * detection pipeline (classify → analyze → mitigate → notify → recommend),
 * producing/updating Detection Tickets in the shared store. No isolated
 * fraud-only ticket system.
 */
export default function FraudSimulationPage() {
  return <FraudSimClient />;
}
