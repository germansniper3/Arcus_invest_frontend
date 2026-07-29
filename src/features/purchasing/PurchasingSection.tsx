import { useEffect, useState } from 'react';
import { Plus, X, Send, PackageCheck, Ban, Truck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api, isApprovalBlocked, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import { zmw } from '../../lib/money';
import type {
  PurchaseOrder, PurchaseOrderInput, PurchaseOrderLineInput,
  PurchaseOrderStatus, GoodsReceipt, GoodsReceiptInput,
  LandedCostKind, ApportionmentBasis, Product,
} from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { SectionAction } from '../../components/SectionAction';
import { SectionMetrics } from '../../components/SectionMetrics';
import { Badge, type Tone } from '../../components/Badge';
import { Loadable } from '../../components/Loadable';
import DocumentView from '../../components/DocumentView';
import { useRefreshSignal } from '../../lib/refresh';

/**
 * Status tones. Read off the Badge vocabulary rather than a local {bg,fg} map —
 * there are zero literal colour maps left in the workspace and this does not
 * reintroduce the first one.
 */
const STATUS_TONE: Record<PurchaseOrderStatus, Tone> = {
  draft: 'neutral',
  pending_approval: 'notice',
  approved: 'active',
  rejected: 'danger',
  issued: 'info',
  partly_received: 'notice',
  received: 'positive',
  closed: 'neutral',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  issued: 'Issued',
  partly_received: 'Part delivered',
  received: 'Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const COST_KINDS: { value: LandedCostKind; label: string }[] = [
  { value: 'freight', label: 'Freight' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'duty', label: 'Customs duty' },
  { value: 'clearing', label: 'Clearing agent' },
  { value: 'handling', label: 'Port and handling' },
  { value: 'other', label: 'Other' },
];

const BASES: { value: ApportionmentBasis; label: string; hint: string }[] = [
  { value: 'value', label: 'By line value', hint: 'The conventional default. Loads cost onto the expensive lines.' },
  { value: 'quantity', label: 'By unit count', hint: 'Every unit carries the same share.' },
  { value: 'weight', label: 'By weight', hint: 'Honest for freight on a mixed consignment. Needs a weight per line.' },
];

/** Currencies Arcus actually buys in. Free text would invite typos into cost. */
const CURRENCIES = ['ZMW', 'USD', 'ZAR', 'CNY', 'EUR', 'GBP'];

const EMPTY_LINE: PurchaseOrderLineInput = { description: '', quantity: 1, unit_price: 0, product_id: null };

const EMPTY_FORM: PurchaseOrderInput = {
  supplier: '', supplier_tpin: '', currency: 'ZMW', exchange_rate: 1,
  expected_delivery: '', incoterms: '', shipping_term: '', notes: '',
  lines: [{ ...EMPTY_LINE }],
};

const cell: React.CSSProperties = {
  fontSize: 'var(--fs-300)',
  padding: 'var(--space-2) 10px',
  width: '100%',
};

const removeBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 'var(--space-2)',
  lineHeight: 0,
};

interface Props {
  active: boolean;
}

