"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCompanyProfile } from "@/lib/companyProfiles";

/**
 * "About [Company]" panel rendered at the top of drill-in views.
 *
 * Collapsed by default — shows just the tagline + an expand arrow. This
 * keeps the financial data visually dominant while putting context one
 * click away. Click expands to reveal the full description + key facts.
 *
 * Renders nothing when no company is selected or no profile exists for
 * the given name, so callers can drop it in without guarding the company
 * prop themselves.
 */
export function CompanyAboutPanel({ companyName, accentColor }) {
  const [expanded, setExpanded] = useState(false);
  const profile = getCompanyProfile(companyName);
  if (!companyName || !profile) return null;

  return (
    <Card className="mb-5 border-border/60">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Accent stripe in the company's brand color — visual anchor
                tying the panel to the company you've drilled into. */}
            <span
              className="inline-block w-1 self-stretch rounded-full shrink-0"
              style={{ backgroundColor: accentColor || '#94a3b8', minHeight: 32 }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                About {companyName}
              </p>
              <p className="text-sm font-medium text-foreground truncate">{profile.tagline}</p>
            </div>
          </div>
          <span className={cn(
            "text-muted-foreground transition-transform text-sm shrink-0",
            expanded && "rotate-180"
          )} aria-hidden="true">▾</span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-2 border-t border-border/40 space-y-3">
            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
              {profile.description}
            </p>

            {/* Key facts — small, comma-separated, neutral */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {profile.sector && (
                <span><strong className="text-foreground font-semibold">Sector:</strong> {profile.sector}</span>
              )}
              {profile.foundedYear && (
                <span><strong className="text-foreground font-semibold">Founded:</strong> {profile.foundedYear}</span>
              )}
              {profile.stage && (
                <span><strong className="text-foreground font-semibold">Stage:</strong> {profile.stage}</span>
              )}
            </div>

            {(profile.links?.website || profile.links?.deck) && (
              <div className="flex gap-4">
                {profile.links.website && (
                  <a href={profile.links.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline">Website ↗</a>
                )}
                {profile.links.deck && (
                  <a href={profile.links.deck} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline">Deck ↗</a>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
