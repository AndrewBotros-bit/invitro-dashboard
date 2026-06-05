"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────

// 'Consolidated' is treated as a special pseudo-company in the permissions
// list — admin grants/revokes it like any portfolio company. When granted,
// the user sees the "Consolidated" view in the sidebar; without it, the
// view is hidden. For LP users, this is the ONLY entry from this list that
// has effect — their portfolio companies are auto-derived from their
// vehicle's investments at runtime (see Dashboard.jsx).
const CONSOLIDATED_PSEUDO = 'Consolidated';
// 'AllRx External' is a parallel entity sourced from the "AllRx P&L External"
// and "AllRx Cashflow External" tabs. Granting *only* 'AllRx External' to a
// user makes them see the external numbers labeled as plain "AllRx" — they
// don't know they're seeing the external view. Granting *both* shows them
// as separate companies (admin/internal view). Consolidated always rolls up
// the internal "AllRx" entry.
const ALLRX_EXTERNAL_PSEUDO = 'AllRx External';
const ALL_COMPANIES = ['AllRx', ALLRX_EXTERNAL_PSEUDO, 'AllCare', 'Osta', 'Needles', 'InVitro Studio', CONSOLIDATED_PSEUDO];
const ALL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'irr', label: 'IRR & Valuation' },
  { id: 'insights', label: 'Insights' },
];
// Per-company drilldown permissions — each gates a click-to-drill drawer
// somewhere in the dashboard. Same shape as boolean OR array of companies.
// Field names (modeField/listField) are colocated so the render loop can
// look them up directly instead of branching on key.
const DRILL_BREAKDOWNS = [
  { key: 'revenueDrilldown', label: 'Revenue drill-down', modeField: 'bd_revenue_mode', listField: 'bd_revenue_list' },
  { key: 'expenseDrilldown', label: 'Expense drill-down', modeField: 'bd_expense_mode', listField: 'bd_expense_list' },
  { key: 'gpDrilldown',      label: 'Gross Profit drill-down', modeField: 'bd_gp_mode', listField: 'bd_gp_list' },
];

