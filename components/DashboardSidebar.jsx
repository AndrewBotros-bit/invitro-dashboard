"use client";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'expenses', label: 'Expenses', icon: '📋' },
  { id: 'profitability', label: 'Profitability', icon: '📈' },
  { id: 'cashflow', label: 'Cash Flow', icon: '🏦' },
  { id: 'insights', label: 'Insights', icon: '💡' },
];

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
}) {
  const visibleSections = SECTIONS.filter(s => canSeeTab(s.id));
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
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sections</p>
          <nav className="space-y-0.5">
            {visibleSections.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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

          {/* Company selector */}
          <div className="mt-6">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Portfolio</p>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setSelectedCompany(null); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  !selectedCompany
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                <span>Consolidated</span>
              </button>
              {companies.map(name => (
                <button
                  key={name}
                  onClick={() => { setSelectedCompany(name); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedCompany === name
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  style={selectedCompany === name ? { backgroundColor: `${colorMap[name]}15`, color: colorMap[name] } : {}}
                >
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[name] || '#94a3b8' }}></span>
                  <span>{name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-3 space-y-1">
          {canBreakdown('auditConsole') && (
            <a
              href="/audit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span className="text-base leading-none">🔍</span>
              <span>Audit Console</span>
            </a>
          )}
          {userName && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground truncate">{userName}</span>
              <button
                onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-border shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </>
  );
}
