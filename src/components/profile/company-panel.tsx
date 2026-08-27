"use client";

/**
 * YOUR COMPANY AND YOUR FIELD — the reading, and the controls that overrule it.
 *
 * WHY BOTH LIVE IN ONE PANEL. Collection used to start the instant a run was
 * created: a homepage was read, words were derived, and those words were fired at
 * the ad reader as searches nobody had seen. Worse, the field is DERIVED from the
 * company reading and the field decides which vocabulary the rival lookup
 * searches — so separating them lets someone correct what they sell and never
 * notice the field still points elsewhere, producing a perfectly plausible list
 * of the wrong companies with nothing on screen to explain why.
 *
 * Every line here is labelled as a READING and every line is editable. Once the
 * list is approved the controls lock: changing what we believe the company is,
 * after collection has begun, would silently change what the board means.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, RotateCw, X } from "lucide-react";
import { toast } from "sonner";

import { buildCompanyProfile, saveProfileEdits, setCategory } from "@/app/actions/profile";
import { ProvenanceBadge } from "@/components/rack/metric";
import { EdgeCode, Lamp, Plate } from "@/components/rack/plate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryId } from "@/lib/admirror/category";

export type CompanyView = {
  brandName: string;
  website: string | null;
  marketLabel: string;
  summary: string;
  sells: string[];
  audience: string[];
  searchTerms: string[];
  basis: string;
  siteUnreadable: boolean;
};

export type FieldView = {
  id: CategoryId;
  field: string;
  label: string;
  note: string;
  matched: string[];
  neighbours: string[];
  uncertain: boolean;
  chosenByYou: boolean;
};

export type FieldOption = { id: CategoryId; field: string; label: string };

export function CompanyPanel({
  runId,
  company,
  field,
  fieldOptions,
  locked,
}: {
  runId: string;
  company: CompanyView;
  field: FieldView;
  fieldOptions: FieldOption[];
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [brandName, setBrandName] = useState(company.brandName);
  const [summary, setSummary] = useState(company.summary);
  const [sells, setSells] = useState(company.sells.join(", "));
  const [terms, setTerms] = useState(company.searchTerms.join(", "));

  const correctedByYou = company.basis === "Corrected by you.";

  const save = () => {
    startTransition(async () => {
      const result = await saveProfileEdits({
        runId,
        brandName,
        summary,
        sells: sells.split(",").map((entry) => entry.trim()).filter(Boolean),
        searchTerms: terms.split(",").map((entry) => entry.trim()).filter(Boolean),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      toast.success("Saved — the lookup follows your words now.");
      router.refresh();
    });
  };

  const reread = () => {
    startTransition(async () => {
      const result = await buildCompanyProfile({ runId, reread: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Read your website again.");
      router.refresh();
    });
  };

  const chooseField = (id: CategoryId) => {
    if (id === field.id) {
      setChoosing(false);
      return;
    }
    startTransition(async () => {
      const result = await setCategory({ runId, categoryId: id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChoosing(false);
      toast.success("Field changed — the next lookup searches that field's words.");
      router.refresh();
    });
  };

  return (
    <div className="min-w-0 space-y-4 px-4 py-4 sm:px-6">
      {editing ? (
        <div className="min-w-0 space-y-3.5">
          <div className="min-w-0">
            <Plate as="label" className="block">
              Company name
            </Plate>
            <Input
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="min-w-0">
            <Plate as="label" className="block">
              What you sell, and to whom
            </Plate>
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div className="min-w-0">
            <Plate as="label" className="block">
              What you sell — separate with commas
            </Plate>
            <Input
              value={sells}
              onChange={(event) => setSells(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="min-w-0">
            <Plate as="label" className="block">
              Your own words to search under
            </Plate>
            <Input
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              <Check size={14} strokeWidth={1.8} />
              <span className="min-w-0 truncate">Save</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              <X size={14} strokeWidth={1.8} />
              <span className="min-w-0 truncate">Cancel</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate text-[16px] tracking-[-0.01em] text-foreground">
                  {company.brandName}
                </h2>
                <ProvenanceBadge
                  provenance={correctedByYou ? "user_asserted" : "model_interpretation"}
                  detail={company.basis}
                />
              </div>
              <p className="mt-1.5 max-w-[65ch] text-[13.5px] leading-relaxed text-foreground/90">
                {company.summary}
              </p>
            </div>
            <EdgeCode className="shrink-0">{company.marketLabel}</EdgeCode>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Plate className="block">What you sell</Plate>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {company.sells.map((entry) => (
                  <span
                    key={entry}
                    className="min-w-0 max-w-full truncate border border-border bg-secondary/40 px-2 py-1 text-[12px] text-foreground/85"
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <Plate className="block">Who it&rsquo;s for</Plate>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {company.audience.map((entry) => (
                  <span
                    key={entry}
                    className="min-w-0 max-w-full truncate border border-border bg-secondary/40 px-2 py-1 text-[12px] text-foreground/85"
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="max-w-[65ch] text-[12px] leading-relaxed text-muted-foreground">
            {company.basis}
            {company.siteUnreadable
              ? " Correct it before you look anyone up — everything after this follows these words."
              : ""}
          </p>

          {!locked ? (
            <div className="flex min-w-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                <Pencil size={14} strokeWidth={1.7} />
                <span className="min-w-0 truncate">Correct this</span>
              </Button>
              {company.website ? (
                <Button size="sm" variant="ghost" onClick={reread} disabled={pending}>
                  <RotateCw size={14} strokeWidth={1.7} />
                  <span className="min-w-0 truncate">Read my site again</span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* ── YOUR FIELD ───────────────────────────────────────────────────── */}
      <div className="min-w-0 border-t border-border/70 pt-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <Plate className="min-w-0 truncate">Your field</Plate>
          <EdgeCode className="shrink-0">
            {field.chosenByYou ? "YOUR CHOICE" : field.uncertain ? "UNSURE" : "READ"}
          </EdgeCode>
        </div>

        <p className="mt-1.5 min-w-0 text-[14.5px] leading-snug text-foreground">
          {field.field} <span className="text-muted-foreground">·</span> {field.label}
        </p>
        <p className="mt-1.5 max-w-[65ch] text-[12.5px] leading-relaxed text-muted-foreground">
          {field.note}
        </p>

        {field.matched.length > 0 ? (
          <div className="mt-3 min-w-0">
            <Plate className="block">Matched on your own words</Plate>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {field.matched.map((word) => (
                <span
                  key={word}
                  className="min-w-0 max-w-full truncate border border-border bg-secondary/40 px-2 py-1 text-[12px] text-foreground/85"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {field.neighbours.length > 0 ? (
          <p className="mt-3 max-w-[65ch] text-[12px] leading-relaxed text-muted-foreground">
            Nearby fields the lookup also checks: {field.neighbours.join(" · ")} — different
            products, the same buyer and the same feed, so their ads are worth reading for format.
          </p>
        ) : null}

        {!locked ? (
          choosing ? (
            <div className="mt-3 min-w-0">
              <Plate className="block">Pick your field</Plate>
              <div className="mt-2 grid min-w-0 gap-1.5 sm:grid-cols-2">
                {fieldOptions.map((option) => {
                  const active = option.id === field.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={pending}
                      onClick={() => chooseField(option.id)}
                      className={
                        "flex min-w-0 items-center gap-2 border px-2.5 py-2 text-left transition-colors duration-150 ease-out disabled:opacity-60 " +
                        (active
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary/50")
                      }
                    >
                      <Lamp state={active ? "live" : "cold"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-foreground">
                          {option.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {option.field}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setChoosing(false)}
                disabled={pending}
              >
                <X size={14} strokeWidth={1.8} />
                <span className="min-w-0 truncate">Keep {field.label}</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setChoosing(true)}
              disabled={pending}
            >
              <Pencil size={14} strokeWidth={1.7} />
              <span className="min-w-0 truncate">Change my field</span>
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
