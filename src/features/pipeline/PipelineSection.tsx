import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import { useReportIfBlocked, NIL_UUID } from '../../lib/useReportIfBlocked';
import { zmw } from '../../lib/money';
import type {
  User, Opportunity, OpportunityActivity, ActivityType, OpportunityStage,
  OpportunityGrade, OpportunitySegment, OpportunityContact, OpportunityLineItem,
  Payment, PaymentMethod, PipelineForecast,
} from '../../types';
import DocumentView, { type DocumentKind, VAT_RATE } from '../../components/DocumentView';
import { NumberField } from '../../components/NumberField';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Loadable';
import { SectionAction } from '../../components/SectionAction';
import { SectionMetrics } from '../../components/SectionMetrics';
import { Badge } from '../../components/Badge';
import {
  STAGE_ORDER, STAGE_LABELS, GRADE_STYLES, SEGMENT_STYLES, CONTACT_ROLES,
  ACTIVITY_TYPES, ACTIVITY_STYLE, PAYMENT_METHODS, PAYMENT_METHOD_LABEL,
} from '../../lib/dealTaxonomy';
import { useRefreshSignal } from '../../lib/refresh';

/** Probability the server re-seeds a deal to when its stage changes. Mirrored
 *  here so the form's figure matches what the save will produce. */
const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  prospecting: 10, qualified: 30, proposal: 50, negotiation: 70, won: 100, lost: 0,
};

/**
 * A factory rather than a shared constant: the blank deal carries two arrays,
 * and one frozen object handed to every reset would have them aliased across
 * forms.
 */
const emptyOpportunity = () => ({
  id: '', name: '', account_name: '', contact_name: '', contact_email: '', sector: '',
  segment: 'standard' as OpportunitySegment, stage: 'prospecting' as OpportunityStage,
  grade: 'bronze' as OpportunityGrade, deal_value: 0, probability: 10, owner_id: '',
  expected_close_at: '', notes: '', contacts: [] as OpportunityContact[],
  line_items: [] as OpportunityLineItem[], apply_vat: false, invoiced_at: '',
});

const emptyPayment = () => ({
  amount: 0, method: 'bank_transfer' as PaymentMethod, reference: '', note: '',
});

interface Props {
  /**
   * Whether the pipeline is the section on screen. The component stays mounted
   * either way so its dialog is never torn down — Radix restores focus on the
   * open→closed transition, which an unmounted dialog never emits.
   */
  active: boolean;
}

