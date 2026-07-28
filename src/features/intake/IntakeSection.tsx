import { useEffect, useState } from 'react';
import { Plus, UserPlus, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Enrollment } from '../../types';
import { Modal } from '../../components/Modal';
import { SectionAction } from '../../components/SectionAction';

const EMPTY_FORM = { full_name: '', email: '', phone: '', location: '', tier: 'Builder', about: '', notes: '' };

interface Props {
  /** See CatalogueSection: the body is conditional, the modal never unmounts. */
  active: boolean;
}

export function IntakeSection({ active }: Props) {
  const can = useCan();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setEnrollments(await api.enrollments());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data');
    }
  }

  useEffect(() => {
    if (active) load();
  }, [active]);

  async function updateStatus(item: Enrollment, status: string) {
    try {
      const updated = await api.updateEnrollment(item.id, { status });
      setEnrollments((rows) => rows.map((row) => row.id === item.id ? updated : row));
      toast.success(`Enrollment status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  async function updateTier(item: Enrollment, tier: string) {
    try {
      const updated = await api.updateEnrollment(item.id, { tier });
      setEnrollments((rows) => rows.map((row) => row.id === item.id ? updated : row));
      toast.success(`Enrollment tier updated to ${tier}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tier');
    }
  }

  async function generateInviteLink(item: Enrollment) {
    try {
      const res = await api.generateInvite(item.id);
      setInviteUrl(res.claim_url);
      setSelected(item);
      if (res.emailed) {
        toast.success(`Invitation emailed to ${item.email}`);
      } else {
        // Delivery is best-effort — the link still works, so say what to do next.
        toast.warning(`Invitation created, but email was not sent (${res.email_error || 'unknown reason'}). Copy the link below and send it manually.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invitation');
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.adminCreateEnrollment(form);
      toast.success('Enrollment created — you can now send the onboarding invite.');
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create enrollment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {active && can('enrollments', 'create') && (
        <SectionAction>
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }} className="primary" style={{ minHeight: '40px' }}>
            <Plus size={16} /> New Enrollment
          </button>
        </SectionAction>
      )}

      {active && (
        <div style={{ display: 'grid', gap: '24px' }}>
          <section className="data-section">
            <h2>Recent Enrollment Applications</h2>
            <div className="table">
              {enrollments.length === 0 ? (
                <p className="empty">No applications filed yet.</p>
              ) : (
                enrollments.map((item) => (
                  <article key={item.id} className="row" style={{ gridTemplateColumns: '1.2fr auto auto auto auto', gap: '16px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{item.full_name}</strong>
                      <span style={{ fontSize: '13px', color: '#5a625d', marginLeft: '8px' }}>{item.email} · {item.phone}</span>
                      <p style={{ fontSize: '13px', marginBlock: '8px', color: '#5a625d' }}><strong>Project Direction:</strong> {item.project_idea || item.interests}</p>
                      {item.orientation_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c98745' }}>
                          <Clock size={12} /> Orientation set for: {new Date(item.orientation_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Tier dropdown selection */}
                    <div>
                      <select
                        value={item.tier}
                        disabled={!can('enrollments', 'update')}
                        onChange={(e) => updateTier(item, e.target.value)}
                        style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', padding: '6px 10px', fontSize: '12px' }}
                      >
                        <option value="Explorer">Explorer</option>
                        <option value="Builder">Builder</option>
                        <option value="Professional">Professional</option>
                      </select>
                    </div>

                    {/* Status select dropdown */}
                    <div>
                      <select
                        value={item.status}
                        disabled={!can('enrollments', 'update')}
                        onChange={(e) => updateStatus(item, e.target.value)}
                        style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', padding: '6px 10px', fontSize: '12px' }}
                      >
                        <option value="submitted">Submitted</option>
                        <option value="pending_orientation">Pending Orientation</option>
                        <option value="orientation_complete">Orientation Complete</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <div>
                      {can('enrollments', 'create') && (
                        <button
                          onClick={() => generateInviteLink(item)}
                          className="primary"
                          style={{ minHeight: '34px', fontSize: '12px', padding: '0 12px', background: 'var(--accent)', color: '#11170e' }}
                        >
                          <UserPlus size={14} /> Invite Link
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Generated Invite Modal / Link overlay */}
          {selected && inviteUrl && (
            <div style={{ background: '#f7f8f3', border: '1px solid var(--copper)', borderRadius: '8px', padding: '20px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--copper)' }}>Onboarding Registration Link for {selected.full_name}</strong>
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: '13px', margin: '8px 0 12px' }}>Copy this secure URL and share it with the applicant. They will be prompted to choose a password and write down their capstone brief to claim workspace access.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input readOnly value={inviteUrl} style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1' }} />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success('Onboarding invite URL copied to clipboard');
                  }}
                  className="primary"
                  style={{ minHeight: '44px', whiteSpace: 'nowrap' }}
                >
                  Copy Link
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Enrollment Modal (admin-initiated onboarding) */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Enrollment"
        description="Create an enrollment record directly, then send the onboarding invite from the list."
        footer={<button type="submit" form="enrollment-form" disabled={saving} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{saving ? 'Creating…' : 'Create Enrollment'}</button>}
      >
        <form id="enrollment-form" onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Full Name</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Email</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Tier</label>
              <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                {['Explorer', 'Builder', 'Professional'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes (internal)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '70px' }} />
          </div>
        </form>
      </Modal>
    </>
  );
}
