import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MOCK_TICKETS } from "@/data/mockTickets";
import {
  RecommendedAction,
  SecurityTicket,
  TicketActivityActor,
  TicketActivityItem,
  TicketStatus,
} from "@/lib/ticket.types";
import { createSimulatedTicket } from "@/lib/ticket.factory";

/**
 * Global client-side ticket store (demo MVP — no real database).
 *
 * This is the single source of truth for ticket data on the client. Both the
 * queue page and the detail page read/write here, so an edit on one screen is
 * immediately visible on the other. State is persisted to localStorage so it
 * survives refreshes during a demo.
 *
 * TODO(api): replace the action bodies with calls to tickets.service.ts (which
 * will hit the real backend) and treat the store purely as a client cache.
 */

const CAMPAIGN_ID = "INC-2026-006";
/** Simulated tickets start numbering here to avoid clashing with the seeds. */
const SIM_SEQUENCE_START = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function freshSeed(): SecurityTicket[] {
  // structuredClone so mutations never leak back into the imported seed array.
  return structuredClone(MOCK_TICKETS);
}

function makeActivity(
  actor: TicketActivityActor,
  message: string
): TicketActivityItem {
  return {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowIso(),
    actor,
    message,
  };
}

interface TicketState {
  tickets: SecurityTicket[];
  /** Monotonic counter for simulated ticket ids; persisted so it survives refresh. */
  simSequence: number;

  // selectors
  getTicketById: (ticketId: string) => SecurityTicket | undefined;

  // mutations
  updateTicketStatus: (ticketId: string, status: TicketStatus) => void;
  updateRecommendedActionStatus: (
    ticketId: string,
    actionId: string,
    status: RecommendedAction["status"]
  ) => void;
  addActivity: (ticketId: string, activityItem: TicketActivityItem) => void;
  notifyDeveloper: (ticketId: string) => void;
  markResolved: (ticketId: string) => void;
  reopenTicket: (ticketId: string) => void;
  simulateNewTicket: () => SecurityTicket | undefined;
  simulateOverload: () => SecurityTicket | undefined;
  resetMockData: () => void;
}

/**
 * Immutably map over tickets, replacing the one matching `ticketId` with the
 * result of `fn`. Always sets a fresh `updated_at` on the touched ticket.
 */
function patchTicket(
  tickets: SecurityTicket[],
  ticketId: string,
  fn: (t: SecurityTicket) => SecurityTicket
): SecurityTicket[] {
  return tickets.map((t) =>
    t.ticket_id === ticketId ? { ...fn(t), updated_at: nowIso() } : t
  );
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "new",
  auto_contained: "auto-contained",
  needs_review: "needs review",
  investigating: "investigating",
  escalated: "escalated",
  resolved: "resolved",
  false_positive: "false positive",
};

export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
      tickets: freshSeed(),
      simSequence: SIM_SEQUENCE_START,

      getTicketById: (ticketId) =>
        get().tickets.find((t) => t.ticket_id === ticketId),

      updateTicketStatus: (ticketId, status) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => ({
            ...t,
            status,
            activity: [
              ...t.activity,
              makeActivity(
                "System",
                `Status changed to "${STATUS_LABELS[status]}".`
              ),
            ],
          })),
        })),

      updateRecommendedActionStatus: (ticketId, actionId, status) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => {
            const action = t.recommended_actions.find((a) => a.id === actionId);
            const label = status.replace(/_/g, " ");
            return {
              ...t,
              recommended_actions: t.recommended_actions.map((a) =>
                a.id === actionId ? { ...a, status } : a
              ),
              activity: [
                ...t.activity,
                makeActivity(
                  "Developer",
                  action
                    ? `Recommended action "${action.title}" marked ${label}.`
                    : `Recommended action marked ${label}.`
                ),
              ],
            };
          }),
        })),

      addActivity: (ticketId, activityItem) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => ({
            ...t,
            activity: [...t.activity, activityItem],
          })),
        })),

      notifyDeveloper: (ticketId) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => ({
            ...t,
            // A "new" ticket moves to needs_review once a human is looped in.
            status: t.status === "new" ? "needs_review" : t.status,
            activity: [
              ...t.activity,
              makeActivity("AI Defender", "Developer notification sent."),
            ],
          })),
        })),

      markResolved: (ticketId) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => ({
            ...t,
            status: "resolved",
            activity: [
              ...t.activity,
              makeActivity("Developer", "Marked ticket as resolved."),
            ],
          })),
        })),

      reopenTicket: (ticketId) =>
        set((state) => ({
          tickets: patchTicket(state.tickets, ticketId, (t) => ({
            ...t,
            status: "needs_review",
            activity: [
              ...t.activity,
              makeActivity("Developer", "Reopened ticket for review."),
            ],
          })),
        })),

      simulateNewTicket: () => {
        const sequence = get().simSequence + 1;
        const ticket = createSimulatedTicket(sequence);
        set((state) => ({
          simSequence: sequence,
          tickets: [ticket, ...state.tickets],
        }));
        return ticket;
      },

      simulateOverload: () => {
        const ts = nowIso();
        const newEvents = 40 + Math.floor(Math.random() * 40);
        const newSuppressed = 80 + Math.floor(Math.random() * 120);

        let campaign = get().tickets.find((t) => t.ticket_id === CAMPAIGN_ID);
        // Fall back to any grouped ticket, else re-seed the canonical campaign.
        if (!campaign) {
          campaign =
            get().tickets.find((t) => t.is_grouped) ??
            structuredClone(
              MOCK_TICKETS.find((t) => t.ticket_id === CAMPAIGN_ID)!
            );
        }
        const campaignId = campaign.ticket_id;
        const exists = get().tickets.some((t) => t.ticket_id === campaignId);

        const updatedCampaign: SecurityTicket = {
          ...campaign,
          grouped_event_count: (campaign.grouped_event_count ?? 0) + newEvents,
          suppressed_event_count:
            (campaign.suppressed_event_count ?? 0) + newSuppressed,
          request_count: campaign.request_count + newEvents,
          last_seen: ts,
          updated_at: ts,
          status: "auto_contained",
          activity: [
            ...campaign.activity,
            makeActivity(
              "AI Defender",
              `Overload: grouped ${newEvents} more events, suppressed ${newSuppressed} duplicates.`
            ),
          ],
        };

        set((state) => ({
          tickets: exists
            ? state.tickets.map((t) =>
                t.ticket_id === campaignId ? updatedCampaign : t
              )
            : [updatedCampaign, ...state.tickets],
        }));
        return updatedCampaign;
      },

      resetMockData: () =>
        set({ tickets: freshSeed(), simSequence: SIM_SEQUENCE_START }),
    }),
    {
      name: "sandboxed-defender:tickets",
      version: 1,
      // Persist only data, not the action functions.
      partialize: (state) => ({
        tickets: state.tickets,
        simSequence: state.simSequence,
      }),
    }
  )
);