// Avatar palette — deterministic color per username based on a string hash.
// Keeps the visual identity stable across sessions (same user → same color).
const AVATAR_PALETTE = [
  ['bg-blue-100',    'text-blue-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-amber-100',   'text-amber-700'],
  ['bg-violet-100',  'text-violet-700'],
  ['bg-rose-100',    'text-rose-700'],
  ['bg-cyan-100',    'text-cyan-700'],
  ['bg-indigo-100',  'text-indigo-700'],
  ['bg-pink-100',    'text-pink-700'],
];
function avatarColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initials(name = '') {
  return name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

// Role presets — selecting one populates form fields. Admin can still
// customize after. These are "starting points," not locked rules.
const ROLE_PRESETS = {
  'Admin (full access)': {
    role: 'admin',
    companies_mode: 'all', companies_list: [],
    tabs_mode: 'all', tabs_list: [],
    bd_revenue_mode: 'all', bd_revenue_list: [],
    bd_expense_mode: 'all', bd_expense_list: [],
    bd_gp_mode: 'all', bd_gp_list: [],
    bd_audit: true, bd_hc: true, bd_shareholder: true, bd_expenseGL: true,
    lpName: '',
  },
  'Board Member (read-only consolidated)': {
    role: 'viewer',
    companies_mode: 'all', companies_list: [],
    tabs_mode: 'subset', tabs_list: ['overview', 'irr', 'insights'],
    bd_revenue_mode: 'none', bd_revenue_list: [],
    bd_expense_mode: 'none', bd_expense_list: [],
    bd_gp_mode: 'none', bd_gp_list: [],
    bd_audit: false, bd_hc: false, bd_shareholder: false, bd_expenseGL: false,
    lpName: '',
  },
  'LP (IRR only — set lpName after)': {
    role: 'viewer',
    companies_mode: 'all', companies_list: [],
    tabs_mode: 'subset', tabs_list: ['irr'],
    bd_revenue_mode: 'none', bd_revenue_list: [],
    bd_expense_mode: 'none', bd_expense_list: [],
    bd_gp_mode: 'none', bd_gp_list: [],
    bd_audit: false, bd_hc: false, bd_shareholder: false, bd_expenseGL: false,
    lpName: '',
  },
  'Operator (single company — set companies after)': {
    role: 'viewer',
    companies_mode: 'subset', companies_list: [],
    tabs_mode: 'all', tabs_list: [],
    bd_revenue_mode: 'all', bd_revenue_list: [],
    bd_expense_mode: 'all', bd_expense_list: [],
    bd_gp_mode: 'all', bd_gp_list: [],
    bd_audit: false, bd_hc: true, bd_shareholder: false, bd_expenseGL: true,
    lpName: '',
  },
  // Hybrid case: someone who operates a portfolio company AND has a stake
  // in one or more vehicles (e.g. Amir Barsoum runs a portco AND is an LP
  // in Barsoum Brothers / Curenta / InVitro Ventures). Same as Operator
  // but admin should also set LP Identity below — that's what gives the
  // IRR view its LP-scoped filter.
  'LP + Operator (set companies + LP Identity after)': {
    role: 'viewer',
    companies_mode: 'subset', companies_list: [],
    tabs_mode: 'all', tabs_list: [],
    bd_revenue_mode: 'all', bd_revenue_list: [],
    bd_expense_mode: 'all', bd_expense_list: [],
    bd_gp_mode: 'all', bd_gp_list: [],
    bd_audit: false, bd_hc: true, bd_shareholder: false, bd_expenseGL: true,
    lpName: '',
  },
};

const EMPTY_FORM = {
  username: '', name: '', email: '', password: '', role: 'viewer',
  companies_mode: 'all', companies_list: [],
  tabs_mode: 'all', tabs_list: [],
  bd_revenue_mode: 'all', bd_revenue_list: [],
  bd_expense_mode: 'all', bd_expense_list: [],
  bd_gp_mode: 'all', bd_gp_list: [],
  // bd_expenseGL gates Layer 2 of the expense drilldown (GL detail).
  // Default false — admins explicitly opt-in (privacy-by-default).
  bd_audit: false, bd_hc: false, bd_shareholder: false, bd_expenseGL: false,
  lpName: '',
};

// ─── Form ↔ Payload mapping (unchanged from previous version) ──────────────

function userToFormState(u) {
  const p = u.permissions || {};
  const form = { ...EMPTY_FORM, username: u.username, name: u.name, email: u.email || '', password: '', role: u.role || 'viewer' };
  if (p.companies === '*') form.companies_mode = 'all';
  else if (Array.isArray(p.companies)) { form.companies_mode = 'subset'; form.companies_list = p.companies; }
  if (p.tabs === '*') form.tabs_mode = 'all';
  else if (Array.isArray(p.tabs)) { form.tabs_mode = 'subset'; form.tabs_list = p.tabs; }
  if (p.breakdowns === '*') {
    form.bd_revenue_mode = 'all'; form.bd_expense_mode = 'all'; form.bd_gp_mode = 'all';
    form.bd_audit = true; form.bd_hc = true; form.bd_shareholder = true; form.bd_expenseGL = true;
  } else if (p.breakdowns) {
    const rv = p.breakdowns.revenueDrilldown;
    if (rv === true) form.bd_revenue_mode = 'all';
    else if (rv === false || rv == null) form.bd_revenue_mode = 'none';
    else if (Array.isArray(rv)) { form.bd_revenue_mode = 'subset'; form.bd_revenue_list = rv; }
    const ex = p.breakdowns.expenseDrilldown;
    if (ex === true) form.bd_expense_mode = 'all';
    else if (ex === false || ex == null) form.bd_expense_mode = 'none';
    else if (Array.isArray(ex)) { form.bd_expense_mode = 'subset'; form.bd_expense_list = ex; }
    const gp = p.breakdowns.gpDrilldown;
    if (gp === true) form.bd_gp_mode = 'all';
    else if (gp === false || gp == null) form.bd_gp_mode = 'none';
    else if (Array.isArray(gp)) { form.bd_gp_mode = 'subset'; form.bd_gp_list = gp; }
    form.bd_audit = p.breakdowns.auditConsole === true;
    form.bd_hc = p.breakdowns.hcDetails === true;
    form.bd_shareholder = p.breakdowns.shareholderSplit === true;
    form.bd_expenseGL = p.breakdowns.expenseGLDetail === true;
  }
  form.lpName = p.lpName || '';
  return form;
}

function formStateToPayload(form, isEdit) {
  const permissions = {
    companies: form.companies_mode === 'all' ? '*' : form.companies_list,
    tabs: form.tabs_mode === 'all' ? '*' : form.tabs_list,
    breakdowns: {
      revenueDrilldown: form.bd_revenue_mode === 'all' ? true : form.bd_revenue_mode === 'none' ? false : form.bd_revenue_list,
      expenseDrilldown: form.bd_expense_mode === 'all' ? true : form.bd_expense_mode === 'none' ? false : form.bd_expense_list,
      expenseGLDetail: form.bd_expenseGL,
      gpDrilldown: form.bd_gp_mode === 'all' ? true : form.bd_gp_mode === 'none' ? false : form.bd_gp_list,
      auditConsole: form.bd_audit,
      hcDetails: form.bd_hc,
      shareholderSplit: form.bd_shareholder,
    },
    lpName: form.lpName || null,
  };
  const payload = { name: form.name, email: form.email || null, role: form.role, permissions };
  if (!isEdit) payload.username = form.username;
  if (form.password) payload.password = form.password;
  return payload;
}

// ─── Permission summary badges (compact representation) ────────────────────

function permissionBadges(u) {
  const p = u.permissions || {};
  const badges = [];

  // Companies
  if (p.companies === '*') badges.push({ key: 'co', text: 'All companies', tone: 'neutral' });
  else if (Array.isArray(p.companies)) badges.push({
    key: 'co',
    text: `${p.companies.length}/${ALL_COMPANIES.length} companies`,
    tone: p.companies.length === 0 ? 'warn' : 'neutral',
  });

  // Tabs
  if (p.tabs === '*') badges.push({ key: 't', text: 'All tabs', tone: 'neutral' });
  else if (Array.isArray(p.tabs)) badges.push({
    key: 't',
    text: `${p.tabs.length}/${ALL_TABS.length} tabs`,
    tone: p.tabs.length === 0 ? 'warn' : 'neutral',
  });

  // Breakdowns count
  if (p.breakdowns === '*') {
    badges.push({ key: 'bd', text: 'All breakdowns', tone: 'neutral' });
  } else if (p.breakdowns) {
    const bd = p.breakdowns;
    const granted = ['revenueDrilldown', 'expenseDrilldown', 'expenseGLDetail', 'gpDrilldown', 'auditConsole', 'hcDetails', 'shareholderSplit'].filter(k => {
      const v = bd[k];
      return v === true || (Array.isArray(v) && v.length > 0);
    });
    if (granted.length > 0) badges.push({ key: 'bd', text: `${granted.length}/7 breakdowns`, tone: 'neutral' });
  }

  // LP
  if (p.lpName) badges.push({ key: 'lp', text: `LP: ${p.lpName}`, tone: 'accent' });

  return badges;
}

const BADGE_TONE = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-violet-100 text-violet-700',
  warn: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
};

