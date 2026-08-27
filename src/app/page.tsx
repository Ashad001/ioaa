import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { IntakeForm } from "@/components/intake/intake-form";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { RackShell } from "@/components/rack/shell";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    return (
      <RackShell crumb="New run">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
          <div className="max-w-[52ch] text-center">
            <h1 className="text-balance text-[26px] font-medium leading-[1.15] tracking-[-0.025em] sm:text-[32px]">
              Their best angle, your ad.
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              Give us your website. AdMirror finds who&rsquo;s advertising against you, collects their live
              ads from the public Meta Ad Library, ranks them honestly, and turns the angle you pick into
              three original variants and a test plan.
            </p>
          </div>
          <SignInPanel />
        </div>
      </RackShell>
    );
  }

  return (
    <RackShell
      crumb="New run"
      actions={
        <Button variant="ghost" size="sm" render={<Link href="/library" />}><FolderOpen size={14} strokeWidth={1.6} />
            <span className="min-w-0 truncate">Your runs</span></Button>
      }
    >
      <IntakeForm />
    </RackShell>
  );
}
