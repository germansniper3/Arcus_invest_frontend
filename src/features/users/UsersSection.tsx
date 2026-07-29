import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Lock, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useCan } from '../../lib/permissions';
import { ALL_RESOURCES } from '../../lib/adminSections';
import type { User, EmailStatus, CustomRole, CustomRolePermission, PermissionResource } from '../../types';
import { Modal } from '../../components/Modal';
import { Loadable } from '../../components/Loadable';
import { SectionAction } from '../../components/SectionAction';
import { Badge, type Tone } from '../../components/Badge';
import { useRefreshSignal } from '../../lib/refresh';

const ROLE_STYLES: Record<string, { tone: Tone; label: string }> = {
  super_admin: { tone: 'special', label: 'Super Admin' },
  admin: { tone: 'info', label: 'Admin' },
  admissions: { tone: 'active', label: 'Admissions' },
  student: { tone: 'notice', label: 'Student' },
};

const EMPTY_USER = { email: '', full_name: '', password: '', role: 'admissions' };

const BLANK_PERM = (resource: PermissionResource): CustomRolePermission => ({
  resource,
  can_read: false,
  can_create: false,
  can_update: false,
  can_delete: false,
  scope: 'none',
});

interface Props {
  /**
   * Whether users is the section on screen. The component stays mounted either
   * way so its two dialogs are never torn down — Radix restores focus on the
   * open→closed transition, which an unmounted dialog never emits.
   */
  active: boolean;
}