// ─── Confirm modal ─────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-card text-card-foreground rounded-xl border shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm"
            className={danger ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Strong random password (client-side, crypto.getRandomValues) ──────────

function generateStrongPassword(length = 16) {
  // Avoid ambiguous chars (0/O, 1/l/I). Mix of letter classes + digits + symbols.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

// ─── Main component ───────────────────────────────────────────────────────

export default function UserAdmin({ currentUser, lpNames = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUsername, setEditingUsername] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pendingInvite, setPendingInvite] = useState(null);
  const [inviteStatus, setInviteStatus] = useState('');
  const [displayUrl, setDisplayUrl] = useState(null);
  const [displayStatus, setDisplayStatus] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm, danger }

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'viewer'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'

  // ── API helpers ─────────────────────────────────────────────────────────

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
      else setError(data.error || 'Failed to load users');
    } catch (e) {
      setError('Network error loading users');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadUsers(); }, []);

  // ── Form lifecycle ──────────────────────────────────────────────────────

  function startNew() {
    setForm(EMPTY_FORM); setEditingUsername(null);
    setError(''); setStatus(''); setPendingInvite(null); setInviteStatus('');
  }
  function startEdit(u) {
    setForm(userToFormState(u)); setEditingUsername(u.username);
    setError(''); setStatus(''); setPendingInvite(null); setInviteStatus('');
  }
  function applyPreset(presetName) {
    if (!presetName || !ROLE_PRESETS[presetName]) return;
    setForm(f => ({ ...f, ...ROLE_PRESETS[presetName] }));
  }
  function copyFromUser(username) {
    const u = users.find(x => x.username === username);
    if (!u) return;
    // Preserve username/name/email/password from current form; copy everything else.
    const copied = userToFormState(u);
    setForm(f => ({
      ...copied,
      username: f.username,
      name: f.name,
      email: f.email,
      password: f.password,
    }));
  }
  function regeneratePassword() {
    const pw = generateStrongPassword(16);
    setForm(f => ({ ...f, password: pw }));
    setStatus(`Generated. Copy now — won't show after save.`);
  }

  // ── Save / Delete / Lock-Unlock ────────────────────────────────────────

  async function onSave(e) {
    e.preventDefault();
    setError(''); setStatus('Saving...');
    const isEdit = editingUsername !== null;
    const payload = formStateToPayload(form, isEdit);
    if (!isEdit && (!form.username || !form.password)) { setStatus(''); setError('Username and password required'); return; }
    if (!form.name) { setStatus(''); setError('Name is required'); return; }
    const url = isEdit ? `/api/admin/users?username=${encodeURIComponent(editingUsername)}` : '/api/admin/users';
    try {
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setStatus(''); setError(data.error || 'Save failed'); return; }
      setStatus('Saved. Redeploying... (~30s until live)');
      const savedUsername = isEdit ? editingUsername : form.username;
      if (form.email && form.password) {
        setPendingInvite({ username: savedUsername, name: form.name, email: form.email, password: form.password });
        setInviteStatus('');
      }
      await loadUsers();
      if (!isEdit) { setForm(EMPTY_FORM); setEditingUsername(null); setError(''); }
    } catch (e) {
      setStatus(''); setError('Network error');
    }
  }

  function confirmDelete(username) {
    setConfirmModal({
      title: `Delete user "${username}"?`,
      message: 'This permanently removes the account and revokes any active sessions. This cannot be undone.',
      confirmLabel: 'Delete user',
      danger: true,
      onConfirm: () => { setConfirmModal(null); doDelete(username); },
    });
  }
  async function doDelete(username) {
    setError(''); setStatus('Deleting...');
    try {
      const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setStatus(''); setError(data.error || 'Delete failed'); return; }
      setStatus('Deleted. Redeploying... (~30s)');
      await loadUsers();
      if (editingUsername === username) startNew();
    } catch (e) {
      setStatus(''); setError('Network error');
    }
  }

  function confirmToggleDisabled(u) {
    const willDisable = !u.disabled;
    setConfirmModal({
      title: willDisable ? `Lock account "${u.username}"?` : `Unlock account "${u.username}"?`,
      message: willDisable
        ? "Locked accounts can't log in. Any active session is killed on next request. You can unlock later."
        : 'Account will be able to log in again with its existing password.',
      confirmLabel: willDisable ? 'Lock account' : 'Unlock account',
      danger: willDisable,
      onConfirm: () => { setConfirmModal(null); toggleDisabled(u); },
    });
  }
  async function toggleDisabled(u) {
    setError(''); setStatus(u.disabled ? 'Unlocking...' : 'Locking...');
    try {
      const res = await fetch(`/api/admin/users?username=${encodeURIComponent(u.username)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus(''); setError(data.error || 'Update failed'); return; }
      setStatus(`${u.disabled ? 'Unlocked' : 'Locked'}. Redeploying... (~30s)`);
      await loadUsers();
    } catch (e) {
      setStatus(''); setError('Network error');
    }
  }

  async function resetPasswordFor(u) {
    const pw = generateStrongPassword(16);
    setError(''); setStatus(`Setting new password for ${u.username}...`);
    try {
      const res = await fetch(`/api/admin/users?username=${encodeURIComponent(u.username)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus(''); setError(data.error || 'Reset failed'); return; }
      setStatus(`✅ New password set. Share with user: ${pw}`);
      setPendingInvite({ username: u.username, name: u.name, email: u.email || '', password: pw });
      await loadUsers();
    } catch (e) {
      setStatus(''); setError('Network error');
    }
  }

  // ── Display token + invite (unchanged behavior) ─────────────────────────

  async function generateDisplayUrl(username) {
    setDisplayStatus(`Generating display URL for ${username}…`);
    setDisplayUrl(null);
    try {
      const res = await fetch('/api/admin/display-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      const data = await res.json();
      if (!res.ok) { setDisplayStatus(`❌ ${data.error || 'Failed to generate display URL'}`); return; }
      setDisplayUrl({ username, url: data.url });
      setDisplayStatus('');
    } catch (e) { setDisplayStatus('❌ Network error'); }
  }
  async function copyDisplayUrl() {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl.url);
      setDisplayStatus('✅ Copied to clipboard');
      setTimeout(() => setDisplayStatus(''), 2000);
    } catch { setDisplayStatus('❌ Could not copy — select and copy manually'); }
  }
  function buildMailtoHref(invite) {
    const dashboardUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://invitro-dashboard-1.vercel.app/login';
    const subject = `Welcome to InVitro Capital Dashboard, ${invite.name || invite.username}`;
    const body = [
      `Hi ${invite.name || invite.username},`, '',
      "You've been invited to the InVitro Capital shareholder dashboard.", '',
      'Your credentials:', `  Username: ${invite.username}`, `  Password: ${invite.password}`, '',
      `Login here: ${dashboardUrl}`, '',
      'For security, please change your password after your first login.', '',
      'Best,',
    ].join('\n');
    return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  async function sendInvite() {
    if (!pendingInvite) return;
    setInviteStatus('Sending invitation email...');
    try {
      const res = await fetch('/api/admin/send-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingInvite) });
      const data = await res.json();
      if (res.ok) { setInviteStatus(`✅ Invitation sent to ${pendingInvite.email}`); setPendingInvite(null); return; }
      if (res.status === 503 || String(data.error || '').includes('RESEND')) {
        window.location.href = buildMailtoHref(pendingInvite);
        setInviteStatus('📧 Opening your email client... review and send to complete.'); return;
      }
      setInviteStatus(`❌ ${data.error || 'Send failed'}`);
    } catch (e) {
      window.location.href = buildMailtoHref(pendingInvite);
      setInviteStatus('📧 Opening your email client... review and send to complete.');
    }
  }

  // ── Filtering + CSV export ──────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      const disabled = u.disabled === true;
      if (statusFilter === 'active' && disabled) return false;
      if (statusFilter === 'disabled' && !disabled) return false;
      if (q) {
        const hay = [u.username, u.name, u.email || '', u.permissions?.lpName || ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  function exportCsv() {
    const rows = [
      ['Username', 'Name', 'Email', 'Role', 'Status', 'LP', 'Companies', 'Tabs', 'Breakdowns'],
      ...users.map(u => {
        const p = u.permissions || {};
        const co = p.companies === '*' ? 'All' : (Array.isArray(p.companies) ? p.companies.join('|') : '');
        const tb = p.tabs === '*' ? 'All' : (Array.isArray(p.tabs) ? p.tabs.join('|') : '');
        let bd = '';
        if (p.breakdowns === '*') bd = 'All';
        else if (p.breakdowns) {
          bd = ['revenueDrilldown', 'expenseDrilldown', 'expenseGLDetail', 'gpDrilldown', 'auditConsole', 'hcDetails', 'shareholderSplit']
            .filter(k => {
              const v = p.breakdowns[k];
              return v === true || (Array.isArray(v) && v.length > 0);
            }).join('|');
        }
        return [
          u.username, u.name, u.email || '', u.role,
          u.disabled ? 'Disabled' : 'Active',
          p.lpName || '', co, tb, bd,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleListItem(list, item) {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const adminCount = users.filter(u => u.role === 'admin' && !u.disabled).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? 'user' : 'users'} · {adminCount} active {adminCount === 1 ? 'admin' : 'admins'} · changes auto-commit and trigger a Vercel redeploy
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>↓ Export CSV</Button>
            <a href="/" className="text-sm text-primary hover:underline">← Back to dashboard</a>
          </div>
        </div>

        {/* Display URL banner */}
        {displayUrl && (
          <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">Display URL for <strong>{displayUrl.username}</strong></p>
                <p className="text-xs text-blue-700 mt-1">
                  Paste into Juuno&apos;s Website App. 365-day token, auto-authenticates as <code className="bg-blue-100 px-1 rounded">{displayUrl.username}</code>.
                  Sensitive routes (/admin, /audit) are blocked from this token.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button type="button" size="sm" onClick={copyDisplayUrl}>Copy</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setDisplayUrl(null); setDisplayStatus(''); }}>Close</Button>
              </div>
            </div>
            <input type="text" value={displayUrl.url} readOnly onFocus={e => e.target.select()}
              className="w-full font-mono text-[11px] bg-white border border-blue-200 rounded px-2 py-1.5 text-foreground" />
            {displayStatus && <p className="text-xs mt-2 font-medium">{displayStatus}</p>}
          </div>
        )}
        {!displayUrl && displayStatus && <div className="mb-4 text-sm font-medium">{displayStatus}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ── User list (lg:col-span-2) ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">Users {filteredUsers.length !== users.length && <span className="text-muted-foreground font-normal">({filteredUsers.length} of {users.length})</span>}</CardTitle>
                <Button size="sm" onClick={startNew}>+ New User</Button>
              </div>
              {/* Search + filters */}
              <div className="space-y-2">
                <input
                  type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, username, email, or LP..."
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="all">All roles</option>
                    <option value="admin">Admins</option>
                    <option value="viewer">Viewers</option>
                  </select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="disabled">Disabled only</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {users.length === 0 ? 'No users yet.' : 'No users match your filters.'}
                </p>
              ) : (
                <ul className="divide-y divide-border -mx-2">
                  {filteredUsers.map(u => {
                    const [bg, fg] = avatarColor(u.username);
                    const isMe = u.username === currentUser.username;
                    const isActive = editingUsername === u.username;
                    const isDisabled = u.disabled === true;
                    const badges = permissionBadges(u);
                    return (
                      <li key={u.username}
                        className={cn(
                          "px-2 py-3 cursor-pointer hover:bg-accent/30 rounded-md transition-colors",
                          isActive && "bg-primary/5",
                          isDisabled && "opacity-60"
                        )}
                        onClick={() => startEdit(u)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold", bg, fg)}>
                            {initials(u.name)}
                          </div>
                          {/* Identity + badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                              <span className={cn(
                                "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide",
                                u.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              )}>{u.role}</span>
                              {isDisabled && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide bg-red-100 text-red-700">Disabled</span>
                              )}
                              {isMe && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide bg-emerald-100 text-emerald-700">You</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              @{u.username}{u.email ? ` · ${u.email}` : ''}
                            </p>
                            {badges.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                {badges.map(b => (
                                  <span key={b.key} className={cn("px-1.5 py-0.5 text-[10px] rounded", BADGE_TONE[b.tone])}>{b.text}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Inline actions */}
                        <div className="flex justify-end gap-3 mt-2 pr-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); generateDisplayUrl(u.username); }}
                            className="text-[11px] text-blue-600 hover:text-blue-800"
                            title="Generate a long-lived URL for kiosk/Juuno TV display"
                          >TV URL</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); resetPasswordFor(u); }}
                            className="text-[11px] text-foreground/70 hover:text-foreground"
                            title="Generate a new password and show it once"
                          >Reset PW</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmToggleDisabled(u); }}
                            disabled={isMe}
                            className={cn(
                              "text-[11px]",
                              isMe ? "text-muted-foreground cursor-not-allowed" :
                              isDisabled ? "text-emerald-600 hover:text-emerald-800" : "text-amber-600 hover:text-amber-800"
                            )}
                            title={isMe ? "Can't lock yourself" : isDisabled ? 'Re-enable login' : 'Block login + kill sessions'}
                          >{isDisabled ? 'Unlock' : 'Lock'}</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmDelete(u.username); }}
                            disabled={isMe}
                            className={cn(
                              "text-[11px]",
                              isMe ? "text-muted-foreground cursor-not-allowed" : "text-red-500 hover:text-red-700"
                            )}
                            title={isMe ? "Can't delete yourself" : 'Delete user'}
                          >Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Form (lg:col-span-3) ── */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm">{editingUsername ? `Edit: ${editingUsername}` : 'Create new user'}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Pending invitation banner */}
              {pendingInvite && (
                <div className="mb-5 rounded-lg border border-blue-300 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        Send credentials to <strong>{pendingInvite.name || pendingInvite.username}</strong>?
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Sends to <code className="bg-blue-100 px-1 rounded">{pendingInvite.email || '(no email on file)'}</code> via Resend if configured,
                        otherwise opens your email client.
                      </p>
                      <p className="text-[11px] mt-2 font-mono text-blue-900">Password: <strong>{pendingInvite.password}</strong></p>
                      {inviteStatus && <p className="text-xs mt-2 font-medium">{inviteStatus}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" size="sm" onClick={sendInvite}
                        disabled={!pendingInvite.email || inviteStatus === 'Sending invitation email...'}>
                        {inviteStatus === 'Sending invitation email...' ? 'Sending...' : 'Send Invitation'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setPendingInvite(null); setInviteStatus(''); }}>Skip</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick-start strip — presets + copy-from-user */}
              <div className="mb-5 p-3 bg-muted/40 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Apply preset</label>
                    <select onChange={e => { applyPreset(e.target.value); e.target.value = ''; }}
                      defaultValue=""
                      className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="" disabled>Select a preset…</option>
                      {Object.keys(ROLE_PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Copy permissions from</label>
                    <select onChange={e => { copyFromUser(e.target.value); e.target.value = ''; }}
                      defaultValue=""
                      className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="" disabled>Select an existing user…</option>
                      {users.filter(u => u.username !== editingUsername).map(u => (
                        <option key={u.username} value={u.username}>{u.name} (@{u.username})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Presets are starting points.</strong> Apply one, then customize.
                  For <strong>hybrid users</strong> (e.g. Amir Barsoum runs a portco AND is an LP), apply
                  <em> &ldquo;LP + Operator&rdquo;</em> then set <em>Companies</em> and <em>LP Identity</em> below — the LP
                  field scopes the IRR view independently of any preset.
                </p>
              </div>

              <form onSubmit={onSave} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Username</label>
                    <input type="text" value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      disabled={editingUsername !== null}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      placeholder="e.g. boardmember1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Display Name</label>
                    <input type="text" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. Jane Smith" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Email (for invitations)</label>
                    <input type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="jane@invitrocapital.com" autoComplete="email" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide flex items-center justify-between">
                      <span>Password {editingUsername ? '(leave blank to keep)' : ''}</span>
                      <button type="button" onClick={regeneratePassword}
                        className="text-[10px] text-primary hover:underline normal-case tracking-normal">
                        Generate strong password
                      </button>
                    </label>
                    <input type="text" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      placeholder={editingUsername ? '(unchanged)' : 'Min 8 characters'}
                      autoComplete="new-password" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide flex items-center gap-2">
                      <span>LP Identity (optional)</span>
                      {form.lpName && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide bg-violet-100 text-violet-700 normal-case">
                          LP scoping ON
                        </span>
                      )}
                    </label>
                    <select value={form.lpName} onChange={e => setForm({ ...form, lpName: e.target.value })}
                      className={cn(
                        "mt-1 flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                        form.lpName ? "border-violet-300 ring-1 ring-violet-100" : "border-input"
                      )}>
                      <option value="">(none — sees all vehicles)</option>
                      {lpNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Independent of role presets. When set, the IRR &amp; Valuation tab filters to vehicles where this LP appears,
                      with their stake highlighted. Leave blank for non-LP users.
                    </p>
                  </div>
                </div>

                {/* Companies — 'Consolidated' is included as a checkbox.
                    For LP users (lpName set), the runtime gives them the
                    UNION of admin-granted companies + companies their
                    vehicle invested in. So admin can add extra companies
                    on top of the auto-derived baseline. */}
                <fieldset className="border border-border rounded-lg p-3">
                  <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">Companies</legend>
                  {form.lpName && (
                    <div className="mb-2 -mt-1 px-2 py-1.5 bg-violet-50 border border-violet-200 rounded text-[11px] text-violet-900">
                      <strong>LP scoping is ON</strong> · This LP automatically sees the companies their vehicle invested in. Any companies you check below are <strong>added on top</strong> of that auto-derived set.
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="companies_mode" checked={form.companies_mode === 'all'} onChange={() => setForm({ ...form, companies_mode: 'all' })} />
                      All companies (incl. Consolidated)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="companies_mode" checked={form.companies_mode === 'subset'} onChange={() => setForm({ ...form, companies_mode: 'subset' })} />
                      Select specific companies
                    </label>
                    {form.companies_mode === 'subset' && (
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {ALL_COMPANIES.map(c => (
                          <label key={c} className={cn(
                            "flex items-center gap-2 text-sm cursor-pointer",
                            c === CONSOLIDATED_PSEUDO && "col-span-2 mt-1 pt-2 border-t border-border/60 font-medium"
                          )}>
                            <input type="checkbox" checked={form.companies_list.includes(c)}
                              onChange={() => setForm({ ...form, companies_list: toggleListItem(form.companies_list, c) })} />
                            {c}
                            {c === CONSOLIDATED_PSEUDO && (
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">(aggregate view of all companies)</span>
                            )}
                            {c === ALLRX_EXTERNAL_PSEUDO && (
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">(public-target view; shown as &quot;AllRx&quot; if internal is unchecked)</span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </fieldset>

                {/* Tabs */}
                <fieldset className="border border-border rounded-lg p-3">
                  <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">Tabs</legend>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="tabs_mode" checked={form.tabs_mode === 'all'} onChange={() => setForm({ ...form, tabs_mode: 'all' })} />
                      All tabs
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="tabs_mode" checked={form.tabs_mode === 'subset'} onChange={() => setForm({ ...form, tabs_mode: 'subset' })} />
                      Select specific tabs
                    </label>
                    {form.tabs_mode === 'subset' && (
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {ALL_TABS.map(t => (
                          <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={form.tabs_list.includes(t.id)}
                              onChange={() => setForm({ ...form, tabs_list: toggleListItem(form.tabs_list, t.id) })} />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </fieldset>

                {/* Per-company drilldowns */}
                {DRILL_BREAKDOWNS.map(({ key, label, modeField, listField }) => {
                  return (
                    <fieldset key={key} className="border border-border rounded-lg p-3">
                      <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">{label}</legend>
                      <div className="space-y-2">
                        {['all', 'none', 'subset'].map(mode => (
                          <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name={modeField} checked={form[modeField] === mode} onChange={() => setForm({ ...form, [modeField]: mode })} />
                            {mode === 'all' ? 'All companies' : mode === 'none' ? 'Disabled' : 'Select specific companies'}
                          </label>
                        ))}
                        {form[modeField] === 'subset' && (
                          <div className="ml-6 grid grid-cols-2 gap-2">
                            {/* Drill-downs (revenue/expense detail) are sourced
                                from the main P&L tab and only meaningful for
                                real portfolio companies — exclude pseudo
                                entries (Consolidated, AllRx External). */}
                            {ALL_COMPANIES.filter(c => c !== CONSOLIDATED_PSEUDO && c !== ALLRX_EXTERNAL_PSEUDO).map(c => (
                              <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form[listField].includes(c)}
                                  onChange={() => setForm({ ...form, [listField]: toggleListItem(form[listField], c) })} />
                                {c}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </fieldset>
                  );
                })}

                {/* Simple boolean breakdowns */}
                <fieldset className="border border-border rounded-lg p-3">
                  <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">Other Access</legend>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.bd_audit} onChange={e => setForm({ ...form, bd_audit: e.target.checked })} />
                      Audit Console
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.bd_expenseGL} onChange={e => setForm({ ...form, bd_expenseGL: e.target.checked })} />
                      Expense GL Detail
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">(Layer 2: Non-HC + Adhocks GL-level cards)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.bd_hc} onChange={e => setForm({ ...form, bd_hc: e.target.checked })} />
                      HC Salary Details
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">(Layer 3: per-person headcount roster)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.bd_shareholder} onChange={e => setForm({ ...form, bd_shareholder: e.target.checked })} />
                      Shareholder Split (IRR &amp; Valuation)
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">(per-portco Investors table)</span>
                    </label>
                  </div>
                </fieldset>

                {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                {status && <p className="text-sm text-emerald-600 font-medium">{status}</p>}

                <div className="flex gap-3">
                  <Button type="submit">{editingUsername ? 'Update User' : 'Create User'}</Button>
                  {editingUsername && <Button type="button" variant="outline" onClick={startNew}>Cancel</Button>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
