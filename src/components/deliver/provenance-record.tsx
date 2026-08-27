/**
 * The provenance record — the audit trail that travels with the assets.
 *
 * One row per delivered asset: what it is, whose angle it inherited, when the
 * user saw that ad, and what a gate held back. A blocked asset appears here as
 * blocked; it is never quietly dropped so the table can look clean.
 */
import { ExternalLink, ShieldAlert } from "lucide-react";

import { Plate } from "@/components/rack/plate";
import type { ProvenanceLine } from "@/lib/admirror/deliver";

export function ProvenanceRecord({ lines }: { lines: ProvenanceLine[] }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {["Asset", "Kind", "Shared body", "Angle inherited from", "Seen", "Gate"].map((header) => (
              <th key={header} className="px-3 py-2 align-bottom">
                <Plate className="whitespace-nowrap">{header}</Plate>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.assetLabel}-${line.sharedBody}`} className="border-b border-border/50">
              <td className="max-w-[220px] px-3 py-2.5">
                <p className="truncate text-[12.5px] text-foreground/90">{line.assetLabel}</p>
                <p className="truncate text-[11px] text-muted-foreground">{line.angle}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-foreground/85">
                {line.assetKind}
                <span className="block text-[11px] text-muted-foreground">{line.format}</span>
              </td>
              <td className="tabular whitespace-nowrap px-3 py-2.5 text-[11.5px] text-muted-foreground">
                {line.sharedBody}
              </td>
              <td className="max-w-[220px] px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[12px] text-foreground/85">
                    {line.sourceAdvertiser}
                  </span>
                  {line.sourceLibraryUrl ? (
                    <a
                      href={line.sourceLibraryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary"
                      aria-label="Open the source ad in the Ad Library"
                    >
                      <ExternalLink size={11} strokeWidth={1.8} />
                    </a>
                  ) : null}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Angle only — none of their media, voice or marks
                </span>
              </td>
              <td className="tabular whitespace-nowrap px-3 py-2.5 text-[11.5px] text-muted-foreground">
                {line.observedAt}
              </td>
              <td className="max-w-[260px] px-3 py-2.5">
                {line.blockedBy ? (
                  <span className="flex min-w-0 items-start gap-1.5">
                    <ShieldAlert
                      size={12}
                      strokeWidth={1.7}
                      className="mt-0.5 shrink-0 text-lamp-alert"
                    />
                    <span className="min-w-0 text-[11.5px] leading-relaxed text-lamp-alert">
                      Held back
                    </span>
                  </span>
                ) : (
                  <span className="text-[11.5px] text-muted-foreground">Cleared</span>
                )}
                {line.warnings.length > 0 ? (
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {line.warnings.length} thing{line.warnings.length === 1 ? "" : "s"} to eyeball
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
