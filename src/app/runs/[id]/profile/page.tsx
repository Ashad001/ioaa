import { notFound, redirect } from "next/navigation";

import { ApproveBar } from "@/components/profile/approve-bar";
import {
  CompanyPanel,
  type CompanyView,
  type FieldOption,
  type FieldView,
} from "@/components/profile/company-panel";
import { RivalList, type RivalCard, type SweptTermView } from "@/components/profile/rival-list";
import { PaneHeader, RackShell } from "@/components/rack/shell";
import { Panel, Readout } from "@/components/rack/plate";
import { ReaderStatus } from "@/components/run/reader-status";
import { RunNav } from "@/components/run/run-nav";
import { CATEGORIES } from "@/lib/admirror/category";
import { readerAvailable } from "@/lib/admirror/library-feed";
import {
  composeProfile,
  plannedTerms,
  readStored,
  type StoredCategory,
} from "@/lib/admirror/profile-build";
import { getCompetitors, getRun, getSteps } from "@/lib/admirror/queries";
import type { CompanyProfile } from "@/lib/admirror/profile";
import { getUser } from "@/lib/auth";

/**
 * STAGE 2 — YOUR COMPANY, YOUR FIELD, YOUR COMPETITORS.
 *
 * This screen exists because collection used to start the instant a run was
 * created: a homepage was read, words were derived, and those words were fired
 * at the ad reader as searches nobody had seen. Everything downstream was then
 * correct arithmetic over a list the user never agreed to.
 *
 * So the order is profile → field → rivals → approve, and approving is the ONLY
 * door to collection. Building the profile happens during render (offline and
 * deterministic, so the screen is never blank); the ad library is only read when
 * the user presses the lookup button.
 */

type RivalScan = {
  note?: string;
  unreadable?: boolean;
  terms?: SweptTermView[];
  setAside?: Array<{ name: string; reason: string }>;
  scannedAt?: string;
};

const PLACEHOLDER = /^(category leader|nearest challenger|attention competitor)$/i;

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const current = await getRun(id, user.id);
  if (!current) notFound();

  // Offline: the site read, the field reading, the proposed list. No ad library
  // call happens here, so opening this screen never spends a lookup.
  await composeProfile(current);

  const [fresh, steps, competitors] = await Promise.all([
    getRun(id, user.id),
    getSteps(id),
    getCompetitors(id),
  ]);
  if (!fresh) notFound();

  const stored = readStored(fresh.dossier);
  const profile = stored.profile as CompanyProfile | undefined;
  const category = stored.category as StoredCategory | undefined;
  const scan = (stored.rivalScan as RivalScan | undefined) ?? {};

  if (!profile || !category) notFound();

  const companyRead: CompanyView = {
    brandName: fresh.brandName,
    website: fresh.brandWebsite,
    marketLabel: fresh.marketLabel,
    summary: profile.summary,
    sells: profile.sells,
    audience: profile.audience,
    searchTerms: profile.searchTerms,
    basis: profile.basis,
    siteUnreadable: profile.siteUnreadable,
  };

  const fieldRead: FieldView = {
    id: category.id,
    field: category.field,
    label: category.label,
    note: category.note,
    matched: category.matched,
    neighbours: category.neighbours,
    uncertain: category.uncertain,
    chosenByYou: category.chosenByYou,
  };

  const rivals: RivalCard[] = competitors.map((row) => ({
    id: row.id,
    name: row.name,
    tier: row.tier,
    whyUseful: row.whyUseful,
    pruned: row.pruned,
    field: row.field,
    categoryLabel: row.categoryLabel,
    categoryRelation: row.categoryRelation,
    positioning: row.positioning,
    foundVia: row.foundVia,
    foundUnder: row.foundUnder,
    adsSeen: Number(row.adsSeen) || 0,
    displayLink: row.displayLink,
    reachBand: row.reachBand,
    profiled: Boolean(row.profiledAt),
    placeholder: PLACEHOLDER.test(row.name.trim()),
  }));

  const kept = rivals.filter((rival) => !rival.pruned);
  const profiled = kept.filter((rival) => rival.profiled).length;
  const withReach = kept.filter((rival) => rival.reachBand).length;

  const fieldOptions: FieldOption[] = CATEGORIES.map((entry) => ({
    id: entry.id,
    field: entry.field,
    label: entry.label,
  }));

  return (
    <RackShell
      crumb={
        <span className="min-w-0 truncate">
          {fresh.brandName} · {fresh.marketLabel}
        </span>
      }
      nav={<RunNav runId={id} steps={steps} activeStep="COMPETITOR_MAP" />}
    >
      <PaneHeader
        title="Your company, your field, your competitors"
        hint="Every line here is a reading you can correct. Nothing is collected until you approve it."
      />

      <ReaderStatus connected={readerAvailable()} context="start" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-w-0 gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <Panel label="Your company">
              <CompanyPanel
                runId={id}
                company={companyRead}
                field={fieldRead}
                fieldOptions={fieldOptions}
                locked={fresh.profileApproved}
              />
            </Panel>

            <Panel label="Who else advertises in this field">
              <RivalList
                runId={id}
                rivals={rivals}
                setAside={scan.setAside ?? []}
                terms={scan.terms ?? []}
                plannedTerms={plannedTerms(category, profile.searchTerms)}
                scanNote={scan.note ?? ""}
                scannedAt={scan.scannedAt ?? null}
                locked={fresh.profileApproved}
              />
              <ApproveBar runId={id} keptCount={kept.length} approved={fresh.profileApproved} />
            </Panel>
          </div>

          <div className="min-w-0 space-y-4">
            <Panel label="Where this stands">
              <div className="grid gap-3.5 px-4 py-4">
                <Readout label="Your field" value={fieldRead.field} hint={fieldRead.label} />
                <Readout
                  label="Companies on your list"
                  value={String(kept.length)}
                  hint={`${profiled} profiled from their own live ads`}
                />
                <Readout
                  label="With a reach figure"
                  value={withReach > 0 ? String(withReach) : "None yet"}
                  hint={
                    withReach > 0
                      ? "Meta published a range for these"
                      : "Meta publishes one on some ads only"
                  }
                />
                <Readout
                  label="Approved"
                  value={fresh.profileApproved ? "Yes" : "Not yet"}
                  hint={
                    fresh.profileApproved
                      ? "Collection can run"
                      : "Collection is held until you approve"
                  }
                />
              </div>
            </Panel>

            <Panel label="How the lookup works">
              <div className="px-4 py-4">
                <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-foreground/85">
                  Your website decides what field you&rsquo;re in. The lookup then searches the
                  public Ad Library under the words that whole field advertises with, plus the
                  categories next to it — so it finds companies selling what you sell, not just
                  companies phrasing things like you.
                </p>
                <p className="mt-2.5 max-w-[65ch] text-[12px] leading-relaxed text-muted-foreground">
                  Every company that comes back is profiled from their own live ads: what field
                  they read as, how they position themselves in their own words, and how many ads
                  came back. Meta publishes a reach range on some ads — where it exists you see the
                  range Meta gave, and where it doesn&rsquo;t the card says so instead of showing a
                  zero. No spend, click or result figures appear anywhere, because Meta publishes
                  none.
                </p>
                {scan.unreadable ? (
                  <p className="mt-2.5 max-w-[65ch] border-l-2 border-lamp-alert/60 pl-3 text-[12px] leading-relaxed text-muted-foreground">
                    The last lookup couldn&rsquo;t read a single search. That is a reading problem
                    on our side — not an empty field.
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </RackShell>
  );
}
