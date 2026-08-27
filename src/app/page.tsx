import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { IntakeForm } from "@/components/intake/intake-form";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { RackShell } from "@/components/rack/shell";
import { EdgeCode, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { feedConfigured } from "@/lib/admirror/library-feed";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    return (
      <RackShell crumb="New run">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
            <div className="min-w-0">
              <Plate className="block">Competitor intelligence · live ads</Plate>
              <h1 className="mt-3 text-balance text-[30px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[42px]">
                Their live ads,
                <br />
                your next angle.
              </h1>
              <p className="mt-4 max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
                Choose the companies you want to follow. AdMirror reads their currently observed
                ads from the public Ad Library, keeps the creative attached, and turns the angle
                you select into original ads for your business.
              </p>

              <div className="mt-9 min-w-0">
                <div className="mb-2.5 flex min-w-0 items-center justify-between gap-3">
                  <Plate className="min-w-0 truncate">One frame per observed ad</Plate>
                  <EdgeCode className="shrink-0">ready</EdgeCode>
                </div>
                <div aria-hidden className="grid grid-cols-4 gap-px bg-film-rebate sm:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div
                      key={index}
                      className="emulsion relative flex aspect-[4/5] items-end justify-start p-1.5"
                    >
                      <EdgeCode className="opacity-45">
                        {String(index + 1).padStart(2, "0")}
                      </EdgeCode>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 max-w-[52ch] text-[11.5px] leading-relaxed text-muted-foreground">
                  Reach appears only where Meta publishes a range for an ad. Spend, clicks and
                  sales never appear because the public library does not publish them.
                </p>
              </div>
            </div>

            <div className="min-w-0">
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
      <IntakeForm readerConnected={feedConfigured()} />
    </RackShell>
  );
}
