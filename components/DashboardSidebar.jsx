"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { getCompanyProfile } from "@/lib/companyProfiles";

// Sentinel used to track which picker row is expanded. We can't reuse
// `selectedCompany` because we need to allow "selected but collapsed" — the
// user may want to hide the tab dropdown without deselecting the company.
const CONSOLIDATED_KEY = '__consolidated__';

// Top-level groups. Investment Performance covers vehicle/LP-level analysis
// (portfolio-agnostic); Portfolio Performance drills into a specific company.
//
// Mental model: the operating tabs (Overview, Revenue, etc.) are NOT siblings
// of the company picker — they're children. Clicking a company expands its
// tabs as a nested dropdown. This makes "I'm drilled into AllRx, looking at
// Revenue" one nested selection instead of two independent ones.
const INVESTMENT_TABS = [
  { id: 'irr', label: 'IRR & Valuation', icon: '📈' },
];

const PORTFOLIO_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'expenses', label: 'Expenses', icon: '📋' },
  { id: 'profitability', label: 'Profitability', icon: '📈' },
  { id: 'cashflow', label: 'Cash Flow', icon: '🏦' },
  { id: 'insights', label: 'Insights', icon: '💡' },
];

// Sections that don't use the company picker. Used by the auto-switch:
// clicking a company while on one of these sections also switches to a
// portfolio-aware tab so the click has a visible consequence.
const PICKER_AGNOSTIC_SECTIONS = new Set(['irr']);
const FALLBACK_PORTFOLIO_TAB = 'overview';

// Shared button styles. min-h-[44px] on mobile (Apple HIG); dense desktop.
const NAV_BUTTON_BASE =
  "w-full flex items-center gap-2.5 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] md:min-h-0 md:py-2 py-2.5";

// Sub-nav (nested tabs under a selected company). Slightly tighter and
// smaller to communicate hierarchy.
const SUB_NAV_BUTTON =
  "w-full flex items-center gap-2.5 px-3 rounded-md text-[13px] font-medium transition-colors min-h-[40px] md:min-h-0 md:py-1.5 py-2";

