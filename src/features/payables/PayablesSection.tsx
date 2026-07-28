import { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Edit2, Wallet, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, isApprovalBlocked, type ExpenseInput } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Expense, ExpenseCategory, VatTreatment, PayablesReport, CashPosition } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { SectionAction } from '../../components/SectionAction';

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

  async function load() {
    try {
      const [nextExpenses, nextReport, nextPosition] = await Promise.all([
        api.adminListExpenses(),
        api.adminPayables(),
        api.adminPosition(),
      ]);
      setExpenses(nextExpenses.items);
      setReport(nextReport);
      setPosition(nextPosition);
    } catch (err: any) {
      toast.error(err.message || 'Could not load the supplier ledger');
    }
  }

  useEffect(() => {
    if (active) load();
  }, [active]);

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
    } catch (err: any) {
      // A blocked action is not a failure — it is the approval gate doing its
      // job, and the server's message names who has to decide.
      if (isApprovalBlocked(err)) toast.warning(err.message);
      else toast.error(err.message || 'Could not save the supplier invoice');
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
    } catch (err: any) {
      toast.error(err.message || 'Could not delete the supplier invoice');
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
    } catch (err: any) {
      if (isApprovalBlocked(err)) toast.warning(err.message);
      else toast.error(err.message || 'Could not record the payment');
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
                <span style={{ display: 'block', fontSize: '26px', fontWeight: 900 }}>{ZMW(position.owed_to_us)}</span>
                <p style={{ margin: '4px 0 0' }}>Clients owe us</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: '26px', fontWeight: 900, color: '#a00' }}>{ZMW(position.owed_by_us)}</span>
                <p style={{ margin: '4px 0 0' }}>We owe suppliers</p>
              </article>
              <article className="panel">
                <span style={{ display: 'block', fontSize: '26px', fontWeight: 900, color: position.net >= 0 ? '#5f7c29' : '#a00' }}>
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
              <h3 style={{ margin: 0, fontSize: '16px' }}>Input VAT</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <ShieldCheck size={18} style={{ color: '#5f7c29', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{ZMW(position.recoverable_input_vat)}</strong>
                    <span style={{ fontSize: '12px', color: '#5a625d' }}>Claimable. Backed by a Smart Invoice.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: '#c98745', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{ZMW(position.irrecoverable_input_vat)}</strong>
                    <span style={{ fontSize: '12px', color: '#5a625d' }}>
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
              <button onClick={() => api.exportPayablesCSV()} style={{ background: '#eef0ea', color: '#111512', border: 0, borderRadius: '6px', minHeight: '36px', padding: '0 12px', fontSize: '12px' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            {report && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {BUCKET_LABELS.map((b) => (
                  <div key={b.key} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '8px', padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: '#5a625d', textTransform: 'uppercase', fontWeight: 700 }}>{b.label}</span>
                    <strong style={{ display: 'block', fontSize: '18px', marginTop: '4px' }}>{ZMW(report.buckets[b.key] ?? 0)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="table">
              {outstanding.length === 0 ? (
                <p className="empty">Nothing is outstanding. Record a supplier invoice when one arrives.</p>
              ) : (
                outstanding.map((e) => (
                  <article key={e.id} className="row" style={{ gridTemplateColumns: '1.4fr auto auto auto', gap: '14px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{e.supplier}</strong>
                      <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '3px' }}>
                        {CATEGORY_LABEL(e.category)}
                        {e.reference && ` · ${e.reference}`}
                        {e.due_date && ` · due ${new Date(e.due_date).toLocaleDateString()}`}
                      </div>
                      {e.vat_amount > 0 && (
                        <div style={{ fontSize: '11px', color: e.vat_recoverable ? '#5f7c29' : '#c98745', marginTop: '4px' }}>
                          {e.vat_recoverable
                            ? `VAT ${ZMW(e.vat_amount)} is claimable`
                            : `VAT ${ZMW(e.vat_amount)} cannot be claimed without a Smart Invoice reference`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>{ZMW(e.outstanding)}</strong>
                      {e.settled > 0 && (
                        <div style={{ fontSize: '11px', color: '#5a625d' }}>{ZMW(e.settled)} of {ZMW(e.gross)} paid</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {can('expenses', 'create') && (
                        <button onClick={() => openSettle(e)} className="primary" style={{ minHeight: '34px', fontSize: '12px', padding: '0 12px' }}>
                          <Wallet size={14} /> Pay
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {can('expenses', 'update') && (
                        <button onClick={() => openEdit(e)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px' }}><Edit2 size={14} /></button>
                      )}
                      {can('expenses', 'delete') && e.settled === 0 && (
                        <button onClick={() => remove(e)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </article>
                ))
              )}
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
                      <strong style={{ fontSize: '14px' }}>{CATEGORY_LABEL(cat)}</strong>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#111512', fontVariantNumeric: 'tabular-nums' }}>{ZMW(total)}</span>
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
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Supplier</label>
              <input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Supplier TPIN</label>
              <input value={form.supplier_tpin} onChange={(e) => setForm({ ...form, supplier_tpin: e.target.value })} placeholder="10 digits" style={{ color: '#111512', background: '#f7f8f3' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} style={{ color: '#111512', background: '#f7f8f3' }}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Their invoice number</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>VAT treatment</label>
            <select value={form.vat_treatment} onChange={(e) => setTreatment(e.target.value as VatTreatment)} style={{ color: '#111512', background: '#f7f8f3' }}>
              {VAT_TREATMENTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <p style={{ fontSize: '11px', color: '#8a908a', margin: '6px 0 0' }}>
              {VAT_TREATMENTS.find((v) => v.value === form.vat_treatment)?.hint}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Amount before VAT</label>
              <NumberField required value={form.net_amount} onChange={(net_amount) => setForm({ ...form, net_amount })} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>VAT charged</label>
              <NumberField
                value={form.vat_amount}
                onChange={(vat_amount) => setForm({ ...form, vat_amount })}
                disabled={form.vat_treatment !== 'standard'}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Smart Invoice reference</label>
            <input
              value={form.smart_invoice_ref}
              onChange={(e) => setForm({ ...form, smart_invoice_ref: e.target.value })}
              placeholder="ZRA Mark ID from their invoice"
              style={{ color: '#111512', background: '#f7f8f3' }}
            />
            <p style={{ fontSize: '11px', color: form.vat_treatment === 'standard' && !form.smart_invoice_ref ? '#c98745' : '#8a908a', margin: '6px 0 0', lineHeight: 1.5 }}>
              {form.vat_treatment === 'standard' && !form.smart_invoice_ref
                ? 'Without this, the VAT on this invoice is a cost. ZRA only accepts an input VAT claim backed by a Smart Invoice.'
                : 'The Mark ID ZRA prints on a Smart Invoice, next to the QR code.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Payment due</label>
              <input type="date" value={form.due_date ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            </div>
            <div style={{ alignSelf: 'end', paddingBottom: '14px', fontSize: '13px', color: '#5a625d' }}>
              Total payable <strong style={{ color: '#111512' }}>{ZMW(form.net_amount + form.vat_amount)}</strong>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '70px' }} />
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
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Amount</label>
              <NumberField required value={settlement.amount} onChange={(amount) => setSettlement({ ...settlement, amount })} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Method</label>
              <select value={settlement.method} onChange={(e) => setSettlement({ ...settlement, method: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                {SETTLE_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Reference</label>
            <input value={settlement.reference} onChange={(e) => setSettlement({ ...settlement, reference: e.target.value })} placeholder="Transfer or transaction reference" style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Note</label>
            <textarea value={settlement.note} onChange={(e) => setSettlement({ ...settlement, note: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '60px' }} />
          </div>
          <p style={{ fontSize: '11px', color: '#8a908a', margin: 0, lineHeight: 1.5 }}>
            This records that the payment was made. It does not move any money.
          </p>
        </form>
      </Modal>
    </>
  );
}
