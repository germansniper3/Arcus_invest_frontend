import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import { zmw } from '../../lib/money';
import type { ApprovalRequest, ApprovalRule, ApprovalAction, CustomRole } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { Loadable } from '../../components/Loadable';
import { useRefreshSignal } from '../../lib/refresh';

/**
 * `consumed` is green rather than grey: it is the only status meaning the gated
 * action actually happened, which is what someone scanning the list is usually
 * looking for.
 */
const STATUS_ACCENT: Record<string, string> = {
  pending: 'var(--copper)',
  approved: 'var(--ws-accent)',
  consumed: 'var(--ws-accent)',
  rejected: 'var(--tone-danger-fg)',
  cancelled: 'var(--ws-fg-subtle)',
};

/** The actions the approvals engine can gate. */
const ACTION_LABELS: Record<string, string> = {
  'deal.close_won': 'Close deal as Won',
  'deal.delete': 'Delete deal',
  'contract.sign': 'Sign contract',
  'contract.delete': 'Delete contract',
  'payment.record': 'Record payment',
};

/**
 * Only super_admin may read the role list, but admin may configure thresholds.
 * These are the built-in roles granted approval decisions, so the picker still
 * works for an admin. The server validates the choice regardless.
 */
const APPROVER_ROLE_FALLBACK = ['super_admin', 'admin'];

const EMPTY_RULE = {
  action: 'deal.close_won' as ApprovalAction,
  min_amount: 0,
  required_count: 1,
  approver_role: 'super_admin',
  note: '',
};

interface Props {
  /** Whether approvals is the section on screen. */
  active: boolean;
}

