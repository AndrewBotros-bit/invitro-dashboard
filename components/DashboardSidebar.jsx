"use client";
import { cn } from "@/lib/utils";

// Top-level groups. "Investment Performance" deals with vehicles/LPs and
// is portfolio-agnostic (the company picker doesn't apply). "Portfolio
// Performance" drills into a specific company via the picker shown
// alongside its tabs.
//
// Investment Performance currently has only IRR & Valuation, so it renders
// as a single promoted item at the top with no group label — adding a
// group header for one item would feel orphaned. Portfolio Performance
// keeps its label since it contains a picker + 6 tabs.
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

// Active sections that ignore the company picker. When one of these is
// active, the picker dims and goes inert — preventing silent state mutation
// (clicking AllRx on IRR would otherwise change selectedCompany invisibly,
// surprising the user when they next visit a tab that uses it).
const PICKER_AGNOSTIC_SECTIONS = new Set(['irr']);

// Shared button class — gives 44px+ minimum height on mobile (Apple HIG)
// while keeping desktop dense at ~36px.
const NAV_BUTTON_BASE =
  "w-full flex items-center gap-2.5 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] md:min-h-0 md:py-2 py-2.5";

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
  const pickerInert = PICKER_AGNOSTIC_SECTIONS.has(activeSection);

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
        {/* Header / Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-white shadow-sm">IV</div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground leading-tight">InVitro Capital</p>
              <p className="text-[10px] text-muted-foreground">{lastActualLabel}</p>
            </div>
          </div>
        </div>

        {/* Navigation sections */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Investment Performance — promoted standalone (no group label since
              there's only one item; a header for one item feels orphaned). */}
          {visibleInvestmentTabs.length > 0 && (
            <nav className="space-y-0.5">
              {visibleInvestmentTabs.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
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
          )}

          {/* Group separator — only when both groups visible */}
          {visibleInvestmentTabs.length > 0 && showPortfolioGroup && (
            <div className="mx-2 my-4 border-t border-border" />
          )}

          {/* Portfolio Performance — company picker + drill-in tabs */}
          {showPortfolioGroup && (
            <div>
              <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Portfolio Performance
              </p>

              {/* Company picker — dims and goes inert on picker-agnostic
                  sections to communicate "filter doesn't apply here" and
                  prevent silent state mutation. */}
              <div
                className={cn(
                  "transition-opacity duration-200",
                  pickerInert && "opacity-40 pointer-events-none"
                )}
                aria-disabled={pickerInert}
                title={pickerInert ? "Company filter does not apply to this view" : undefined}
              >
                <nav className="space-y-0.5 mb-3">
                  <button
                    onClick={() => { setSelectedCompany(null); }}
                    className={cn(
                      NAV_BUTTON_BASE,
                      !selectedCompany
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      !selectedCompany ? "bg-primary" : "bg-muted-foreground/40"
                    )} />
                    <span>Consolidated</span>
                  </button>
                  {companies.map(name => {
                    const isSelected = selectedCompany === name;
                    return (
                      <button
                        key={name}
                        onClick={() => { setSelectedCompany(name); }}
                        className={cn(
                          NAV_BUTTON_BASE,
                          isSelected
                            ? "font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        style={isSelected ? { color: colorMap[name] } : undefined}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: colorMap[name] || '#94a3b8' }}
                        />
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Subtle divider between picker and tabs — same group, different role */}
              <div className="mx-2 my-2 border-t border-border/40" />

              {/* Drill-in tabs — operate on whichever company is selected above */}
              <nav className="space-y-0.5">
                {visiblePortfolioTabs.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
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
        </div>

        {/* Footer — three zones with explicit dividers:
            (1) admin tools, (2) user identity + logout */}
        <div className="border-t border-border">
          {/* Zone 1: admin tools (only renders if user has access) */}
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

          {/* Zone 2: user identity + logout */}
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

      {/* Mobile toggle button */}
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
