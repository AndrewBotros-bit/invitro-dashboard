/**
 * Portfolio company profiles — narrative content for the "About" panel on
 * drill-in views and the sidebar tooltip on the company picker.
 *
 * ─── HOW TO EDIT ──────────────────────────────────────────────────────────
 *
 * Just edit the strings below. After saving:
 *   - Local dev: `npm run dev` auto-reloads
 *   - Production: commit + push → Vercel rebuilds (~60s)
 *
 * Each company has:
 *   - tagline:     one-liner for tooltip + collapsed panel header
 *   - description: 2-4 paragraphs for the expanded panel (supports \n\n
 *                  for paragraph breaks; rendered as plain prose)
 *   - sector:      industry/category short label
 *   - foundedYear: founding year (number)
 *   - stage:       seed / Series A / etc.
 *   - links:       optional { website, deck } URLs
 *
 * NOTE: The descriptions below are AI-generated PLACEHOLDERS based on
 * what the data suggests (RX Count, SUs, Closed Jobs etc.). REPLACE WITH
 * REAL CONTENT — they're shipped only so the panel layout is testable.
 */

export const COMPANY_PROFILES = {
  AllRx: {
    tagline: 'Direct-to-patient prescription fulfillment',
    sector: 'Healthcare · Rx logistics',
    foundedYear: 2021,
    stage: 'Series A',
    description:
`AllRx is a direct-to-patient prescription fulfillment platform that
bypasses traditional retail pharmacy. Patients receive prescriptions via
mail with concierge support, optimized for chronic-care medications where
adherence and refill predictability matter most.

[PLACEHOLDER — replace with the real business model description.]

Key drivers: RX count (active patient base), ARPU (revenue per patient
per month), and refill rate.`,
    links: { website: null, deck: null },
  },

  AllCare: {
    tagline: 'AI-powered coordinated care for senior living',
    sector: 'Healthcare · Senior Living · AI',
    foundedYear: 2022,
    stage: 'Seed',
    description:
`AllCare.ai operates through a three-pillar coordinated care model built
at the intersection of AI and service for senior living communities.
The model combines dedicated Care Partners, an AI-powered Medical
Concierge, and integrated providers working together through one shared
care plan.

Care Partners serve as the central point of coordination for facilities,
the AI Concierge manages and tracks requests and follow-through in real
time, and providers deliver connected clinical care across primary care,
behavioral health, pharmacy coordination, diagnostics, and specialty
services.

Together, these three pillars reduce fragmentation, improve
communication and follow-through, and support better resident outcomes
while easing administrative burden on facilities.`,
    links: { website: null, deck: null },
  },

  Osta: {
    tagline: 'Skilled-trades staffing platform',
    sector: 'Staffing · Marketplace',
    foundedYear: 2023,
    stage: 'Seed',
    description:
`Osta is a marketplace matching skilled-trades workers with contractors
and homeowners on short-notice projects. Revenue is a take-rate on each
booked job; the business is sensitive to marketing efficiency (after-
marketing gross margin is the relevant unit economic).

[PLACEHOLDER — replace with the real business model description.]

Key drivers: closed jobs per period, average job value, and CAC payback.`,
    links: { website: null, deck: null },
  },

  Needles: {
    tagline: 'Mobile aesthetic injectables',
    sector: 'Healthcare · Aesthetics',
    foundedYear: 2024,
    stage: 'Pre-seed',
    description:
`Needles is an early-stage venture building a mobile aesthetic
injectables service. Practitioners visit clients at home or office for
routine treatments, packaged as memberships rather than one-off visits.

[PLACEHOLDER — replace with the real business model description.]`,
    links: { website: null, deck: null },
  },

  'InVitro Studio': {
    tagline: 'Venture studio building the portfolio companies',
    sector: 'Venture Studio',
    foundedYear: 2021,
    stage: 'Operating',
    description:
`InVitro Studio is the venture studio that ideates, builds, and scales
the portfolio companies (AllRx, AllCare, Osta, Needles, and others).
Studio costs are partially allocated to each portfolio company as the
"Studio Expense" line on their P&L, and partly retained at the studio
level for stage-zero work.

[PLACEHOLDER — replace with the real description of InVitro Studio's
role in the venture model.]`,
    links: { website: null, deck: null },
  },
};

/** Lookup helper — returns null if no profile exists for a name. */
export function getCompanyProfile(name) {
  return COMPANY_PROFILES[name] || null;
}
