import { useEffect, useState } from 'react';
import { PackagePlus, History } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import type { Product, StockMovement, StockMovementKind } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';

/**
 * The kinds a person can post by hand.
 *
 * Sales come from the counter and opening balances are written once when the
 * ledger starts, so neither belongs on this form — the server refuses both.
 */
const POSTABLE: { value: StockMovementKind; label: string; direction: 1 | -1; needsReason: boolean }[] = [
  { value: 'receipt', label: 'Goods received', direction: 1, needsReason: false },
  { value: 'return', label: 'Customer return', direction: 1, needsReason: false },
  { value: 'adjustment', label: 'Stock count correction', direction: 1, needsReason: true },
  { value: 'write_off', label: 'Damaged or missing', direction: -1, needsReason: true },
];

const KIND_LABELS: Record<StockMovementKind, string> = {
  opening: 'Opening balance',
  receipt: 'Goods received',
  sale: 'Sold',
  return: 'Returned',
  adjustment: 'Count correction',
  write_off: 'Written off',
};

interface Props {
  product: Product;
  canWrite: boolean;
  /** Refreshes the catalogue so the quantity in the list agrees with the ledger. */
  onChanged: () => void;
}

export function StockLedger({ product, canWrite, onChanged }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [onHand, setOnHand] = useState(product.stock);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<StockMovementKind>('receipt');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.adminStockMovements(product.id);
      setMovements(res.items);
      setOnHand(res.on_hand);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the stock history'));
    }
  }

  useEffect(() => {
    load();
  }, [product.id]);

  const selected = POSTABLE.find((k) => k.value === kind)!;
  // A correction can go either way; everything else has one direction, and the
  // server refuses a sign that contradicts the kind.
  const signed = kind === 'adjustment' ? quantity : Math.abs(quantity) * selected.direction;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.adminCreateStockMovement(product.id, {
        kind, quantity: signed, reason, unit_cost: unitCost,
      });
      setOnHand(res.on_hand);
      toast.success(`${product.name}: ${res.on_hand} on the shelf`);
      setShowForm(false);
      setQuantity(0);
      setReason('');
      setUnitCost(0);
      load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the movement'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <article className="panel" style={{ marginTop: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-400)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <History size={15} /> Stock history
          </h3>
          {canWrite && (
            <button onClick={() => { setKind('receipt'); setShowForm(true); }} style={{ background: 'var(--ws-canvas)', color: 'var(--ws-fg)', border: 0, borderRadius: '6px', minHeight: '34px', padding: '0 12px', fontSize: 'var(--fs-200)', fontWeight: 700 }}>
              <PackagePlus size={14} /> Record movement
            </button>
          )}
        </div>

        <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', margin: '0 0 12px' }}>
          {onHand} on the shelf, from {movements.length} recorded movement{movements.length === 1 ? '' : 's'}.
        </p>

        {movements.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', margin: 0 }}>
            Record the first delivery to start the history.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
            {movements.map((m) => (
              // grid-keep: a ledger line is quantity / what / when, read across
              // as one sentence. Stacked on a phone each movement becomes a
              // three-row block and the history stops being scannable.
              <div key={m.id} className="grid-keep" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: '8px 12px' }}>
                <span style={{
                  fontSize: 'var(--fs-400)', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: m.quantity > 0 ? 'var(--tone-positive-fg)' : 'var(--tone-danger-fg)', minWidth: '42px',
                }}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 'var(--fs-200)' }}>{KIND_LABELS[m.kind]}</strong>
                  {m.reason && <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', marginTop: '2px' }}>{m.reason}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', whiteSpace: 'nowrap' }}>
                  <div>{new Date(m.occurred_at).toLocaleDateString()}</div>
                  <div>{m.actor_name || 'System'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Stock movement: ${product.name}`}
        description={`${onHand} on the shelf now.`}
        footer={<button type="submit" form="movement-form" disabled={saving} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{saving ? 'Recording…' : 'Record movement'}</button>}
      >
        <form id="movement-form" onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>What happened</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as StockMovementKind)} style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}>
              {POSTABLE.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
              {kind === 'adjustment' ? 'Difference (negative if there is less than the books say)' : 'Units'}
            </label>
            <NumberField required value={quantity} onChange={setQuantity} />
            <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: '6px 0 0' }}>
              This takes the shelf to {onHand + signed}.
            </p>
          </div>

          {kind === 'receipt' && (
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Unit cost</label>
              <NumberField value={unitCost} onChange={setUnitCost} />
            </div>
          )}

          {selected.needsReason && (
            <div>
              <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Reason</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={kind === 'write_off' ? 'Water damage in the back store' : 'Counted on Friday'}
                style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)' }}
              />
              <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: '6px 0 0', lineHeight: 1.5 }}>
                A shortfall with no explanation is what this ledger exists to replace.
              </p>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
