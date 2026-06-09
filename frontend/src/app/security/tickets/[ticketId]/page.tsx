import { TicketDetailClient } from "./TicketDetailClient";

/**
 * Security Ticket Detail — /security/tickets/[ticketId]
 *
 * The detail view reads its ticket from the shared Zustand store by id, so any
 * edit here (resolve, reopen, notify, action toggle) updates the same object
 * the queue renders. Data is no longer fetched or copied at this level.
 */
export default function TicketDetailPage({
  params,
}: {
  params: { ticketId: string };
}) {
  return <TicketDetailClient ticketId={params.ticketId} />;
}
