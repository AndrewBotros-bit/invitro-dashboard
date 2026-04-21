"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ALL_COMPANIES = ['AllRx', 'AllCare', 'Osta', 'Needles', 'InVitro Studio'];
const ALL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'insights', label: 'Insights' },
];
const DRILL_BREAKDOWNS = [
  { key: 'revenueDrilldown', label: 'Revenue drill-down' },
  { key: 'expenseDrilldown', label: 'Expense drill-down' },
];
const SIMPLE_BREAKDOWNS = [
  { key: 'auditConsole', label: 'Audit Console' },
  { key: 'hcDetails', label: 'HC Salary Details' },
];

const EMPTY_FORM = {
  username: '',
  name: '',
  password: '',
  role: 'viewer',
  companies_mode: 'all',         // 'all' | 'subset'
  companies_list: [],
  tabs_mode: 'all',              // 'all' | 'subset'
  tabs_list: [],
  bd_revenue_mode: 'all',        // 'all' | 'none' | 'subset'
  bd_revenue_list: [],
  bd_expense_mode: 'all',
  bd_expense_list: [],
  bd_audit: false,
  bd_hc: false,
};

function userToFormState(u) {
  const p = u.permissions || {};
  const form = { ...EMPTY_FORM, username: u.username, name: u.name, password: '', role: u.role || 'viewer' };

  // companies
  if (p.companies === '*') form.companies_mode = 'all';
  else if (Array.isArray(p.companies)) { form.companies_mode = 'subset'; form.companies_list = p.companies; }

  // tabs
  if (p.tabs === '*') form.tabs_mode = 'all';
  else if (Array.isArray(p.tabs)) { form.tabs_mode = 'subset'; form.tabs_list = p.tabs; }

  // breakdowns
  if (p.breakdowns === '*') {
    form.bd_revenue_mode = 'all'; form.bd_expense_mode = 'all';
    form.bd_audit = true; form.bd_hc = true;
  } else if (p.breakdowns) {
    const rv = p.breakdowns.revenueDrilldown;
    if (rv === true) form.bd_revenue_mode = 'all';
    else if (rv === false || rv == null) form.bd_revenue_mode = 'none';
    else if (Array.isArray(rv)) { form.bd_revenue_mode = 'subset'; form.bd_revenue_list = rv; }

    const ex = p.breakdowns.expenseDrilldown;
    if (ex === true) form.bd_expense_mode = 'all';
    else if (ex === false || ex == null) form.bd_expense_mode = 'none';
    else if (Array.isArray(ex)) { form.bd_expense_mode = 'subset'; form.bd_expense_list = ex; }

    form.bd_audit = p.breakdowns.auditConsole === true;
    form.bd_hc = p.breakdowns.hcDetails === true;
  }
  return form;
}

function formStateToPayload(form, isEdit) {
  const permissions = {
    companies: form.companies_mode === 'all' ? '*' : form.companies_list,
    tabs: form.tabs_mode === 'all' ? '*' : form.tabs_list,
    breakdowns: {
      revenueDrilldown:
        form.bd_revenue_mode === 'all' ? true :
        form.bd_revenue_mode === 'none' ? false :
        form.bd_revenue_list,
      expenseDrilldown:
        form.bd_expense_mode === 'all' ? true :
        form.bd_expense_mode === 'none' ? false :
        form.bd_expense_list,
      auditConsole: form.bd_audit,
      hcDetails: form.bd_hc,
    },
  };

  const payload = { name: form.name, role: form.role, permissions };
  if (!isEdit) payload.username = form.username;
  if (form.password) payload.password = form.password;
  return payload;
}

