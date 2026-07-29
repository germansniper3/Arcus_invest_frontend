import { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Edit2, Wallet, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, isApprovalBlocked, type ExpenseInput, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Expense, ExpenseCategory, VatTreatment, PayablesReport, CashPosition } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { SectionAction } from '../../components/SectionAction';
import { Loadable } from '../../components/Loadable';
import { useRefreshSignal } from '../../lib/refresh';

const ZMW = (n: number) => `${Math.round(n).toLocaleString()} ZMW`;

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'purchases', label: 'Stock for resale' },
  { value: 'salaries', label: 'Salaries and wages' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'transport', label: 'Transport and fuel' },
  { value: 'repairs', label: 'Repairs and maintenance' },
  { value: 'professional', label: 'Professional fees' },
  { value: 'bank_charges', label: 'Bank and mobile money charges' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'statutory', label: 'Licences and statutory' },
  { value: 'equipment', label: 'Tools and equipment' },
  { value: 'other', label: 'Other' },
];
const CATEGORY_LABEL = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const VAT_TREATMENTS: { value: VatTreatment; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard rated (16%)', hint: 'Reclaimable, but only against a Smart Invoice.' },
  { value: 'zero_rated', label: 'Zero rated', hint: 'Taxable at 0%. Nothing to reclaim.' },
  { value: 'exempt', label: 'Exempt', hint: 'Outside the VAT net.' },
  { value: 'none', label: 'Supplier not VAT registered', hint: 'No VAT was charged.' },
];

const SETTLE_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const BUCKET_LABELS: { key: string; label: string }[] = [
  { key: 'current', label: 'Not yet due' },
  { key: '30', label: '30 days' },
  { key: '60', label: '60 days' },
  { key: '90+', label: '90 days and over' },
];

const EMPTY_FORM: ExpenseInput = {
  supplier: '', supplier_tpin: '', category: 'purchases', reference: '',
  smart_invoice_ref: '', net_amount: 0, vat_amount: 0, vat_treatment: 'none',
  due_date: '', notes: '',
};

interface Props {
  active: boolean;
}

