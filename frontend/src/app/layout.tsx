import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { RedTeamEventSync } from "@/components/redteam/RedTeamEventSync";
import { DetectionEventSync } from "@/components/detection/DetectionEventSync";

export const metadata: Metadata = {
  title: "Sandboxed Defender — Security Tickets",
  description:
    "Security ticket queue and incident detail for the AI-driven security platform (demo, mock data).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force dark mode for the security-dashboard aesthetic. The design tokens
  // also support light mode if `dark` is removed.
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background bg-grid antialiased">
        <ToastProvider>
          {/* Client polling bridge: imports server-side red-team events into the
              localStorage ticket store. Renders nothing. */}
          <RedTeamEventSync />
          {/* Imports server-side detection events (launch route / collaborator
              callback) into the ticket store. Renders nothing. */}
          <DetectionEventSync />
          <div className="flex min-h-screen">
            <AppSidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
