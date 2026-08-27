"use client";

/**
 * S3-B — the capture composer. The single highest-leverage interaction in v1.
 *
 * Someone alt-tabbing between the Ad Library and AdMirror will submit dozens of
 * screenshots if attaching one is a keystroke, and four ads if it opens a file
 * dialog. So: ⌘/Ctrl+V anywhere on the page attaches whatever is on the
 * clipboard — an image becomes an artefact, text becomes the ad copy, a Library
 * URL becomes the link. Enter commits. Nothing steals focus while you type.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ClipboardPaste, ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { startEvidenceUpload, submitEvidence } from "@/app/actions/evidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Kbd } from "@/components/ui/kbd";
import { Plate } from "@/components/rack/plate";
import { PLATFORM_LABELS } from "@/lib/admirror/ad-library";
import { cn } from "@/lib/utils";

const PLATFORM_KEYS = Object.keys(PLATFORM_LABELS);

const EMPTY = {
  advertiser: "",
  libraryUrl: "",
  headline: "",
  bodyCopy: "",
  ctaLabel: "",
  visibleStartDate: "",
  visibleResultRank: "",
  activeStatus: "unknown",
  notes: "",
};

function isLibraryUrl(text: string) {
  return /facebook\.com\/ads\/library/i.test(text.trim());
}

export function CaptureComposer({
  runId,
  searchReferenceId,
  searchLabel,
  market,
  language,
  itemCount,
}: {
  runId: string;
  searchReferenceId: string | null;
  searchLabel: string | null;
  market: string;
  language: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(EMPTY);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [observedFields, setObservedFields] = useState<string[]>([]);
  const [artefact, setArtefact] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const target = await startEvidenceUpload({
          runId,
          filename: file.name || "capture.png",
          contentType: file.type,
          size: file.size,
        });
        const response = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("The upload didn't complete.");
        setArtefact({ url: target.publicUrl, type: file.type, name: file.name || "capture.png" });
        setFlash(true);
        window.setTimeout(() => setFlash(false), 600);
        toast.success("Screenshot attached. Fill in what it shows and press Enter.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That upload didn't work.");
      } finally {
        setUploading(false);
      }
    },
    [runId],
  );

  // ⌘V / Ctrl+V anywhere on the page. Skipped when the paste lands in a field the
  // user is already typing in — that paste belongs to the field.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const items = event.clipboardData?.items;
      const imageItem = items
        ? Array.from(items).find((item) => item.type.startsWith("image/"))
        : undefined;

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          event.preventDefault();
          void uploadFile(file);
          return;
        }
      }

      if (inField) return;

      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;

      event.preventDefault();
      if (isLibraryUrl(text)) {
        set("libraryUrl", text);
        toast.success("Link attached to this item.");
      } else if (text.length < 90) {
        set("headline", text);
        toast.success("Headline filled from the clipboard.");
      } else {
        set("bodyCopy", text);
        toast.success("Ad copy filled from the clipboard.");
      }
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFile]);

  const commit = useCallback(() => {
    startTransition(async () => {
      const result = await submitEvidence({
        runId,
        searchReferenceId,
        intakeKind: artefact
          ? artefact.type.startsWith("video/")
            ? "recording"
            : "screenshot"
          : fields.libraryUrl
            ? "url"
            : fields.bodyCopy || fields.headline
              ? "text"
              : "manual",
        advertiser: fields.advertiser,
        libraryUrl: fields.libraryUrl,
        headline: fields.headline,
        bodyCopy: fields.bodyCopy,
        ctaLabel: fields.ctaLabel,
        platforms,
        activeStatus: fields.activeStatus,
        visibleStartDate: fields.visibleStartDate,
        visibleResultRank: fields.visibleResultRank,
        market,
        language,
        observedAt: new Date().toISOString(),
        artefactUrl: artefact?.url ?? null,
        artefactType: artefact?.type ?? null,
        notes: fields.notes,
        observedFields,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFields(EMPTY);
      setPlatforms([]);
      setObservedFields([]);
      setArtefact(null);
      toast.success(`Item ${itemCount + 1} captured.`);
      router.refresh();
    });
  }, [
    artefact,
    fields,
    itemCount,
    language,
    market,
    observedFields,
    platforms,
    router,
    runId,
    searchReferenceId,
    startTransition,
  ]);

  // Enter commits from anywhere except a textarea (where it means a new line).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "BODY";
      // Enter already means "activate" on a button, link or select, and means
      // "new line" in a textarea. Committing on top of that steals the keystroke.
      if (tag !== "INPUT" && tag !== "BODY") return;
      if (target instanceof HTMLInputElement && target.type === "file") return;
      if (pending) return;
      event.preventDefault();
      commit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, pending]);

  const markObserved = (field: string) =>
    setObservedFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );

  const observedToggle = (field: string, label: string) => (
    <button
      type="button"
      onClick={() => markObserved(field)}
      disabled={!artefact}
      title={
        artefact
          ? "Mark this as visible in the screenshot you attached"
          : "Attach a screenshot to mark a field as observed"
      }
      className={cn(
        "plate shrink-0 rounded-[3px] border px-1.5 py-[3px] transition-colors duration-150 ease-out",
        observedFields.includes(field)
          ? "border-lamp-live/50 bg-lamp-live/15 text-lamp-live"
          : "border-border text-rack-engrave hover:text-foreground",
        !artefact && "opacity-40",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col transition-shadow duration-300 ease-out lg:flex-[3]",
        flash && "shadow-[inset_0_0_0_1px_var(--primary)]",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <Plate className="min-w-0 truncate">
          {searchLabel ? `Capturing · ${searchLabel}` : "Capturing · no search selected"}
        </Plate>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Kbd>⌘V</Kbd>
          <span>attach</span>
          <Kbd>↵</Kbd>
          <span>commit</span>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* Artefact well */}
          <div className="min-w-0">
            <Plate className="block">Artefact</Plate>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadFile(file);
              }}
              className={cn(
                "mt-2 flex aspect-[4/5] min-w-0 flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-3 text-center transition-colors duration-200 ease-out",
                artefact ? "border-lamp-live/45 bg-lamp-live/[0.06]" : "border-rack-seam bg-rack-rail/60",
              )}
            >
              {uploading ? (
                <>
                  <Upload size={17} strokeWidth={1.5} className="animate-pulse text-primary" />
                  <p className="text-[12px] text-muted-foreground">Attaching…</p>
                </>
              ) : artefact ? (
                <>
                  <Check size={17} strokeWidth={1.8} className="text-lamp-live" />
                  <p className="min-w-0 max-w-full truncate text-[12px] text-foreground">{artefact.name}</p>
                  <p className="text-[11px] text-muted-foreground">Scan cleared</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      setArtefact(null);
                      setObservedFields([]);
                    }}
                  >
                    <Trash2 size={13} strokeWidth={1.6} />
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <ClipboardPaste size={18} strokeWidth={1.5} className="text-rack-seam" />
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Paste a screenshot with <Kbd>⌘V</Kbd> — anywhere on this page.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                    <ImagePlus size={13} strokeWidth={1.6} />
                    Or choose a file
                  </Button>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/mp4,video/webm"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Capture checklist */}
          <div className="min-w-0 space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label htmlFor="advertiser">Advertiser</Label>
                  {observedToggle("advertiser", "obs")}
                </div>
                <Input
                  id="advertiser"
                  value={fields.advertiser}
                  onChange={(e) => set("advertiser", e.target.value)}
                  placeholder="Page name as shown"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="library-url">Ad Library link</Label>
                <Input
                  id="library-url"
                  value={fields.libraryUrl}
                  onChange={(e) => set("libraryUrl", e.target.value)}
                  placeholder="Paste the ad's link"
                  className="font-mono text-[12px]"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Label htmlFor="headline">Headline</Label>
                {observedToggle("headline", "obs")}
              </div>
              <Input
                id="headline"
                value={fields.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="The first line of the ad"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Label htmlFor="body">Ad copy</Label>
                {observedToggle("bodyCopy", "obs")}
              </div>
              <Textarea
                id="body"
                value={fields.bodyCopy}
                onChange={(e) => set("bodyCopy", e.target.value)}
                rows={3}
                placeholder="Paste the body text"
                className="resize-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label htmlFor="start">Visible start date</Label>
                  {observedToggle("visibleStartDate", "obs")}
                </div>
                <Input
                  id="start"
                  type="date"
                  value={fields.visibleStartDate}
                  onChange={(e) => set("visibleStartDate", e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label htmlFor="rank">Result position</Label>
                  {observedToggle("visibleResultRank", "obs")}
                </div>
                <Input
                  id="rank"
                  type="number"
                  min={1}
                  value={fields.visibleResultRank}
                  onChange={(e) => set("visibleResultRank", e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label htmlFor="status">Status shown</Label>
                  {observedToggle("activeStatus", "obs")}
                </div>
                <select
                  id="status"
                  value={fields.activeStatus}
                  onChange={(e) => set("activeStatus", e.target.value)}
                  className="h-9 w-full min-w-0 rounded-sm border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <option value="unknown">Not captured</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cta">CTA button</Label>
                <Input
                  id="cta"
                  value={fields.ctaLabel}
                  onChange={(e) => set("ctaLabel", e.target.value)}
                  placeholder="Shop now"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label>Platforms shown</Label>
                  {observedToggle("platforms", "obs")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_KEYS.map((key) => {
                    const active = platforms.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setPlatforms((current) =>
                            current.includes(key)
                              ? current.filter((item) => item !== key)
                              : [...current, key],
                          )
                        }
                        className={cn(
                          "plate min-w-0 rounded-[3px] border px-2 py-1.5 transition-colors duration-150 ease-out",
                          active
                            ? "border-primary/55 bg-primary/12 text-foreground"
                            : "border-border text-rack-engrave hover:text-foreground",
                        )}
                      >
                        {PLATFORM_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Anything you leave blank stays &ldquo;not captured&rdquo; — AdMirror won&rsquo;t fill it with a
              guess. Mark a field <span className="text-lamp-live">obs</span> when your screenshot actually
              shows it; otherwise it&rsquo;s recorded as entered by you.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border px-4 py-3">
        <Button onClick={commit} disabled={pending || uploading} className="shrink-0">
          {pending ? "Committing…" : "Commit item"}
          <Kbd className="ml-1">↵</Kbd>
        </Button>
        <p className="min-w-0 text-xs text-muted-foreground">
          {itemCount} in this capture. Keep going — paste, fill, Enter.
        </p>
      </div>
    </div>
  );
}
