/**
 * The workspace front screen — the new-run intake.
 *
 * Sign-in is NOT here any more: it lives on the front door at `/`, in the last
 * beat of the scroll scene. A signed-out visitor who lands on this address is sent
 * there rather than shown a second, competing sign-in panel.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { IntakeForm } from "@/components/intake/intake-form";
import { RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { readerAvailable } from "@/lib/admirror/library-feed";
import { getUser } from "@/lib/auth";

export default async function StartPage() {
  const user = await getUser();

  if (!user) redirect("/");

  return (
    <RackShell
      crumb="New run"
      actions={
        <Button variant="ghost" size="sm" render={<Link href="/library" />}>
          <FolderOpen size={14} strokeWidth={1.6} />
          <span className="min-w-0 truncate">Your runs</span>
        </Button>
      }
    >
      <IntakeForm readerConnected={readerAvailable()} />
    </RackShell>
  );
}
