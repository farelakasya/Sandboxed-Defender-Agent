import { TicketQueueClient } from "./TicketQueueClient";

/**
 * Security Ticket Queue — /security/tickets
 *
 * The queue reads from the shared Zustand store (single source of truth), so
 * status changes made on the detail page show up here immediately. No data is
 * fetched or copied at this level anymore.
 */
export default function TicketQueuePage() {
  return <TicketQueueClient />;
}