export function PurchasingSection({ active }: Props) {
  const can = useCan();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<PurchaseOrderInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [receipt, setReceipt] = useState<GoodsReceiptInput | null>(null);
  const [posting, setPosting] = useState(false);

  const [history, setHistory] = useState<PurchaseOrder | null>(null);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);

  // The printable order — the fourth DocumentKind, not a component of its own.
  const [printing, setPrinting] = useState<PurchaseOrder | null>(null);

  async function load() {
    setLoading(true);
    try {
      // adminListProducts answers with a bare array, not an { items } envelope —
      // checked against the Go handler rather than assumed.
      const [nextOrders, nextProducts] = await Promise.all([
        api.adminListPurchaseOrders(),
        can('products') ? api.adminListProducts() : Promise.resolve([] as Product[]),
      ]);
      setOrders(nextOrders.items);
      setProducts(nextProducts);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the order book'));
    } finally {
      setLoading(false);
    }
  }

  const refresh = useRefreshSignal();

  useEffect(() => {
    if (active) load();
    // `refresh` is the rail's Refresh Data signal — see lib/refresh. The
    // `active` guard means a bump refetches only the visible section.
    //
    // `load` is deliberately absent from the dependency list: it is redefined
    // on every render, so including it would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refresh]);

  const open = orders.filter((o) => o.status === 'issued' || o.status === 'partly_received');
  const awaiting = orders.filter((o) => o.status === 'pending_approval');
  const committed = open.reduce((sum, o) => sum + o.subtotal_zmw, 0);

  function openCreate() {
    setEditingId('');
    setForm({ ...EMPTY_FORM, lines: [{ ...EMPTY_LINE }] });
    setShowForm(true);
  }

  function openEdit(po: PurchaseOrder) {
    setEditingId(po.id);
    setForm({
      supplier: po.supplier,
      supplier_tpin: po.supplier_tpin,
      currency: po.currency,
      exchange_rate: po.exchange_rate,
      expected_delivery: po.expected_delivery ? po.expected_delivery.substring(0, 10) : '',
      incoterms: po.incoterms,
      shipping_term: po.shipping_term,
      opportunity_id: po.opportunity_id,
      notes: po.notes,
      lines: po.lines.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
    });
    setShowForm(true);
  }

  function updateLine(i: number, patch: Partial<PurchaseOrderLineInput>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }));
  }

  function removeLine(i: number) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length === 1 ? prev.lines : prev.lines.filter((_, idx) => idx !== i),
    }));
  }

  // A ZMW order has no rate to enter; forcing 1 keeps the kwacha value honest
  // without asking anyone to type it.
  function setCurrency(currency: string) {
    setForm((prev) => ({
      ...prev,
      currency,
      exchange_rate: currency === 'ZMW' ? 1 : prev.exchange_rate,
    }));
  }

  const formSubtotal = form.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const body: PurchaseOrderInput = { ...form, expected_delivery: form.expected_delivery || null };
      if (editingId) {
        await api.adminUpdatePurchaseOrder(editingId, body);
        toast.success('Purchase order updated');
      } else {
        await api.adminCreatePurchaseOrder(body);
        toast.success('Purchase order drafted');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the purchase order'));
    } finally {
      setSaving(false);
    }
  }

  async function issue(po: PurchaseOrder) {
    try {
      await api.adminIssuePurchaseOrder(po.id);
      toast.success(`Purchase order issued to ${po.supplier}`);
      load();
    } catch (err) {
      // A blocked action is the approval gate working, not a failure — the
      // server's message names who has to decide.
      if (isApprovalBlocked(err)) toast.warning(err.message);
      else toast.error(errorMessage(err, 'Could not issue the purchase order'));
      load();
    }
  }

  async function cancel(po: PurchaseOrder) {
    if (!confirm(`Cancel the order to ${po.supplier}? This cannot be undone.`)) return;
    try {
      await api.adminCancelPurchaseOrder(po.id);
      toast.success('Purchase order cancelled');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not cancel the purchase order'));
    }
  }

  function openReceive(po: PurchaseOrder) {
    setReceiving(po);
    setReceipt({
      reference: '',
      customs_assessment_ref: '',
      exchange_rate: po.exchange_rate,
      basis: 'value',
      notes: '',
      // Pre-filled with everything still outstanding, which is the common case;
      // a part delivery is edited down rather than typed from nothing.
      lines: po.lines
        .filter((l) => l.outstanding_quantity > 0)
        .map((l) => ({ purchase_order_line_id: l.id, quantity: l.outstanding_quantity, weight: 0 })),
      components: [],
    });
  }

  function updateReceiptLine(id: string, patch: { quantity?: number; weight?: number }) {
    setReceipt((prev) =>
      prev
        ? { ...prev, lines: prev.lines.map((l) => (l.purchase_order_line_id === id ? { ...l, ...patch } : l)) }
        : prev,
    );
  }

  function addComponent() {
    setReceipt((prev) =>
      prev
        ? {
            ...prev,
            components: [
              ...prev.components,
              { kind: 'freight', description: '', currency: 'ZMW', amount: 0, exchange_rate: 1, reference: '' },
            ],
          }
        : prev,
    );
  }

  function updateComponent(i: number, patch: Partial<GoodsReceiptInput['components'][number]>) {
    setReceipt((prev) =>
      prev
        ? { ...prev, components: prev.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }
        : prev,
    );
  }

  function removeComponent(i: number) {
    setReceipt((prev) =>
      prev ? { ...prev, components: prev.components.filter((_, idx) => idx !== i) } : prev,
    );
  }

  async function postReceipt(ev: React.FormEvent) {
    ev.preventDefault();
    if (!receiving || !receipt) return;
    setPosting(true);
    try {
      await api.adminReceiveGoods(receiving.id, {
        ...receipt,
        lines: receipt.lines.filter((l) => l.quantity > 0),
      });
      toast.success('Goods received and costed into stock');
      setReceiving(null);
      setReceipt(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the goods receipt'));
    } finally {
      setPosting(false);
    }
  }

  async function openHistory(po: PurchaseOrder) {
    setHistory(po);
    setReceipts([]);
    try {
      const res = await api.adminListGoodsReceipts(po.id);
      setReceipts(res.items);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the delivery history'));
    }
  }

  // The landed total the receipt being edited will produce, so the person
  // keying it sees what it does to unit cost before they commit it.
  const receiptGoodsZMW =
    receiving && receipt
      ? receipt.lines.reduce((sum, rl) => {
          const line = receiving.lines.find((l) => l.id === rl.purchase_order_line_id);
          return sum + (line ? rl.quantity * line.unit_price * receipt.exchange_rate : 0);
        }, 0)
      : 0;
  const receiptComponentsZMW = receipt
    ? receipt.components.reduce((sum, c) => sum + c.amount * c.exchange_rate, 0)
    : 0;

  if (!active) return null;

  return (
    <div>
      {can('purchase_orders', 'create') && (
        <SectionAction>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={15} /> New Purchase Order
          </button>
        </SectionAction>
      )}

      <SectionMetrics>
        <div className="metric-row">
          <article><span>{open.length}</span><p>Orders Outstanding</p></article>
          <article><span>{zmw(committed)}</span><p>Committed, Not Yet Owed</p></article>
          <article><span>{awaiting.length}</span><p>Awaiting Approval</p></article>
        </div>
      </SectionMetrics>

      <Loadable
        loading={loading}
        empty={orders.length === 0}
        emptyMessage="No purchase orders yet. Raise one to start the buy side."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Supplier</th>
                <th>Value</th>
                <th>Delivery</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => {
                const delivered = po.lines.reduce((s, l) => s + l.received_quantity, 0);
                const ordered = po.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <tr key={po.id}>
                    <td>
                      <strong>{po.number || 'Draft'}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>
                        {new Date(po.order_date).toLocaleDateString()}
                        {po.incoterms ? ` · ${po.incoterms}` : ''}
                      </div>
                    </td>
                    <td>{po.supplier}</td>
                    <td>
                      {po.currency !== 'ZMW' && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>
                          {po.currency} {po.subtotal.toLocaleString()} @ {po.exchange_rate}
                        </div>
                      )}
                      {zmw(po.subtotal_zmw)}
                    </td>
                    <td>{delivered} / {ordered}</td>
                    <td><Badge tone={STATUS_TONE[po.status]}>{STATUS_LABEL[po.status]}</Badge></td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => openHistory(po)} title="Deliveries and landed cost">
                          <Truck size={14} />
                        </button>
                        <button className="btn-ghost" onClick={() => setPrinting(po)} title="Print the order">
                          <FileText size={14} />
                        </button>
                        {(po.status === 'draft' || po.status === 'rejected') && can('purchase_orders', 'update') && (
                          <button className="btn-ghost" onClick={() => openEdit(po)}>Edit</button>
                        )}
                        {(po.status === 'draft' || po.status === 'pending_approval' || po.status === 'approved')
                          && can('purchase_orders', 'update') && (
                          <button className="btn-ghost" onClick={() => issue(po)} title="Send to the supplier">
                            <Send size={14} /> Issue
                          </button>
                        )}
                        {(po.status === 'issued' || po.status === 'partly_received') && can('purchase_orders', 'update') && (
                          <button className="btn-ghost" onClick={() => openReceive(po)} title="Record a delivery">
                            <PackageCheck size={14} /> Receive
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'rejected' || po.status === 'issued')
                          && can('purchase_orders', 'delete') && (
                          <button className="btn-ghost" onClick={() => cancel(po)} title="Cancel">
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Loadable>

      {/* --- Order form ---------------------------------------------------- */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit purchase order' : 'New purchase order'}
      >
        <form onSubmit={save} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <label>
              Supplier
              <input
                required
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </label>
            <label>
              Supplier TPIN
              <input
                value={form.supplier_tpin}
                onChange={(e) => setForm({ ...form, supplier_tpin: e.target.value })}
                placeholder="Blank for a foreign supplier"
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <label>
              Currency
              <select value={form.currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Rate (kwacha per {form.currency})
              <NumberField
                min="0"
                step="0.0001"
                value={form.exchange_rate}
                onChange={(exchange_rate) => setForm({ ...form, exchange_rate })}
                disabled={form.currency === 'ZMW'}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <label>
              Expected delivery
              <input
                type="date"
                value={form.expected_delivery ?? ''}
                onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
              />
            </label>
            <label>
              Incoterms
              <input
                value={form.incoterms}
                onChange={(e) => setForm({ ...form, incoterms: e.target.value })}
                placeholder="EXW, FOB, CIF, DDP"
              />
            </label>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <strong>Lines</strong>
              <button type="button" className="btn-ghost" onClick={addLine}>
                <Plus size={14} /> Add line
              </button>
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {form.lines.map((l, i) => (
                <div
                  key={i}
                  className="grid-record grid-record--item"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 66px 108px auto', gap: 'var(--space-1)', alignItems: 'center' }}
                >
                  <input
                    placeholder="Description"
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    style={cell}
                  />
                  <NumberField
                    min="1"
                    step="1"
                    title="Quantity"
                    value={l.quantity}
                    onChange={(quantity) => updateLine(i, { quantity })}
                    style={cell}
                  />
                  <NumberField
                    min="0"
                    title={`Unit price (${form.currency})`}
                    value={l.unit_price}
                    onChange={(unit_price) => updateLine(i, { unit_price })}
                    style={cell}
                  />
                  <button type="button" onClick={() => removeLine(i)} title="Remove" style={removeBtn}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            {/* Products can be attached to a line so the receipt reaches the
                stock ledger. A line with no product still costs money and still
                takes its share of freight — it simply never moves stock. */}
            {products.length > 0 && (
              <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {form.lines.map((l, i) => (
                  <label key={i} style={{ fontSize: 'var(--fs-200)' }}>
                    Line {i + 1} stock item
                    <select
                      value={l.product_id ?? ''}
                      onChange={(e) => updateLine(i, { product_id: e.target.value || null })}
                    >
                      <option value="">Not a stock item</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label>
            Notes
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>Order total</div>
              <strong>{form.currency} {formSubtotal.toLocaleString()}</strong>
              {form.currency !== 'ZMW' && (
                <span style={{ color: 'var(--text-muted)' }}> · {zmw(formSubtotal * form.exchange_rate)}</span>
              )}
            </div>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create draft'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Goods receipt -------------------------------------------------- */}
      <Modal
        open={!!receiving}
        onClose={() => { setReceiving(null); setReceipt(null); }}
        title={receiving ? `Receive goods · ${receiving.number || receiving.supplier}` : 'Receive goods'}
      >
        {receiving && receipt && (
          <form onSubmit={postReceipt} style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)', margin: 0 }}>
              This records the delivery and costs it into stock. It does not create a
              payable — the supplier invoice is booked separately in Payables.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <label>
                Delivery note
                <input value={receipt.reference} onChange={(e) => setReceipt({ ...receipt, reference: e.target.value })} />
              </label>
              <label>
                Customs assessment
                <input
                  value={receipt.customs_assessment_ref}
                  onChange={(e) => setReceipt({ ...receipt, customs_assessment_ref: e.target.value })}
                  placeholder="Import VAT evidence"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <label>
                Rate at clearing (kwacha per {receiving.currency})
                <NumberField
                  min="0"
                  step="0.0001"
                  value={receipt.exchange_rate}
                  onChange={(exchange_rate) => setReceipt({ ...receipt, exchange_rate })}
                  disabled={receiving.currency === 'ZMW'}
                />
              </label>
              <label>
                Spread cost
                <select
                  value={receipt.basis}
                  onChange={(e) => setReceipt({ ...receipt, basis: e.target.value as ApportionmentBasis })}
                >
                  {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <small style={{ color: 'var(--text-muted)' }}>
                  {BASES.find((b) => b.value === receipt.basis)?.hint}
                </small>
              </label>
            </div>

            <div>
              <strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Quantities received</strong>
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {receiving.lines.filter((l) => l.outstanding_quantity > 0).map((l) => {
                  const rl = receipt.lines.find((x) => x.purchase_order_line_id === l.id);
                  return (
                    <div
                      key={l.id}
                      className="grid-record grid-record--item"
                      style={{ display: 'grid', gridTemplateColumns: '1fr 66px 108px', gap: 'var(--space-1)', alignItems: 'center' }}
                    >
                      <div style={{ fontSize: 'var(--fs-300)' }}>
                        {l.description}
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>
                          {l.outstanding_quantity} outstanding of {l.quantity}
                        </div>
                      </div>
                      <NumberField
                        min="0"
                        step="1"
                        title="Quantity received now"
                        value={rl?.quantity ?? 0}
                        onChange={(quantity) => updateReceiptLine(l.id, { quantity })}
                        style={cell}
                      />
                      <NumberField
                        min="0"
                        title="Weight (kg), only used when spreading by weight"
                        value={rl?.weight ?? 0}
                        onChange={(weight) => updateReceiptLine(l.id, { weight })}
                        style={cell}
                        disabled={receipt.basis !== 'weight'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <strong>Landed cost</strong>
                <button type="button" className="btn-ghost" onClick={addComponent}>
                  <Plus size={14} /> Add charge
                </button>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {receipt.components.map((comp, i) => (
                  <div
                    key={i}
                    className="grid-record grid-record--item"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 108px 80px auto', gap: 'var(--space-1)', alignItems: 'center' }}
                  >
                    <select
                      value={comp.kind}
                      onChange={(e) => updateComponent(i, { kind: e.target.value as LandedCostKind })}
                      style={cell}
                    >
                      {COST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                    <NumberField
                      min="0"
                      title="Amount"
                      value={comp.amount}
                      onChange={(amount) => updateComponent(i, { amount })}
                      style={cell}
                    />
                    <select
                      value={comp.currency}
                      onChange={(e) => updateComponent(i, {
                        currency: e.target.value,
                        exchange_rate: e.target.value === 'ZMW' ? 1 : comp.exchange_rate,
                      })}
                      style={cell}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => removeComponent(i)} title="Remove" style={removeBtn}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {receipt.components.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)', margin: 0 }}>
                  No freight, duty or clearing on this delivery. Charges that arrive later
                  can be added against it and the unit cost recalculates.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>Goods + landed cost</div>
                <strong>{zmw(receiptGoodsZMW + receiptComponentsZMW)}</strong>
                {receiptComponentsZMW > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}· {zmw(receiptComponentsZMW)} of it landed cost
                  </span>
                )}
              </div>
              <button className="btn-primary" disabled={posting}>
                {posting ? 'Recording…' : 'Receive into stock'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- Delivery history ---------------------------------------------- */}
      <Modal
        open={!!history}
        onClose={() => setHistory(null)}
        title={history ? `Deliveries · ${history.number || history.supplier}` : 'Deliveries'}
      >
        {receipts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nothing has been delivered against this order yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {receipts.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{new Date(r.received_at).toLocaleDateString()}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>
                    spread {r.basis} · {r.received_by}
                  </span>
                </div>
                {r.reference && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-200)' }}>
                    Note {r.reference}
                    {r.customs_assessment_ref ? ` · customs ${r.customs_assessment_ref}` : ''}
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-1)' }}>
                  {r.lines.map((l) => (
                    <div key={l.id} className="grid-keep" style={{ display: 'grid', gridTemplateColumns: '1fr auto', fontSize: 'var(--fs-200)' }}>
                      <span>{l.quantity} received</span>
                      <span>{zmw(l.unit_cost_zmw)} a unit landed</span>
                    </div>
                  ))}
                </div>
                {r.components.length > 0 && (
                  <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border)', display: 'grid', gap: 'var(--space-1)' }}>
                    {r.components.map((comp) => (
                      <div key={comp.id} className="grid-keep" style={{ display: 'grid', gridTemplateColumns: '1fr auto', fontSize: 'var(--fs-200)' }}>
                        <span>{COST_KINDS.find((k) => k.value === comp.kind)?.label ?? comp.kind}</span>
                        <span>{zmw(comp.amount * comp.exchange_rate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* The order as a printed document. applyVat is false and has no toggle:
          what a supplier charges is on their invoice, and on an import the VAT
          is assessed at the border — neither is ours to state here. */}
      {printing && (
        <DocumentView
          kind="purchase_order"
          purchaseOrder={printing}
          applyVat={false}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}