export function UsersSection({ active }: Props) {
  const { user } = useAuth();
  const can = useCan();

  const [users, setUsers] = useState<User[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [savingUser, setSavingUser] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState<{
    id: string; name: string; label: string; description: string; permissions: CustomRolePermission[];
  }>({ id: '', name: '', label: '', description: '', permissions: [] });
  const [savingRole, setSavingRole] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const tasks: [Promise<User[]>, Promise<EmailStatus>, Promise<CustomRole[]>?] = [
        api.adminListUsers(),
        api.adminEmailStatus(),
      ];
      // Only super_admin may read the role list; everyone else gets the built-in
      // fallback in the role picker below.
      if (can('roles')) tasks.push(api.adminListRoles());
      const [nextUsers, nextEmail, nextRoles] = await Promise.all(tasks);
      setUsers(nextUsers);
      setEmailStatus(nextEmail);
      if (nextRoles) setRoles(nextRoles);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load users'));
    } finally {
      setLoading(false);
    }
  }

  const refresh = useRefreshSignal();

  useEffect(() => {
    if (active) load();
    // `refresh` is the rail's Refresh Data signal — see lib/refresh. The
    // `active` guard means a bump refetches only the visible section.
  }, [active, refresh]);

  // --- Users ---

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (userForm.password.length < 10) {
      toast.error('Password must be at least 10 characters');
      return;
    }
    setSavingUser(true);
    try {
      await api.createUser(userForm);
      toast.success('User created');
      setShowUserModal(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create user'));
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserActive(u: User) {
    try {
      await api.adminUpdateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update user'));
    }
  }

  async function deleteUser(u: User) {
    const extra = u.role === 'student'
      ? ' Their capstone data will be removed and the enrollment reopened for re-invitation.'
      : '';
    if (!confirm(`Permanently delete ${u.full_name} (${u.email})?${extra} This cannot be undone.`)) return;
    try {
      await api.adminDeleteUser(u.id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete user'));
    }
  }

  // --- Roles ---

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm({ id: '', name: '', label: '', description: '', permissions: ALL_RESOURCES.map(BLANK_PERM) });
    setShowRoleModal(true);
  }

  function openEditRole(role: CustomRole) {
    setEditingRole(role);
    const permMap = new Map((role.permissions ?? []).map((p) => [p.resource, p]));
    setRoleForm({
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description || '',
      permissions: ALL_RESOURCES.map((r) => {
        const existing = permMap.get(r);
        return existing ? { ...existing } : BLANK_PERM(r);
      }),
    });
    setShowRoleModal(true);
  }

  /**
   * Keeps scope and the CRUD flags consistent, because the two express the same
   * decision from different directions: a grant with no scope is unreachable,
   * and a scope with no grant is meaningless. Setting scope to none clears the
   * flags; ticking the first flag promotes scope out of none.
   */
  function handlePermChange(
    res: PermissionResource,
    field: 'can_read' | 'can_create' | 'can_update' | 'can_delete' | 'scope',
    // boolean for the four flags, string for scope -- the caller pairs them.
    value: boolean | string,
  ) {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.map((p) => {
        if (p.resource !== res) return p;
        const updated = { ...p, [field]: value };
        if (field === 'scope') {
          if (value === 'none') {
            updated.can_read = false;
            updated.can_create = false;
            updated.can_update = false;
            updated.can_delete = false;
          } else if (p.scope === 'none') {
            updated.can_read = true;
          }
        } else {
          const hasAny = updated.can_read || updated.can_create || updated.can_update || updated.can_delete;
          if (hasAny && updated.scope === 'none') updated.scope = 'all';
          else if (!hasAny) updated.scope = 'none';
        }
        return updated;
      }),
    }));
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    try {
      if (roleForm.id) {
        // Built-in grants are fixed server-side; sending them would be rejected.
        // Only label/description are editable for those roles.
        await api.adminUpdateRole(roleForm.id, {
          label: roleForm.label,
          description: roleForm.description,
          ...(editingRole?.is_built_in ? {} : { permissions: roleForm.permissions }),
        });
        toast.success('Role updated successfully');
      } else {
        await api.adminCreateRole({
          name: roleForm.name,
          label: roleForm.label,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        toast.success('Role created successfully');
      }
      setShowRoleModal(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save role'));
    } finally {
      setSavingRole(false);
    }
  }

  async function deleteRole(role: CustomRole) {
    if (role.is_built_in) {
      toast.error('Built-in roles cannot be deleted');
      return;
    }
    if ((role.user_count || 0) > 0) {
      toast.error(`Cannot delete role assigned to ${role.user_count} user(s)`);
      return;
    }
    if (!confirm(`Delete custom role "${role.label}"? This cannot be undone.`)) return;
    try {
      await api.adminDeleteRole(role.id);
      toast.success('Role deleted successfully');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete role'));
    }
  }

  async function sendTestEmail() {
    setSendingTestEmail(true);
    try {
      const res = await api.adminSendTestEmail();
      toast.success(res.message || 'Test email sent');
    } catch (err) {
      toast.error(errorMessage(err, 'Test email failed'));
    } finally {
      setSendingTestEmail(false);
    }
  }

  const label = { fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' };
  const field = { color: 'var(--ws-fg)', background: 'var(--ws-sunken)' };
  const th: React.CSSProperties = {
    padding: '12px 14px', fontSize: 'var(--fs-100)', textTransform: 'uppercase',
    letterSpacing: '0.03em', fontWeight: 'var(--fw-strong)', color: 'var(--ws-fg-muted)',
  };
  const td: React.CSSProperties = { padding: '12px 14px' };

  return (
    <>
      {active && (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          {can('users', 'create') && (
            <SectionAction>
              <button onClick={() => { setUserForm(EMPTY_USER); setShowUserModal(true); }} className="primary" style={{ minHeight: '40px' }}>
                <Plus size={16} /> New Staff User
              </button>
            </SectionAction>
          )}

          {/* Roles & custom RBAC */}
          {can('roles') && (
            <section className="data-section" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Roles &amp; Access Control</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
                    Define role permissions across system resources. Built-in roles map to system
                    defaults; custom roles can tailor row-level scope and CRUD actions.
                  </p>
                </div>
                {can('roles', 'create') && (
                  <button onClick={openCreateRole} className="primary" style={{ minHeight: '38px', fontSize: 'var(--fs-300)' }}>
                    <Plus size={14} /> New Custom Role
                  </button>
                )}
              </div>

              {roles.length === 0 ? (
                <p className="empty">No roles loaded.</p>
              ) : (
                <div className="scroll-x">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={th}>Role</th>
                        <th style={th}>Slug</th>
                        <th style={th}>Type</th>
                        <th style={th}>Assigned Users</th>
                        <th style={th}>Description</th>
                        <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((r) => {
                        const isSuperAdmin = r.name === 'super_admin';
                        const rs = ROLE_STYLES[r.name] ?? { tone: 'info' as Tone, label: r.label };
                        return (
                          <tr key={r.id} style={{ borderTop: '1px solid var(--tone-neutral-bg)' }}>
                            <td style={td}><Badge tone={rs.tone} upper>{r.label}</Badge></td>
                            <td style={{ ...td, color: 'var(--ws-fg-muted)', fontFamily: 'monospace', fontSize: 'var(--fs-200)' }}>{r.name}</td>
                            <td style={td}>
                              <Badge tone={r.is_built_in ? 'neutral' : 'positive'}>{r.is_built_in ? 'Built-in' : 'Custom'}</Badge>
                            </td>
                            <td style={{ ...td, color: 'var(--ws-fg-muted)' }}>{r.user_count ?? 0} user(s)</td>
                            <td style={{ ...td, color: 'var(--ws-fg-muted)', fontSize: 'var(--fs-200)', maxWidth: '280px' }}>{r.description || '—'}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                {isSuperAdmin ? (
                                  <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                    <Lock size={12} /> Locked
                                  </span>
                                ) : (
                                  <>
                                    {can('roles', 'update') && (
                                      <button onClick={() => openEditRole(r)} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 10px', fontSize: 'var(--fs-100)', color: 'var(--ws-fg)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                        <Edit2 size={12} /> Edit Grants
                                      </button>
                                    )}
                                    {!r.is_built_in && can('roles', 'delete') && (
                                      <button
                                        onClick={() => deleteRole(r)}
                                        disabled={(r.user_count || 0) > 0}
                                        title={(r.user_count || 0) > 0 ? `Cannot delete role assigned to ${r.user_count} user(s)` : 'Delete role'}
                                        style={{ background: 'var(--ws-panel)', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: (r.user_count || 0) > 0 ? 'var(--ws-fg-faint)' : 'var(--tone-danger-fg)', cursor: (r.user_count || 0) > 0 ? 'not-allowed' : 'pointer', display: 'inline-flex' }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Email delivery */}
          <section className="data-section" style={{ marginTop: 0 }}>
            <h2>Email Delivery</h2>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
              Onboarding invitations and event broadcasts are sent over the Resend API or SMTP,
              whichever is configured. Send a test to your own address to prove delivery without
              emailing students.
            </p>
            {!emailStatus ? (
              <p style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)' }}>Checking…</p>
            ) : (
              <article className="panel" style={{ padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Badge tone={emailStatus.looks_healthy ? 'positive' : 'danger'} upper>
                    {emailStatus.configured ? (emailStatus.looks_healthy ? 'Configured' : 'Needs attention') : 'Not configured'}
                  </Badge>
                  {emailStatus.configured && (
                    <Badge tone="neutral" upper>via {emailStatus.transport === 'resend' ? 'Resend API' : 'SMTP'}</Badge>
                  )}
                  <button
                    onClick={sendTestEmail}
                    disabled={sendingTestEmail || !emailStatus.configured}
                    style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: '8px 14px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)', cursor: emailStatus.configured ? 'pointer' : 'not-allowed', opacity: emailStatus.configured ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                  >
                    <Mail size={14} /> {sendingTestEmail ? 'Sending…' : 'Send test email to myself'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                  {/* SMTP host/port/credentials are inert when the API transport
                      is in use, so showing them would only invite false
                      diagnoses. */}
                  {emailStatus.transport === 'resend' ? (
                    <>
                      <span>Transport: <strong style={{ color: 'var(--ws-fg)' }}>Resend HTTPS API</strong></span>
                      <span>API key: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.has_api_key ? 'set' : 'not set'}</strong></span>
                    </>
                  ) : (
                    <>
                      <span>Host: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.host || 'Not set'}</strong></span>
                      <span>Port: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.port || 'Not set'}</strong></span>
                      <span>Username: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.has_username ? 'set' : 'not set'}</strong></span>
                      <span>Password: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.has_password ? 'set' : 'not set'}</strong></span>
                    </>
                  )}
                  <span>From: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.from || 'Not set'}</strong></span>
                  <span>Claim-link base: <strong style={{ color: 'var(--ws-fg)' }}>{emailStatus.frontend_url || 'Not set'}</strong></span>
                </div>
                {(emailStatus.issues ?? []).length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: 'var(--space-1)' }}>
                    {(emailStatus.issues ?? []).map((issue) => (
                      <li key={issue} style={{ fontSize: 'var(--fs-200)', color: 'var(--tone-danger-fg)' }}>{issue}</li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </section>

          {/* All user accounts */}
          <section className="data-section" style={{ marginTop: 0 }}>
            <h2>User Accounts</h2>
            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
              Every account in the system. Students are created by claiming an onboarding invite;
              staff are created here. Deleting a student clears their capstone data and reopens the
              enrollment for re-invitation.
            </p>

            <Loadable
              loading={loading}
              empty={users.length === 0}
              emptyMessage="No users found."
              emptyIcon={<Users size={26} strokeWidth={1.5} />}
            >
              <div className="scroll-x">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <th style={th}>Name</th>
                      <th style={th}>Email</th>
                      <th style={th}>Role</th>
                      <th style={th}>Status</th>
                      <th style={th}>Created</th>
                      <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const rs = ROLE_STYLES[u.role] ?? { tone: 'neutral' as Tone, label: u.role };
                      const isSelf = u.id === user?.id;
                      return (
                        <tr key={u.id} style={{ borderTop: '1px solid var(--tone-neutral-bg)', opacity: u.is_active ? 1 : 0.55 }}>
                          <td style={{ ...td, fontWeight: 'var(--fw-medium)' }}>
                            {u.full_name}
                            {isSelf && <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', fontWeight: 'var(--fw-regular)' }}> (you)</span>}
                          </td>
                          <td style={{ ...td, color: 'var(--ws-fg-muted)' }}>{u.email}</td>
                          <td style={td}><Badge tone={rs.tone} upper>{rs.label}</Badge></td>
                          <td style={{ ...td, color: u.is_active ? 'var(--tone-positive-fg)' : 'var(--tone-danger-fg)' }}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </td>
                          <td style={{ ...td, color: 'var(--ws-fg-subtle)', fontSize: 'var(--fs-200)' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {isSelf ? (
                              <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-faint)' }}>—</span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                                {can('users', 'update') && (
                                  <button onClick={() => toggleUserActive(u)} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 10px', fontSize: 'var(--fs-100)', color: 'var(--ws-fg)', cursor: 'pointer' }}>
                                    {u.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                )}
                                {can('users', 'delete') && (
                                  <button onClick={() => deleteUser(u)} title="Delete permanently" style={{ background: 'var(--ws-panel)', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: 'var(--tone-danger-fg)', cursor: 'pointer', display: 'inline-flex' }}>
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Loadable>
          </section>
        </div>
      )}

      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="New Staff User"
        description="Staff accounts only. Students are created by claiming an onboarding invitation."
        footer={
          <button type="submit" form="user-form" disabled={savingUser} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
            {savingUser ? 'Creating…' : 'Create User'}
          </button>
        }
      >
        <form id="user-form" onSubmit={saveUser} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <label style={label}>Full Name</label>
            <input required value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} style={field} />
          </div>
          <div>
            <label style={label}>Email</label>
            <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={field} />
          </div>
          <div>
            <label style={label}>Temporary Password (min 10 characters)</label>
            <input required type="password" minLength={10} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} style={field} />
          </div>
          <div>
            <label style={label}>Role</label>
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={field}>
              {roles.length > 0 ? (
                roles.filter((r) => r.name !== 'student').map((r) => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))
              ) : (
                <>
                  <option value="admissions">Admissions</option>
                  <option value="admin">Admin</option>
                  {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                </>
              )}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={roleForm.id ? `Edit Role: ${roleForm.label}` : 'Create Custom Role'}
        width="min(720px, 100%)"
        footer={
          <button type="submit" form="role-form" disabled={savingRole} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
            {savingRole ? 'Saving…' : roleForm.id ? 'Update Role' : 'Create Role'}
          </button>
        }
      >
        <form id="role-form" onSubmit={saveRole} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Role Label (display name)</label>
              <input required placeholder="e.g. Sales Representative" value={roleForm.label} onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })} style={field} />
            </div>
            <div>
              <label style={label}>Slug Name {roleForm.id ? '(readonly)' : '(lowercase_slug)'}</label>
              <input
                required
                disabled={!!roleForm.id}
                placeholder="e.g. sales_rep"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                style={{ ...field, background: roleForm.id ? 'var(--tone-neutral-bg)' : 'var(--ws-sunken)' }}
              />
            </div>
          </div>
          <div>
            <label style={label}>Description</label>
            <input placeholder="Short summary of permissions…" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} style={field} />
          </div>

          <div>
            <label style={{ ...label, fontWeight: 'var(--fw-strong)' }}>Resource Grants &amp; Scope</label>
            {editingRole?.is_built_in && (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-200)', color: 'var(--tone-notice-fg)', background: 'var(--tone-notice-bg)', border: '1px solid #e8dca4', borderRadius: '6px', padding: '8px 10px', lineHeight: 'var(--lh-body)' }}>
                <Lock size={12} style={{ verticalAlign: '-2px' }} /> Built-in role. Its grants are
                fixed and reset on every deploy. The label and description are editable. To vary
                permissions, create a custom role.
              </p>
            )}
            <div className="scroll-x" style={{ marginTop: 'var(--space-2)' }}>
              <table className="perm-matrix">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Read</th>
                    <th>Create</th>
                    <th>Update</th>
                    <th>Delete</th>
                    <th>Read Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {roleForm.permissions.map((p) => {
                    // All built-in role grants are immutable, not just
                    // super_admin's: the server reseeds them from its
                    // specification on every boot, so an edit would revert.
                    const isBuiltInEdit = editingRole?.is_built_in === true;
                    return (
                      <tr key={p.resource}>
                        <td>{p.resource}</td>
                        {(['can_read', 'can_create', 'can_update', 'can_delete'] as const).map((f) => (
                          <td key={f}>
                            <input
                              type="checkbox"
                              disabled={isBuiltInEdit}
                              checked={p[f]}
                              onChange={(e) => handlePermChange(p.resource, f, e.target.checked)}
                            />
                          </td>
                        ))}
                        <td>
                          <select
                            disabled={isBuiltInEdit}
                            value={p.scope}
                            onChange={(e) => handlePermChange(p.resource, 'scope', e.target.value)}
                          >
                            <option value="none">None</option>
                            <option value="own">Own</option>
                            <option value="all">All</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
