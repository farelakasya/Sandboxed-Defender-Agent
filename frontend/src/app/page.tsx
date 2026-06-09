import { redirect } from "next/navigation";

/** Land on the ticket queue for the demo. */
export default function Home() {
  redirect("/security/tickets");
}