export default function DashboardSidebar({
  activeSection,
  setActiveSection,
  selectedCompany,
  setSelectedCompany,
  companies,
  colorMap,
  lastActualLabel,
  sidebarOpen,
  setSidebarOpen,
  canSeeTab = () => true,
  canBreakdown = () => true,
  userName,
  userRole,
}) {
  const visibleInvestmentTabs = INVESTMENT_TABS.filter(s => canSeeTab(s.id));
  const visiblePortfolioTabs = PORTFOLIO_TABS.filter(s => canSeeTab(s.id));
  const showPortfolioGroup = visiblePortfolioTabs.length > 0;

  // Which picker row is currently disclosed (showing its nested tabs).
  // Decoupled from selectedCompany so the user can collapse the dropdown
  // without losing their company selection. Initial value matches the
  // selected company so tabs are visible on first paint.
  const [expandedKey, setExpandedKey] = useState(
    () => selectedCompany ?? CONSOLIDATED_KEY
  );

  // Picker click. Three cases:
  //  (a) clicking an already-expanded row → collapse it (toggle off)
  //  (b) clicking a different row → select that company AND expand its tabs
  //  (c) clicking from a picker-agnostic section (IRR) → also switch
  //      activeSection to a portfolio tab so the click has a visible effect
  const handlePickerClick = (companyName) => {
    const key = companyName ?? CONSOLIDATED_KEY;

    if (expandedKey === key) {
      // (a) toggle off — keep selection, just hide the dropdown
      setExpandedKey(null);
      return;
    }

    // (b) switch selection and expand
    setSelectedCompany(companyName);
    setExpandedKey(key);

    // (c) auto-switch away from picker-agnostic sections
    if (PICKER_AGNOSTIC_SECTIONS.has(activeSection)) {
      const fallback = visiblePortfolioTabs.find(t => t.id === FALLBACK_PORTFOLIO_TAB)
        || visiblePortfolioTabs[0];
      if (fallback) setActiveSection(fallback.id);
    }
    setSidebarOpen(false);
  };

  const handleTabClick = (sectionId) => {
    setActiveSection(sectionId);
    setSidebarOpen(false);
  };

  // Renders the nested operating tabs under whichever company is currently
  // selected (Consolidated when selectedCompany === null).
  const renderNestedTabs = () => (
    <div className="ml-3 mt-1 mb-2 border-l border-border/50 pl-2 space-y-0.5">
      {visiblePortfolioTabs.map(s => (
        <button
          key={s.id}
          onClick={() => handleTabClick(s.id)}
          className={cn(
            SUB_NAV_BUTTON,
            activeSection === s.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <span className="text-sm leading-none">{s.icon}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-border flex flex-col transition-transform duration-200",
        "md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header / Logo — uses the brand icon (two chevrons) + wordmark.
            Icon comes from <Logo>; the wordmark text below carries the
            dynamic "Actuals till ..." subtitle so this section serves
            both as branding AND as a data-freshness indicator. */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground leading-tight">InVitro Capital</p>
              <p className="text-[10px] text-muted-foreground">{lastActualLabel}</p>
            </div>
          </div>
        </div>

        {/* Navigation sections */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Group 1: Investment Performance */}
          {visibleInvestmentTabs.length > 0 && (
            <div>
              <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Investment Performance
              </p>
              <nav className="space-y-0.5">
                {visibleInvestmentTabs.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleTabClick(s.id)}
                    className={cn(
                      NAV_BUTTON_BASE,
                      activeSection === s.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="text-base leading-none">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Group separator */}
          {visibleInvestmentTabs.length > 0 && showPortfolioGroup && (
            <div className="mx-2 my-4 border-t border-border" />
          )}

          {/* Group 2: Portfolio Performance.
              The picker doubles as a tree: the selected company expands
              inline to reveal its operating tabs as nested sub-items. */}
          {showPortfolioGroup && (
            <div>
              <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Portfolio Performance
              </p>

              <nav className="space-y-0.5">
                {/* Consolidated row + (when expanded) its nested tabs */}
                {(() => {
                  const isSelected = !selectedCompany;
                  const isExpanded = expandedKey === CONSOLIDATED_KEY;
                  return (
                    <div>
                      <button
                        onClick={() => handlePickerClick(null)}
                        className={cn(
                          NAV_BUTTON_BASE,
                          isSelected
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        aria-expanded={isExpanded}
                      >
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          isSelected ? "bg-primary" : "bg-muted-foreground/40"
                        )} />
                        <span>Consolidated</span>
                        <Chevron expanded={isExpanded} />
                      </button>
                      {isExpanded && renderNestedTabs()}
                    </div>
                  );
                })()}

                {/* Per-company rows + (for the expanded one) nested tabs */}
                {companies.map(name => {
                  const isSelected = selectedCompany === name;
                  const isExpanded = expandedKey === name;
                  return (
                    <div key={name}>
                      <button
                        onClick={() => handlePickerClick(name)}
                        className={cn(
                          NAV_BUTTON_BASE,
                          isSelected
                            ? "font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        style={isSelected ? { color: colorMap[name] } : undefined}
                        aria-expanded={isExpanded}
                        // Native title tooltip: shows on hover (desktop)
                        // and on long-press (mobile via OS). Tagline from
                        // lib/companyProfiles.js → drill in for the full
                        // "About" panel.
                        title={getCompanyProfile(name)?.tagline || undefined}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: colorMap[name] || '#94a3b8' }}
                        />
                        <span>{name}</span>
                        <Chevron expanded={isExpanded} />
                      </button>
                      {isExpanded && renderNestedTabs()}
                    </div>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Footer — three zones with explicit dividers:
            (1) admin tools, (2) user identity + logout */}
        <div className="border-t border-border">
          {(canBreakdown('auditConsole') || userRole === 'admin') && (
            <div className="px-3 pt-3 pb-1 space-y-0.5">
              {canBreakdown('auditConsole') && (
                <a
                  href="/audit"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <span className="text-base leading-none">🔍</span>
                  <span>Audit Console</span>
                </a>
              )}
              {userRole === 'admin' && (
                <a
                  href="/admin/users"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <span className="text-base leading-none">👥</span>
                  <span>User Management</span>
                </a>
              )}
            </div>
          )}

          {userName && (
            <div className="px-5 py-3 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{userName}</p>
                  {userRole && (
                    <p className="text-[10px] text-muted-foreground capitalize">{userRole}</p>
                  )}
                </div>
                <button
                  onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-11 w-11 items-center justify-center rounded-lg bg-white border border-border shadow-sm"
        aria-label="Toggle sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </>
  );
}

/** Subtle disclosure chevron — rotates 180° when its row is expanded. */
function Chevron({ expanded }) {
  return (
    <svg
      className={cn(
        "ml-auto h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-200",
        expanded && "rotate-180"
      )}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