export default function UserAdmin({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUsername, setEditingUsername] = useState(null); // null = creating
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

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

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingUsername(null);
    setError('');
    setStatus('');
  }

  function startEdit(u) {
    setForm(userToFormState(u));
    setEditingUsername(u.username);
    setError('');
    setStatus('');
  }

  async function onSave(e) {
    e.preventDefault();
    setError('');
    setStatus('Saving...');
    const isEdit = editingUsername !== null;
    const payload = formStateToPayload(form, isEdit);

    // client-side validation
    if (!isEdit && (!form.username || !form.password)) {
      setStatus(''); setError('Username and password are required');
      return;
    }
    if (!form.name) { setStatus(''); setError('Name is required'); return; }

    const url = isEdit
      ? `/api/admin/users?username=${encodeURIComponent(editingUsername)}`
      : '/api/admin/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setStatus(''); setError(data.error || 'Save failed'); return; }
      setStatus('Saved. Redeploying... (~30s until live)');
      await loadUsers();
      if (!isEdit) startNew();
    } catch (e) {
      setStatus(''); setError('Network error');
    }
  }

  async function onDelete(username) {
    if (!confirm(`Delete user ${username}?`)) return;
    setError('');
    setStatus('Deleting...');
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

  function toggleListItem(list, item) {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground">Create and edit users with granular permissions. Changes auto-commit to git and trigger a Vercel redeploy.</p>
          </div>
          <a href="/" className="text-sm text-primary hover:underline">← Back to dashboard</a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Users list */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Users ({users.length})</CardTitle>
              <Button size="sm" onClick={startNew}>+ New User</Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow
                        key={u.username}
                        className={cn("cursor-pointer hover:bg-accent/50", editingUsername === u.username && "bg-primary/5")}
                        onClick={() => startEdit(u)}
                      >
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase",
                            u.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>{u.role}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(u.username); }}
                            className="text-xs text-red-500 hover:text-red-700"
                            disabled={u.username === currentUser.username}
                            title={u.username === currentUser.username ? "Can't delete yourself" : "Delete user"}
                          >
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm">
                {editingUsername ? `Edit: ${editingUsername}` : 'Create new user'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSave} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Username</label>
                    <input type="text" value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      disabled={editingUsername !== null}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      placeholder="e.g. boardmember1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Display Name</label>
                    <input type="text" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g. Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">
                      Password {editingUsername ? '(leave blank to keep)' : ''}
                    </label>
                    <input type="password" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={editingUsername ? '(unchanged)' : 'Min 8 characters'}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground uppercase tracking-wide">Role</label>
                    <select value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* Companies */}
                <fieldset className="border border-border rounded-lg p-3">
                  <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">Companies</legend>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="companies_mode" checked={form.companies_mode === 'all'}
                        onChange={() => setForm({ ...form, companies_mode: 'all' })} />
                      All companies
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="companies_mode" checked={form.companies_mode === 'subset'}
                        onChange={() => setForm({ ...form, companies_mode: 'subset' })} />
                      Select specific companies
                    </label>
                    {form.companies_mode === 'subset' && (
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {ALL_COMPANIES.map(c => (
                          <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={form.companies_list.includes(c)}
                              onChange={() => setForm({ ...form, companies_list: toggleListItem(form.companies_list, c) })} />
                            {c}
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
                      <input type="radio" name="tabs_mode" checked={form.tabs_mode === 'all'}
                        onChange={() => setForm({ ...form, tabs_mode: 'all' })} />
                      All tabs
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="tabs_mode" checked={form.tabs_mode === 'subset'}
                        onChange={() => setForm({ ...form, tabs_mode: 'subset' })} />
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
                {DRILL_BREAKDOWNS.map(({ key, label }) => {
                  const modeField = key === 'revenueDrilldown' ? 'bd_revenue_mode' : 'bd_expense_mode';
                  const listField = key === 'revenueDrilldown' ? 'bd_revenue_list' : 'bd_expense_list';
                  return (
                    <fieldset key={key} className="border border-border rounded-lg p-3">
                      <legend className="text-xs font-medium text-foreground uppercase tracking-wide px-1">{label}</legend>
                      <div className="space-y-2">
                        {['all', 'none', 'subset'].map(mode => (
                          <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name={modeField} checked={form[modeField] === mode}
                              onChange={() => setForm({ ...form, [modeField]: mode })} />
                            {mode === 'all' ? 'All companies' : mode === 'none' ? 'Disabled' : 'Select specific companies'}
                          </label>
                        ))}
                        {form[modeField] === 'subset' && (
                          <div className="ml-6 grid grid-cols-2 gap-2">
                            {ALL_COMPANIES.map(c => (
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
                      <input type="checkbox" checked={form.bd_audit}
                        onChange={e => setForm({ ...form, bd_audit: e.target.checked })} />
                      Audit Console
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.bd_hc}
                        onChange={e => setForm({ ...form, bd_hc: e.target.checked })} />
                      HC Salary Details
                    </label>
                  </div>
                </fieldset>

                {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                {status && <p className="text-sm text-emerald-600 font-medium">{status}</p>}

                <div className="flex gap-3">
                  <Button type="submit">{editingUsername ? 'Update User' : 'Create User'}</Button>
                  {editingUsername && (
                    <Button type="button" variant="outline" onClick={startNew}>Cancel</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