export function PayablesSection({ active }: Props) {
  const can = useCan();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [position, setPosition] = useState<CashPosition | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [form, setForm] = useState<ExpenseInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [settling, setSettling] = useState<Expense | null>(null);
  const [settlement, setSettlement] = useState({ amount: 0, method: 'bank_transfer', reference: '', note: '' });
  const [recording, setRecording] = useState(false);

  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [nextExpenses, nextReport, nextPosition] = await Promise.all([
        api.adminListExpenses(),
        api.adminPayables(),
        api.adminPosition(),
      ]);
      setExpenses(nextExpenses.items);
      setReport(nextReport);
      setPosition(nextPosition);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the supplier ledger'));
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

  function openCreate() {
    setEditingId('');
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      supplier: e.supplier, supplier_tpin: e.supplier_tpin, category: e.category,
      reference: e.reference, smart_invoice_ref: e.smart_invoice_ref,
      net_amount: e.net_amount, vat_amount: e.vat_amount, vat_treatment: e.vat_treatment,
      due_date: e.due_date ? e.due_date.substring(0, 10) : '',
      notes: e.notes,
    });
    setShowForm(true);
  }

  // The server rejects VAT on anything but a standard-rated supply, so the form
  // clears the figure when the treatment changes rather than letting someone
  // type an amount that will be refused on save.
  function setTreatment(vat_treatment: VatTreatment) {
    setForm((prev) => ({
      ...prev,
      vat_treatment,
      vat_amount: vat_treatment === 'standard' ? prev.vat_amount : 0,
    }));
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const body: ExpenseInput = { ...form, due_date: form.due_date || null };
      if (editingId) {
        await api.adminUpdateExpense(editingId, body);
        toast.success('Supplier invoice updated');
      } else {
        await api.adminCreateExpense(body);
        toast.success('Supplier invoice recorded');
      }
      setShowForm(false);
      load();
    } catch (err) {
      // A blocked action is not a failure — it is the approval gate doing its
      // job, and the server's message names who has to decide.
      if (isApprovalBlocked(err)) toast.warning(err.message);
      else toast.error(errorMessage(err, 'Could not save the supplier invoice'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Expense) {
    if (!confirm(`Delete the invoice from ${e.supplier}? This cannot be undone.`)) return;
    try {
      await api.adminDeleteExpense(e.id);
      toast.success('Supplier invoice deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the supplier invoice'));
    }
  }

  function openSettle(e: Expense) {
    setSettling(e);
    setSettlement({ amount: e.outstanding, method: 'bank_transfer', reference: '', note: '' });
  }

  async function recordSettlement(ev: React.FormEvent) {
    ev.preventDefault();
    if (!settling) return;
    setRecording(true);
    try {
      await api.adminSettleExpense(settling.id, settlement);
      toast.success('Payment recorded');
      setSettling(null);
      load();
    } catch (err) {
      if (isApprovalBlocked(err)) toast.warning(err.message);
      else toast.error(errorMessage(err, 'Could not record the payment'));
    } finally {
      setRecording(false);
    }
  }

  const outstanding = expenses.filter((e) => e.outstanding > 0);

  return (
    <>
      {active && can('expenses', 'create') && (
        <SectionAction>
          <button onClick={openCreate} className="primary" style={{ minHeight: '40px' }}>
            <Plus size={16} /> Record supplier invoice
          </button>
        </SectionAction>
      )}

      {active && (
        <div style={{ display: 'grid', gap: '26px' }}>
          {/* The cash position. This is the figure the system could not produce
              at all while it only tracked money in. */}
          {position && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 900 }}>{ZMW(position.owed_to_us)}</span>
                <p style={{ margin: '4px 0 0' }}>Clients owe us</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 900, color: 'var(--tone-danger-fg)' }}>{ZMW(position.owed_by_us)}</span>
                <p style={{ margin: '4px 0 0' }}>We owe suppliers</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: 'var(--fs-600)', fontWeight: 900, color: position.net >= 0 ? 'var(--ws-accent)' : 'var(--tone-danger-fg)' }}>
                  {ZMW(position.net)}
                </span>
                <p style={{ margin: '4px 0 0' }}>Net position</p>
              </article>
            </div>
          )}

          {/* Two VAT figures, not one. The second is money paid to ZRA that
              cannot be claimed back, and it is invisible anywhere that assumes
              all input VAT returns. */}
          {position && (position.recoverable_input_vat > 0 || position.irrecoverable_input_vat > 0) && (
            <article className="panel" style={{ display: 'grid', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-400)' }}>Input VAT</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--ws-accent)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: 'var(--fs-500)', display: 'block' }}>{ZMW(position.recoverable_input_vat)}</strong>
                    <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Claimable. Backed by a Smart Invoice.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: 'var(--copper)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: 'var(--fs-500)', display: 'block' }}>{ZMW(position.irrecoverable_input_vat)}</strong>
                    <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                      A cost, not a claim. No Smart Invoice reference was recorded.
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Aged payables */}
          <section className="data-section" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>What we owe</h2>
              <button onClick={() => api.exportPayablesCSV()} style={{ background: 'var(--ws-canvas)', color: 'var(--ws-fg)', border: 0, borderRadius: '6px', minHeight: '36px', padding: '0 12px', fontSize: 'var(--fs-200)' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            {report && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {BUCKET_LABELS.map((b) => (
                  <div key={b.key} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{b.label}</span>
                    <strong style={{ display: 'block', fontSize: 'var(--fs-500)', marginTop: '4px' }}>{ZMW(report.buckets[b.key] ?? 0)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="table">
              <Loadable
                loading={loading}
                empty={outstanding.length === 0}
                emptyIcon={<CheckCircle2 size={26} strokeWidth={1.5} style={{ color: 'var(--ws-accent)' }} />}
                emptyMessage="Nothing is outstanding. Record a supplier invoice when one arrives."
              >
                {outstanding.map((e) => (
                  <article key={e.id} className="row" style={{ gridTemplateColumns: '1.4fr auto auto auto', gap: '14px' }}>
                    <div>
                      <strong style={{ fontSize: 'var(--fs-400)' }}>{e.supplier}</strong>
                      <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', marginTop: '3px' }}>
                        {CATEGORY_LABEL(e.category)}
                        {e.reference && ` · ${e.reference}`}
                        {e.due_date && ` · due ${new Date(e.due_date).toLocaleDateString()}`}
                      </div>
                      {e.vat_amount > 0 && (
                        <div style={{ fontSize: 'var(--fs-100)', color: e.vat_recoverable ? 'var(--ws-accent)' : 'var(--copper)', marginTop: '4px' }}>
                          {e.vat_recoverable
                            ? `VAT ${ZMW(e.vat_amount)} is claimable`
                            : `VAT ${ZMW(e.vat_amount)} cannot be claimed without a Smart Invoice reference`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 'var(--fs-400)', fontVariantNumeric: 'tabular-nums' }}>{ZMW(e.outstanding)}</strong>
                      {e.settled > 0 && (
                        <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)' }}>{ZMW(e.settled)} of {ZMW(e.gross)} paid</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {can('expenses', 'create') && (
                        <button onClick={() => openSettle(e)} className="primary" style={{ minHeight: '34px', fontSize: 'var(--fs-200)', padding: '0 12px' }}>
                          <Wallet size={14} /> Pay
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {can('expenses', 'update') && (
                        <button onClick={() => openEdit(e)} style={{ background: 'var(--ws-canvas)', border: 0, padding: 6, borderRadius: '4px' }}><Edit2 size={14} /></button>
                      )}
                      {can('expenses', 'delete') && e.settled === 0 && (
                        <button onClick={() => remove(e)} style={{ background: 'var(--tone-danger-bg)', color: 'var(--tone-danger-fg)', border: 0, padding: 6, borderRadius: '4px' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </article>
                ))}
              </Loadable>
            </div>
          </section>

          {/* Spend by category — expenditure by nature, which is the shape the
              micro-entity reporting standard expects. */}
          {position && Object.keys(position.spend_by_category).length > 0 && (
            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Where the money went</h2>
              <div className="table">
                {Object.entries(position.spend_by_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => (
                    <article key={cat} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                      <strong style={{ fontSize: 'var(--fs-300)' }}>{CATEGORY_LABEL(cat)}</strong>
                      <span style={{ fontSize: 'var(--fs-400)', fontWeight: 700, color: 'var(--ws-fg)', fontVariantNumeric: 'tabular-nums' }}>{ZMW(total)}</span>
                    </article>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit supplier invoice' : 'Record supplier invoice'}
        description="Recording only. No money moves from this screen."
        width="min(640px, 100%)"
        footer={<button type="submit" form="expense-form" disabled={saving} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Record invoice'}</button>}
      >
        <form id="expense-form" onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Supplier</label>
              <input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Supplier TPIN</label>
              <input value={form.supplier_tpin} onChange={(e) => setForm({ ...form, supplier_tpin: e.target.value })} placeholder="10 digits" style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Their invoice number</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>VAT treatment</label>
            <select value={form.vat_treatment} onChange={(e) => setTreatment(e.target.value as VatTreatment)} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}>
              {VAT_TREATMENTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: '6px 0 0' }}>
              {VAT_TREATMENTS.find((v) => v.value === form.vat_treatment)?.hint}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Amount before VAT</label>
              <NumberField required value={form.net_amount} onChange={(net_amount) => setForm({ ...form, net_amount })} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>VAT charged</label>
              <NumberField
                value={form.vat_amount}
                onChange={(vat_amount) => setForm({ ...form, vat_amount })}
                disabled={form.vat_treatment !== 'standard'}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Smart Invoice reference</label>
            <input
              value={form.smart_invoice_ref}
              onChange={(e) => setForm({ ...form, smart_invoice_ref: e.target.value })}
              placeholder="ZRA Mark ID from their invoice"
              style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}
            />
            <p style={{ fontSize: 'var(--fs-100)', color: form.vat_treatment === 'standard' && !form.smart_invoice_ref ? 'var(--copper)' : 'var(--ws-fg-subtle)', margin: '6px 0 0', lineHeight: 1.5 }}>
              {form.vat_treatment === 'standard' && !form.smart_invoice_ref
                ? 'Without this, the VAT on this invoice is a cost. ZRA only accepts an input VAT claim backed by a Smart Invoice.'
                : 'The Mark ID ZRA prints on a Smart Invoice, next to the QR code.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Payment due</label>
              <input type="date" value={form.due_date ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }} />
            </div>
            <div style={{ alignSelf: 'end', paddingBottom: '14px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}>
              Total payable <strong style={{ color: 'var(--ws-fg)' }}>{ZMW(form.net_amount + form.vat_amount)}</strong>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', minHeight: '70px' }} />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!settling}
        onClose={() => setSettling(null)}
        title={settling ? `Pay ${settling.supplier}` : 'Record payment'}
        description={settling ? `${ZMW(settling.outstanding)} outstanding on this invoice.` : undefined}
        footer={<button type="submit" form="settle-form" disabled={recording} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{recording ? 'Recording…' : 'Record payment'}</button>}
      >
        <form id="settle-form" onSubmit={recordSettlement} style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Amount</label>
              <NumberField required value={settlement.amount} onChange={(amount) => setSettlement({ ...settlement, amount })} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Method</label>
              <select value={settlement.method} onChange={(e) => setSettlement({ ...settlement, method: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}>
                {SETTLE_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Reference</label>
            <input value={settlement.reference} onChange={(e) => setSettlement({ ...settlement, reference: e.target.value })} placeholder="Transfer or transaction reference" style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Note</label>
            <textarea value={settlement.note} onChange={(e) => setSettlement({ ...settlement, note: e.target.value })} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', minHeight: '60px' }} />
          </div>
          <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: 0, lineHeight: 1.5 }}>
            This records that the payment was made. It does not move any money.
          </p>
        </form>
      </Modal>
    </>
  );
}