export function PipelineSection({ active }: Props) {
  const can = useCan();
  const reportIfBlocked = useReportIfBlocked();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [forecast, setForecast] = useState<PipelineForecast | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyOpportunity());

  // Engagement log for the opportunity currently open in the modal.
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityForm, setActivityForm] = useState<{ type: ActivityType; body: string }>({ type: 'note', body: '' });
  const [loggingActivity, setLoggingActivity] = useState(false);

  // Payments recorded against the opportunity currently open in the modal.
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentForm, setPaymentForm] = useState(emptyPayment());
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Document generator overlay (quotation / invoice / receipt).
  const [docState, setDocState] = useState<{ kind: DocumentKind; opportunity: Opportunity; receiptPayment?: Payment } | null>(null);
  const [applyVat, setApplyVat] = useState(true);

  const staffName = (id?: string | null) =>
    (id ? staff.find((s) => s.id === id)?.full_name ?? 'Unknown' : '');

  async function load() {
    setLoading(true);
    try {
      const [nextOpportunities, nextForecast, nextStaff] = await Promise.all([
        api.adminListOpportunities(),
        api.adminPipelineForecast(),
        api.adminListStaff(),
      ]);
      setOpportunities(nextOpportunities);
      setForecast(nextForecast);
      setStaff(nextStaff);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load the pipeline'));
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

  /** Refetches the board and the forecast after a change. The staff list does
   *  not move with a deal, so it is not refetched here. */
  async function reload() {
    try {
      const [nextOpportunities, nextForecast] = await Promise.all([
        api.adminListOpportunities(),
        api.adminPipelineForecast(),
      ]);
      setOpportunities(nextOpportunities);
      setForecast(nextForecast);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to refresh pipeline'));
    }
  }

  function openCreate() {
    setForm(emptyOpportunity());
    setActivities([]);
    setActivityForm({ type: 'note', body: '' });
    setPayments([]);
    setPaymentForm(emptyPayment());
    setShowModal(true);
  }

  function openEdit(o: Opportunity) {
    setForm({
      id: o.id, name: o.name, account_name: o.account_name, contact_name: o.contact_name,
      contact_email: o.contact_email, sector: o.sector, segment: o.segment ?? 'standard',
      stage: o.stage, grade: o.grade, deal_value: o.deal_value, probability: o.probability,
      owner_id: o.owner_id ?? '',
      expected_close_at: o.expected_close_at ? o.expected_close_at.slice(0, 10) : '',
      notes: o.notes,
      contacts: (o.contacts ?? []).map((c) => ({ ...c })),
      line_items: (o.line_items ?? []).map((li) => ({ ...li })),
      apply_vat: o.apply_vat ?? false,
      invoiced_at: o.invoiced_at ? o.invoiced_at.slice(0, 10) : '',
    });
    setActivityForm({ type: 'note', body: '' });
    setPaymentForm(emptyPayment());
    setShowModal(true);
    loadActivities(o.id);
    loadPayments(o.id);
  }

  function addLineItem() {
    setForm((prev) => ({ ...prev, line_items: [...prev.line_items, { description: '', quantity: 1, unit_price: 0 }] }));
  }
  function updateLineItem(i: number, patch: Partial<OpportunityLineItem>) {
    setForm((prev) => ({ ...prev, line_items: prev.line_items.map((li, idx) => (idx === i ? { ...li, ...patch } : li)) }));
  }
  function removeLineItem(i: number) {
    setForm((prev) => ({ ...prev, line_items: prev.line_items.filter((_, idx) => idx !== i) }));
  }

  function addContact() {
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, { name: '', role: 'decision_maker', email: '', is_primary: prev.contacts.length === 0 }] }));
  }
  function updateContact(i: number, patch: Partial<OpportunityContact>) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }
  function removeContact(i: number) {
    setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }));
  }

  async function loadActivities(opportunityId: string) {
    setActivitiesLoading(true);
    try {
      setActivities(await api.adminListActivities(opportunityId));
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function logActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id || !activityForm.body.trim()) return;
    setLoggingActivity(true);
    try {
      await api.adminCreateActivity(form.id, { type: activityForm.type, body: activityForm.body.trim() });
      setActivityForm({ type: 'note', body: '' });
      await loadActivities(form.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to log activity'));
    } finally {
      setLoggingActivity(false);
    }
  }

  async function loadPayments(opportunityId: string) {
    try {
      setPayments(await api.adminListPayments(opportunityId));
    } catch {
      setPayments([]);
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id || Number(paymentForm.amount) <= 0) return;
    setRecordingPayment(true);
    try {
      await api.adminCreatePayment(form.id, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        note: paymentForm.note.trim(),
      });
      setPaymentForm(emptyPayment());
      await loadPayments(form.id);
      toast.success('Payment recorded');
    } catch (err) {
      if (!reportIfBlocked(err)) toast.error(errorMessage(err, 'Failed to record payment'));
    } finally {
      setRecordingPayment(false);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm('Remove this payment record?')) return;
    try {
      await api.adminDeletePayment(id);
      if (form.id) await loadPayments(form.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove payment'));
    }
  }

  // Assemble the current modal's form back into an Opportunity for the document
  // generator (line items + contacts as edited, without needing a re-fetch).
  function openDocument(kind: DocumentKind, receiptPayment?: Payment) {
    const opp: Opportunity = {
      id: form.id,
      created_at: '', updated_at: '',
      name: form.name,
      account_name: form.account_name,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      sector: form.sector,
      segment: form.segment,
      stage: form.stage,
      grade: form.grade,
      deal_value: Number(form.deal_value) || 0,
      probability: Number(form.probability),
      weighted_value: 0,
      owner_id: form.owner_id || null,
      expected_close_at: form.expected_close_at ? new Date(form.expected_close_at).toISOString() : null,
      notes: form.notes,
      contacts: form.contacts,
      line_items: form.line_items.map((li) => ({ ...li, quantity: Number(li.quantity) || 1, unit_price: Number(li.unit_price) || 0 })),
      line_items_total: form.line_items.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0),
      apply_vat: form.apply_vat,
      invoiced_at: form.invoiced_at || null,
      // The server is authoritative for this; the document generator computes
      // its own totals from the line items above, so a local value would only
      // go stale.
      invoiced_total: 0,
    };
    // Seed the document's VAT toggle from the deal, so the invoice a client
    // receives and the balance in receivables cannot disagree.
    setApplyVat(form.apply_vat);
    setDocState({ kind, opportunity: opp, receiptPayment });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: Partial<Opportunity> = {
      name: form.name,
      account_name: form.account_name,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      sector: form.sector,
      segment: form.segment,
      stage: form.stage,
      grade: form.grade,
      deal_value: Number(form.deal_value) || 0,
      probability: Number(form.probability),
      owner_id: form.owner_id || NIL_UUID, // nil UUID = unassign server-side
      expected_close_at: form.expected_close_at ? new Date(form.expected_close_at).toISOString() : null,
      notes: form.notes,
      contacts: form.contacts.filter((c) => c.name.trim()),
      line_items: form.line_items.filter((li) => li.description.trim()).map((li) => ({ description: li.description, quantity: Number(li.quantity) || 1, unit_price: Number(li.unit_price) || 0 })),
    };
    try {
      if (form.id) {
        await api.adminUpdateOpportunity(form.id, payload);
        toast.success('Opportunity updated');
      } else {
        await api.adminCreateOpportunity(payload);
        toast.success('Opportunity created');
      }
      setShowModal(false);
      reload();
    } catch (err) {
      if (!reportIfBlocked(err)) toast.error(errorMessage(err, 'Failed to save opportunity'));
    }
  }

  /** Fast pipeline movement: change stage inline (probability re-seeds server-side). */
  /**
   * The deal whose card should play its arrival animation.
   *
   * Set only after the server has confirmed the move, so the animation is a
   * report of what happened rather than an optimistic guess — a card that
   * flashed "landed" and then snapped back on a rejected move would be worse
   * than the silence this replaces.
   */
  const [justMoved, setJustMoved] = useState<string | null>(null);

  // Clearing it stops the class from riding along on later renders. The
  // animation itself has long finished; this is bookkeeping, not timing.
  useEffect(() => {
    if (!justMoved) return;
    const t = setTimeout(() => setJustMoved(null), 1000);
    return () => clearTimeout(t);
  }, [justMoved]);

  async function moveStage(o: Opportunity, stage: OpportunityStage) {
    if (o.stage === stage) return;
    try {
      await api.adminUpdateOpportunity(o.id, { stage });
      await reload();
      setJustMoved(o.id);
    } catch (err) {
      // Reload either way. The <select> is uncontrolled between renders, so a
      // refused move otherwise leaves the dropdown showing a stage the server
      // rejected — the exact "it looked like it worked" failure this feature
      // exists to prevent.
      reload();
      if (!reportIfBlocked(err)) toast.error(errorMessage(err, 'Failed to move opportunity'));
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    try {
      await api.adminDeleteOpportunity(id);
      toast.success('Opportunity deleted');
      setShowModal(false);
      reload();
    } catch (err) {
      if (!reportIfBlocked(err)) toast.error(errorMessage(err, 'Failed to delete opportunity'));
    }
  }

  // Records (or undoes) the billing date that starts a receivable ageing. Kept
  // separate from the deal form so it is a deliberate act rather than something
  // a stray Save could set.
  async function markInvoiced(clear: boolean) {
    if (!form.id) return;
    try {
      const updated = await api.adminMarkInvoiced(form.id, clear ? { clear: true } : {});
      setForm((f) => ({ ...f, invoiced_at: updated.invoiced_at ? updated.invoiced_at.slice(0, 10) : '' }));
      toast.success(clear ? 'Invoice date cleared' : 'Marked invoiced');
      reload();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the invoice date'));
    }
  }

  const label = { fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' };
  const field = { color: 'var(--ws-fg)', background: 'var(--ws-sunken)' };
  const cell = { ...field, fontSize: 'var(--fs-300)', padding: 'var(--space-2) 10px' };
  const chipBtn = {
    background: 'var(--ws-canvas)', border: 0, borderRadius: '4px',
    padding: 'var(--space-1) 10px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
  };
  const removeBtn = {
    background: 'var(--ws-sunken)', border: '1px solid var(--ws-border)', borderRadius: '4px',
    padding: 'var(--space-2)', cursor: 'pointer', color: 'var(--tone-danger-fg)', display: 'inline-flex',
  };
  const docBtn = {
    background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '6px',
    padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
  };
  const subHead = { margin: 0, fontSize: 'var(--fs-400)' };
  const quiet = { fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)', margin: 0 };

  const itemsTotal = form.line_items.reduce(
    (s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0,
  );

  return (
    <>
      {active && (
        <>
          {can('opportunities', 'create') && (
            <SectionAction>
              <button onClick={openCreate} className="primary" style={{ minHeight: '40px' }}>
                <Plus size={16} /> New Opportunity
              </button>
            </SectionAction>
          )}

          {/* The forecast KPIs. Contributed through the metrics portal rather
              than rendered by the shell, so the shell no longer holds any
              pipeline state of its own. */}
          <SectionMetrics>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 'var(--fw-heavy)' }}>{zmw(forecast?.open_value ?? 0)}</span>
                <p style={{ margin: 'var(--space-1) 0 0' }}>Open Pipeline</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 'var(--fw-heavy)', color: 'var(--ws-accent)' }}>{zmw(forecast?.weighted_forecast ?? 0)}</span>
                <p style={{ margin: 'var(--space-1) 0 0' }}>Weighted Forecast</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 'var(--fw-heavy)' }}>{zmw(forecast?.won_value ?? 0)}</span>
                <p style={{ margin: 'var(--space-1) 0 0' }}>Won Value</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 'var(--fw-heavy)' }}>{Math.round(forecast?.win_rate ?? 0)}%</span>
                <p style={{ margin: 'var(--space-1) 0 0' }}>Win Rate ({forecast?.won_count ?? 0}W / {forecast?.lost_count ?? 0}L)</p>
              </article>
            </div>
          </SectionMetrics>

          {/* Stage board. Skeleton rather than the board while loading: six
              columns of "—" is an empty pipeline, which is a different claim
              from "not here yet". */}
          {loading ? (
            <Skeleton rows={4} />
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: 'var(--space-2)', alignItems: 'flex-start' }}>
              {STAGE_ORDER.map((stage) => {
                const col = opportunities.filter((o) => o.stage === stage);
                const colValue = col.reduce((sum, o) => sum + o.deal_value, 0);
                const isTerminal = stage === 'won' || stage === 'lost';
                return (
                  <div key={stage} style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px var(--space-1)' }}>
                      <strong style={{ fontSize: 'var(--fs-300)', textTransform: 'uppercase', letterSpacing: '0.03em', color: stage === 'won' ? 'var(--tone-positive-fg)' : stage === 'lost' ? 'var(--tone-danger-fg)' : 'var(--ws-fg)' }}>
                        {STAGE_LABELS[stage]} <span style={{ color: 'var(--ws-fg-subtle)' }}>· {col.length}</span>
                      </strong>
                      <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)' }}>{zmw(colValue)}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-2)', background: 'var(--ws-canvas)', borderRadius: '8px', padding: 'var(--space-2)', minHeight: '80px' }}>
                      {col.length === 0 ? (
                        <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)', textAlign: 'center', margin: 'var(--space-2) 0' }}>—</p>
                      ) : (
                        col.map((o) => {
                          const grade = GRADE_STYLES[o.grade];
                          return (
                            <div key={o.id} onClick={() => openEdit(o)} className={justMoved === o.id ? 'deal-landed' : undefined} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '8px', padding: 'var(--space-3)', cursor: 'pointer', display: 'grid', gap: 'var(--space-2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)', lineHeight: 'var(--lh-snug)' }}>{o.name}</strong>
                                <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {o.segment && o.segment !== 'standard' && (
                                    <Badge tone={SEGMENT_STYLES[o.segment].tone} upper>{SEGMENT_STYLES[o.segment].label}</Badge>
                                  )}
                                  <Badge tone={grade.tone} upper>{grade.label}</Badge>
                                </div>
                              </div>
                              {o.account_name && (
                                <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                                  {o.account_name}{o.sector ? ` · ${o.sector}` : ''}
                                </div>
                              )}
                              {o.contacts && o.contacts.length > 0 && (
                                <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>
                                  {o.contacts.length} stakeholder{o.contacts.length === 1 ? '' : 's'}
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <strong style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>{zmw(o.deal_value)}</strong>
                                <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-accent)', fontWeight: 'var(--fw-strong)' }}>{o.probability}%</span>
                              </div>
                              {!isTerminal && (
                                <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>Weighted {zmw(o.weighted_value)}</div>
                              )}
                              <div style={{ fontSize: 'var(--fs-100)', color: o.owner_id ? 'var(--tone-cool-fg)' : 'var(--ws-fg-faint)' }}>
                                {o.owner_id ? staffName(o.owner_id) : 'Unassigned'}
                              </div>
                              <select
                                value={o.stage}
                                disabled={!can('opportunities', 'update')}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => moveStage(o, e.target.value as OpportunityStage)}
                                style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)', padding: 'var(--space-1) var(--space-2)', minHeight: 0 }}
                              >
                                {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                              </select>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Opportunity */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Opportunity' : 'New Opportunity'}
        footer={
          <>
            {form.id && can('opportunities', 'delete') && (
              <button type="button" onClick={() => remove(form.id)} style={{ background: 'var(--ws-panel)', border: '1px solid #e2b4b4', color: 'var(--tone-danger-fg)', borderRadius: '8px', padding: '0 16px', minHeight: '44px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            {can('opportunities', form.id ? 'update' : 'create') && (
              <button type="submit" form="opportunity-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
                {form.id ? 'Save Changes' : 'Create Opportunity'}
              </button>
            )}
          </>
        }
      >
        <form id="opportunity-form" onSubmit={save} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <label style={label}>Opportunity Name</label>
            <input required placeholder="e.g. Data Centre migration — Phase 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={field} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Account / Company</label>
              <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} style={field} />
            </div>
            <div>
              <label style={label}>Sector</label>
              <input placeholder="e.g. Mining, Telecom" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} style={field} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Contact Name</label>
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={field} />
            </div>
            <div>
              <label style={label}>Contact Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} style={field} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Stage</label>
              <select
                value={form.stage}
                onChange={(e) => {
                  const stage = e.target.value as OpportunityStage;
                  setForm({ ...form, stage, probability: STAGE_PROBABILITY[stage] });
                }}
                style={field}
              >
                {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Maturity Grade</label>
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as OpportunityGrade })} style={field}>
                {(['bronze', 'silver', 'gold', 'platinum'] as OpportunityGrade[]).map((g) => <option key={g} value={g}>{GRADE_STYLES[g].label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Deal Value (ZMW)</label>
              <NumberField min="0" value={form.deal_value} onChange={(deal_value) => setForm({ ...form, deal_value })} />
            </div>
            <div>
              <label style={label}>Probability (%)</label>
              <NumberField min="0" max="100" value={form.probability} onChange={(probability) => setForm({ ...form, probability })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Segment</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as OpportunitySegment })} style={field}>
                {(['strategic', 'growth', 'standard'] as OpportunitySegment[]).map((s) => <option key={s} value={s}>{SEGMENT_STYLES[s].label}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Owner</label>
              <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} style={field}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Expected Close</label>
              <input type="date" value={form.expected_close_at} onChange={(e) => setForm({ ...form, expected_close_at: e.target.value })} style={field} />
            </div>
          </div>

          {/* Buying committee */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
              <label style={label}>Buying Committee</label>
              <button type="button" onClick={addContact} style={chipBtn}>
                <Plus size={12} /> Add contact
              </button>
            </div>
            {form.contacts.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)', margin: 0 }}>Who decides on this deal? Add them here.</p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {form.contacts.map((ct, i) => (
                  <div key={i} className="grid-record grid-record--contact" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr auto', gap: 'var(--space-1)', alignItems: 'center' }}>
                    <input placeholder="Name" value={ct.name} onChange={(e) => updateContact(i, { name: e.target.value })} style={cell} />
                    <select value={ct.role} onChange={(e) => updateContact(i, { role: e.target.value })} style={cell}>
                      {CONTACT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input placeholder="Email" value={ct.email} onChange={(e) => updateContact(i, { email: e.target.value })} style={cell} />
                    <button type="button" onClick={() => removeContact(i)} title="Remove" style={removeBtn}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Line items — priced goods/services for quotations & invoices */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
              <label style={label}>Line Items <span style={{ color: 'var(--ws-fg-subtle)' }}>(for quotes &amp; invoices)</span></label>
              <button type="button" onClick={addLineItem} style={chipBtn}>
                <Plus size={12} /> Add line
              </button>
            </div>
            {form.line_items.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)', margin: 0 }}>Without line items, quotations show one line at the deal value.</p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {form.line_items.map((li, i) => (
                  <div key={i} className="grid-record grid-record--item" style={{ display: 'grid', gridTemplateColumns: '1fr 66px 108px auto', gap: 'var(--space-1)', alignItems: 'center' }}>
                    <input placeholder="Description" value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} style={cell} />
                    <NumberField min="0" step="1" title="Quantity" value={li.quantity} onChange={(quantity) => updateLineItem(i, { quantity })} style={{ fontSize: 'var(--fs-300)', padding: 'var(--space-2) 10px' }} />
                    <NumberField min="0" title="Unit price (ZMW)" value={li.unit_price} onChange={(unit_price) => updateLineItem(i, { unit_price })} style={{ fontSize: 'var(--fs-300)', padding: 'var(--space-2) 10px' }} />
                    <button type="button" onClick={() => removeLineItem(i)} title="Remove" style={removeBtn}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                  Items total:&nbsp;<strong style={{ color: 'var(--ws-fg)' }}>{zmw(itemsTotal)}</strong>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={label}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...field, minHeight: '70px' }} />
          </div>

          <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', background: 'var(--ws-canvas)', borderRadius: '6px', padding: '10px var(--space-3)' }}>
            Weighted value: <strong style={{ color: 'var(--ws-accent)' }}>{zmw((Number(form.deal_value) || 0) * Number(form.probability) / 100)}</strong>
            {/* Billing state lives on the deal: VAT changes what the client
                owes, and the invoice date is what a receivable ages from. */}
            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--ws-border)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.apply_vat} onChange={(e) => setForm({ ...form, apply_vat: e.target.checked })} style={{ width: 'auto' }} />
                Invoice includes {Math.round(VAT_RATE * 100)}% VAT
              </label>
              {form.id && (
                form.invoiced_at ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>Invoiced {new Date(form.invoiced_at).toLocaleDateString()}</span>
                    <button type="button" onClick={() => markInvoiced(true)} style={{ background: 'transparent', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: 'var(--space-1) 9px', fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', cursor: 'pointer' }}>
                      Undo
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => markInvoiced(false)} style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '5px 11px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', cursor: 'pointer' }}>
                    Mark invoiced
                  </button>
                )
              )}
            </div>
          </div>
        </form>

        {/* Engagement log — only for a saved deal */}
        {form.id && (
          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--ws-border)', paddingTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Clock size={16} color="var(--ws-accent)" />
              <h3 style={subHead}>Engagement Log</h3>
              <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)' }}>
                {activities.length} {activities.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {can('opportunities', 'create') && (
              <form onSubmit={logActivity} style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 'var(--space-2)', alignItems: 'start' }}>
                  <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })} style={{ ...field, fontSize: 'var(--fs-300)', padding: '10px' }}>
                    {ACTIVITY_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <textarea placeholder="Log a call, meeting, email or note on this deal…" value={activityForm.body} onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })} style={{ ...field, minHeight: '44px', fontSize: 'var(--fs-300)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="primary" disabled={loggingActivity || !activityForm.body.trim()} style={{ minHeight: '38px', padding: '0 16px', opacity: loggingActivity || !activityForm.body.trim() ? 0.6 : 1 }}>
                    {loggingActivity ? 'Logging…' : 'Log activity'}
                  </button>
                </div>
              </form>
            )}

            {activitiesLoading ? (
              <p style={quiet}>Loading activity…</p>
            ) : activities.length === 0 ? (
              <p style={quiet}>Log the first call, meeting or note above.</p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {activities.map((a) => {
                  const s = ACTIVITY_STYLE(a.type);
                  return (
                    // grid-keep: the 9px dot is a bullet for the entry beside
                    // it. Stacked, it becomes a stray dot on its own row.
                    <div key={a.id} className="grid-keep" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2)' }}>
                      <span title={s.label} style={{ marginTop: '5px', width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 'var(--fs-100)', fontWeight: 'var(--fw-medium)', textTransform: 'uppercase', letterSpacing: '0.03em', color: s.color }}>{s.label}</span>
                          <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', fontWeight: 'var(--fw-medium)' }}>{a.actor_name || 'System'}</span>
                          <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>{new Date(a.occurred_at).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)', whiteSpace: 'pre-wrap' }}>{a.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Documents & payments — only for a saved deal */}
        {form.id && (
          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--ws-border)', paddingTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <FileText size={16} color="var(--ws-accent)" />
              <h3 style={subHead}>Documents &amp; Payments</h3>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              <button type="button" onClick={() => openDocument('quotation')} style={docBtn}>
                <FileText size={14} /> Quotation
              </button>
              <button type="button" onClick={() => openDocument('invoice')} style={docBtn}>
                <FileText size={14} /> Invoice
              </button>
            </div>

            {can('payments', 'create') && (
              <form onSubmit={recordPayment} className="grid-record grid-record--payment" style={{ display: 'grid', gridTemplateColumns: '120px 150px 1fr auto', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <NumberField min="0" placeholder="Amount" value={paymentForm.amount} onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} style={{ fontSize: 'var(--fs-300)', padding: '9px 10px' }} />
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })} style={{ ...field, fontSize: 'var(--fs-300)', padding: '9px 10px' }}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input placeholder="Reference (optional)" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} style={{ ...field, fontSize: 'var(--fs-300)', padding: '9px 10px' }} />
                <button type="submit" className="primary" disabled={recordingPayment || Number(paymentForm.amount) <= 0} style={{ minHeight: '38px', padding: '0 14px', opacity: recordingPayment || Number(paymentForm.amount) <= 0 ? 0.6 : 1 }}>
                  {recordingPayment ? 'Saving…' : 'Record'}
                </button>
              </form>
            )}

            {payments.length === 0 ? (
              <p style={quiet}>Record a payment to generate a receipt.</p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: 'var(--space-2) 10px' }}>
                    <div style={{ fontSize: 'var(--fs-300)', minWidth: 0 }}>
                      <strong style={{ color: 'var(--ws-fg)' }}>{zmw(p.amount)}</strong>
                      <span style={{ color: 'var(--ws-fg-muted)' }}> · {PAYMENT_METHOD_LABEL(p.method)} · {new Date(p.paid_at).toLocaleDateString()}</span>
                      {p.reference && <span style={{ color: 'var(--ws-fg-subtle)' }}> · {p.reference}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                      <button type="button" onClick={() => openDocument('receipt', p)} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: 'var(--space-1) 10px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', cursor: 'pointer' }}>Receipt</button>
                      {can('payments', 'delete') && (
                        <button type="button" onClick={() => deletePayment(p.id)} title="Remove" style={{ ...removeBtn, background: 'var(--ws-panel)', padding: 'var(--space-1)' }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                  Total received:&nbsp;<strong style={{ color: 'var(--ws-fg)' }}>{zmw(payments.reduce((s, p) => s + p.amount, 0))}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Document generator overlay (quotation / invoice / receipt). A plain
          overlay rather than a Radix dialog, so conditional mounting here does
          not cost a focus restore. */}
      {docState && (
        <DocumentView
          kind={docState.kind}
          opportunity={docState.opportunity}
          payments={payments}
          ownerName={staffName(docState.opportunity.owner_id)}
          applyVat={applyVat}
          onToggleVat={() => setApplyVat((v) => !v)}
          receiptPayment={docState.receiptPayment}
          onClose={() => setDocState(null)}
        />
      )}
    </>
  );
}