export function ApprovalsSection({ active }: Props) {
  const can = useCan();

  // Three lists rather than one: an approver acts on "awaiting me", a requester
  // watches "mine", and everyone else is reading history. Filtering one list
  // client-side would mean deciding eligibility here, where the server decides.
  const [awaitingMe, setAwaitingMe] = useState<ApprovalRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);
  const [decided, setDecided] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [rejecting, setRejecting] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [roles, setRoles] = useState<CustomRole[]>([]);

  async function loadApprovals() {
    const [awaiting, mine, approved, rejected] = await Promise.all([
      api.adminApprovals({ awaiting: true }),
      api.adminApprovals({ mine: true }),
      api.adminApprovals({ status: 'approved' }),
      api.adminApprovals({ status: 'rejected' }),
    ]);
    setAwaitingMe(awaiting.items);
    setMyRequests(mine.items);
    setDecided([...approved.items, ...rejected.items]
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 25));

    // Thresholds are a secondary panel, so they are fetched separately and
    // allowed to fail. Inside the Promise.all above, one rejection discarded
    // four successful responses and rendered the whole tab as empty — which
    // reads as "there is nothing to approve", the most dangerous possible lie
    // for this screen to tell.
    try {
      setRules((await api.adminApprovalRules()).items);
    } catch {
      setRules([]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      // Roles populate the approver picker. Only super_admin may read them, so
      // this is best-effort — APPROVER_ROLE_FALLBACK covers everyone else.
      if (can('roles')) {
        try { setRoles(await api.adminListRoles()); } catch { setRoles([]); }
      }
      await loadApprovals();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load approvals'));
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

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setSavingRule(true);
    try {
      await api.adminCreateApprovalRule(ruleForm);
      toast.success('Threshold added');
      setShowRuleModal(false);
      setRuleForm(EMPTY_RULE);
      await loadApprovals();
    } catch (err) {
      // The server explains exactly why a rule is unsatisfiable (unknown role,
      // a role that cannot decide); that is far more useful than a generic
      // "could not save", so it is shown verbatim.
      toast.error(errorMessage(err, 'Could not save the threshold'));
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRule(rule: ApprovalRule) {
    try {
      await api.adminUpdateApprovalRule(rule.id, { is_active: !rule.is_active });
      await loadApprovals();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the threshold'));
    }
  }

  /**
   * The request whose status label should flash.
   *
   * Scoped to a decision the user just made, rather than keyed on the status
   * value alone: keying would replay the flash for every row on every load,
   * so a list of forty settled requests would strobe on arrival. The status
   * change is only news when you are the one who caused it.
   */
  const [justDecided, setJustDecided] = useState<string | null>(null);
  useEffect(() => {
    if (!justDecided) return;
    const t = setTimeout(() => setJustDecided(null), 1000);
    return () => clearTimeout(t);
  }, [justDecided]);

  async function approveRequest(req: ApprovalRequest) {
    setDecidingId(req.id);
    try {
      await api.adminApproveRequest(req.id);
      toast.success('Approved');
      await loadApprovals();
      setJustDecided(req.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not approve'));
    } finally {
      setDecidingId(null);
    }
  }

  async function submitRejection(e: React.FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    const rejectedId = rejecting.id;
    setDecidingId(rejectedId);
    try {
      await api.adminRejectRequest(rejectedId, rejectReason);
      toast.success('Rejected');
      setRejecting(null);
      setRejectReason('');
      await loadApprovals();
      setJustDecided(rejectedId);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reject'));
    } finally {
      setDecidingId(null);
    }
  }

  async function resubmitRequest(req: ApprovalRequest) {
    setDecidingId(req.id);
    try {
      await api.adminResubmitRequest(req.id);
      toast.success('Resubmitted for approval');
      await loadApprovals();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not resubmit'));
    } finally {
      setDecidingId(null);
    }
  }

  const label = { fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' };
  const field = {
    padding: '9px 11px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)',
    background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)', borderRadius: '6px',
  };

  const QUEUES = [
    ['Awaiting your decision', awaitingMe, 'decide'],
    ['Your requests', myRequests, 'mine'],
    ['Recently decided', decided, 'history'],
  ] as const;

  return (
    <>
      {active && (
        <section className="data-section" style={{ marginTop: 0 }}>
          <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
            High-consequence actions held for a second pair of eyes. Approving does not perform the
            action. It unblocks whoever raised it, and they retry it themselves.
          </p>

          {/* Thresholds — collapsed by default, because configuring the gate is
              a rare act next to passing through it. */}
          <div style={{ marginBottom: 'var(--space-5)', background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '8px' }}>
            <button
              onClick={() => setShowRulesPanel((v) => !v)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', background: 'transparent', border: 'none', padding: '12px 14px', fontSize: 'var(--fs-300)', fontWeight: 'var(--fw-strong)', color: 'var(--ws-fg)', cursor: 'pointer', textAlign: 'left' }}
            >
              <span>Thresholds ({rules.filter((r) => r.is_active).length} active)</span>
              <span style={{ color: 'var(--ws-fg-subtle)', fontWeight: 'var(--fw-regular)' }}>{showRulesPanel ? 'Hide' : 'Show'}</span>
            </button>
            {showRulesPanel && (
              <div style={{ borderTop: '1px solid var(--ws-canvas)', padding: '12px 14px' }}>
                <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', marginTop: 0, marginBottom: 'var(--space-3)', lineHeight: 'var(--lh-body)' }}>
                  An action is gated at or above its threshold. Where several apply, the highest one
                  wins. With no threshold configured, an action is not gated at all.
                </p>
                {rules.length === 0 ? (
                  <p className="empty" style={{ fontSize: 'var(--fs-300)' }}>
                    Nothing is being gated. Add a threshold to require approval above an amount.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    {rules.map((r) => (
                      <div
                        key={r.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', padding: '8px 10px', background: r.is_active ? 'var(--ws-sunken)' : 'var(--ws-panel)', border: '1px solid var(--ws-canvas)', borderRadius: '6px', opacity: r.is_active ? 1 : 0.6 }}
                      >
                        <div style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>
                          <strong style={{ fontWeight: 'var(--fw-medium)' }}>{ACTION_LABELS[r.action] ?? r.action}</strong>
                          <span style={{ color: 'var(--ws-fg-muted)' }}>
                            {' '}at or above {zmw(r.min_amount)}: {r.required_count} approval{r.required_count > 1 ? 's' : ''} from {r.approver_role}
                          </span>
                          {r.note && <span style={{ color: 'var(--ws-fg-subtle)' }}> · {r.note}</span>}
                        </div>
                        {can('approvals', 'update') && (
                          <button onClick={() => toggleRule(r)} style={{ padding: '4px 10px', fontSize: 'var(--fs-200)', borderRadius: '5px', background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', color: 'var(--ws-fg)', cursor: 'pointer', flexShrink: 0 }}>
                            {r.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {can('approvals', 'create') && (
                  <button onClick={() => { setRuleForm(EMPTY_RULE); setShowRuleModal(true); }} style={{ padding: '7px 13px', fontSize: 'var(--fs-300)', borderRadius: '6px', background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', color: 'var(--ws-fg)', cursor: 'pointer' }}>
                    Add threshold
                  </button>
                )}
              </div>
            )}
          </div>

          <Loadable
            loading={loading}
            empty={false}
            emptyMessage=""
            emptyIcon={<ShieldCheck size={26} strokeWidth={1.5} />}
          >
            {QUEUES.map(([heading, rows, mode]) => (
              <div key={heading} style={{ marginBottom: 'var(--space-5)' }}>
                <h3 style={{ fontSize: 'var(--fs-200)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--fw-heavy)', color: 'var(--ws-fg-muted)', marginBottom: 'var(--space-2)' }}>
                  {heading} <span style={{ color: 'var(--ws-fg-subtle)', fontWeight: 'var(--fw-medium)' }}>({rows.length})</span>
                </h3>
                {rows.length === 0 ? (
                  <p className="empty" style={{ fontSize: 'var(--fs-300)' }}>
                    {mode === 'decide' ? 'Nothing is waiting on you.' : mode === 'mine' ? 'You have no requests open.' : 'No decisions yet.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {rows.map((r) => (
                      <div
                        key={r.id}
                        style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderLeft: `4px solid ${STATUS_ACCENT[r.status] ?? 'var(--ws-fg-subtle)'}`, borderRadius: '8px', padding: '12px 14px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-300)', fontWeight: 'var(--fw-medium)', color: 'var(--ws-fg)' }}>{r.summary}</div>
                            <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)', marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                              <span>{ACTION_LABELS[r.action] ?? r.action}</span>
                              <span>by {r.requester_name || 'Unknown'}</span>
                              <span>{new Date(r.created_at).toLocaleDateString()}</span>
                              {r.required_count > 1 && <span>{r.approved_count} of {r.required_count} approvals</span>}
                              {r.supersedes_id && <span style={{ color: 'var(--copper)' }}>resubmitted</span>}
                            </div>
                            {r.decisions.filter((d) => d.reason).map((d) => (
                              <div key={d.id} style={{ fontSize: 'var(--fs-200)', color: d.decision === 'rejected' ? 'var(--tone-danger-fg)' : 'var(--ws-fg-muted)', marginTop: 'var(--space-2)' }}>
                                {d.approver_name} {d.decision}: “{d.reason}”
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
                            {/* Keyed on the status so a decision remounts the
                                label and the flash actually replays. */}
                            <span key={r.status} className={justDecided === r.id ? 'badge-changed' : undefined} style={{ display: 'inline-block', fontSize: 'var(--fs-100)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 'var(--fw-heavy)', color: STATUS_ACCENT[r.status] ?? 'var(--ws-fg-subtle)' }}>{r.status}</span>
                            {mode === 'decide' && can('approvals', 'update') && (
                              <>
                                <button onClick={() => approveRequest(r)} disabled={decidingId === r.id} className="primary" style={{ padding: '6px 12px', fontSize: 'var(--fs-300)', borderRadius: '6px', cursor: 'pointer' }}>Approve</button>
                                <button onClick={() => { setRejecting(r); setRejectReason(''); }} disabled={decidingId === r.id} style={{ padding: '6px 12px', fontSize: 'var(--fs-300)', borderRadius: '6px', background: 'var(--ws-panel)', border: '1px solid var(--tone-danger-fg)', color: 'var(--tone-danger-fg)', cursor: 'pointer' }}>Reject</button>
                              </>
                            )}
                            {mode === 'mine' && r.status === 'rejected' && can('approvals', 'create') && (
                              <button onClick={() => resubmitRequest(r)} disabled={decidingId === r.id} style={{ padding: '6px 12px', fontSize: 'var(--fs-300)', borderRadius: '6px', background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', color: 'var(--ws-fg)', cursor: 'pointer' }}>Revise &amp; resubmit</button>
                            )}
                            {mode === 'mine' && r.status === 'approved' && (
                              <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-accent)' }}>Retry the action to apply it</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Loadable>
        </section>
      )}

      <Modal
        open={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title="Add approval threshold"
        width="min(560px, 100%)"
        footer={
          <button type="submit" form="rule-form" disabled={savingRule} className="primary" style={{ padding: '9px 16px', fontSize: 'var(--fs-300)', borderRadius: '6px', cursor: 'pointer' }}>
            {savingRule ? 'Saving…' : 'Add threshold'}
          </button>
        }
      >
        <form id="rule-form" onSubmit={saveRule} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gap: '5px' }}>
            <label style={label}>Action</label>
            <select value={ruleForm.action} onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value as ApprovalAction })} style={field}>
              {Object.entries(ACTION_LABELS).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gap: '5px' }}>
              <label style={label}>Applies at or above (ZMW)</label>
              {/* Blank renders for 0, which reads correctly as "no minimum". */}
              <NumberField min="0" value={ruleForm.min_amount} onChange={(min_amount) => setRuleForm({ ...ruleForm, min_amount })} />
            </div>
            <div style={{ display: 'grid', gap: '5px' }}>
              <label style={label}>Approvals required</label>
              <NumberField min="1" value={ruleForm.required_count} onChange={(required_count) => setRuleForm({ ...ruleForm, required_count })} />
            </div>
          </div>
          <div style={{ display: 'grid', gap: '5px' }}>
            <label style={label}>Approver role</label>
            <select value={ruleForm.approver_role} onChange={(e) => setRuleForm({ ...ruleForm, approver_role: e.target.value })} style={field}>
              {roles.length > 0
                ? roles.map((r) => <option key={r.id} value={r.name}>{r.label}</option>)
                : APPROVER_ROLE_FALLBACK.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', lineHeight: 'var(--lh-body)' }}>
              The role must be able to decide approvals, or the action would be blocked with nobody
              able to release it. The server refuses a rule that cannot be satisfied.
            </span>
          </div>
          <div style={{ display: 'grid', gap: '5px' }}>
            <label style={label}>Note (optional)</label>
            <input value={ruleForm.note} onChange={(e) => setRuleForm({ ...ruleForm, note: e.target.value })} placeholder="e.g. Board policy, revised March 2026" style={field} />
          </div>
        </form>
      </Modal>

      {/* Driven by the `open` prop rather than conditionally rendered, so focus
          returns to where it came from when the dialog closes. */}
      <Modal
        open={rejecting !== null}
        onClose={() => { setRejecting(null); setRejectReason(''); }}
        title="Reject request"
        description={rejecting?.summary}
        width="min(520px, 100%)"
        footer={
          <button
            type="submit"
            form="reject-form"
            disabled={decidingId !== null || rejectReason.trim() === ''}
            style={{ padding: '9px 16px', fontSize: 'var(--fs-300)', borderRadius: '6px', background: 'var(--tone-danger-fg)', border: '1px solid var(--tone-danger-fg)', color: '#fff', cursor: rejectReason.trim() === '' ? 'not-allowed' : 'pointer', opacity: rejectReason.trim() === '' ? 0.6 : 1 }}
          >
            Reject
          </button>
        }
      >
        <form id="reject-form" onSubmit={submitRejection} style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <label style={{ ...label, lineHeight: 'var(--lh-body)' }}>
            Reason. The requester sees this and revises against it, so a rejection without one is a
            dead end.
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            rows={4}
            placeholder="e.g. Discount exceeds what was agreed for this account"
            style={{ ...field, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </form>
      </Modal>
    </>
  );
}
