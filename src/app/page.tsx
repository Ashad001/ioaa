import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { IntakeForm } from "@/components/intake/intake-form";
import { MarketBrief } from "@/components/intake/market-brief";
import { RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { readerAvailable } from "@/lib/admirror/library-feed";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    return (
      <RackShell crumb="New run">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,372px)] lg:items-start lg:gap-16 xl:gap-24">
            <MarketBrief />
            <div className="min-w-0 lg:pt-2">
              <SignInPanel />
            </div>
          </div>
        </div>
      </RackShell>
    );
  }

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
