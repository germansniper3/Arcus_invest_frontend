import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, X, Search, Lock, Unlock, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { api, type CounterSaleInput } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Product, TillSession, TillSummary, CounterSale, CounterMethod } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';

const VAT_RATE = 0.16;
const ZMW = (n: number) => `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZMW`;

const METHODS: { value: CounterMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Transfer' },
];

interface CartLine {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  /** What the ledger says is on the shelf, so the cart can refuse to oversell. */
  available: number | null;
}

interface Props {
  active: boolean;
}

export function CounterSection({ active }: Props) {
  const can = useCan();
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<TillSession | null>(null);
  const [summary, setSummary] = useState<TillSummary | null>(null);
  const [recent, setRecent] = useState<CounterSale[]>([]);

  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<CounterMethod>('cash');
  const [tendered, setTendered] = useState(0);
  const [applyVat, setApplyVat] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerTpin, setCustomerTpin] = useState('');
  const [reference, setReference] = useState('');
  const [selling, setSelling] = useState(false);

  const [showOpen, setShowOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [showClose, setShowClose] = useState(false);
  const [countedCash, setCountedCash] = useState(0);
  const [lastSale, setLastSale] = useState<CounterSale | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [nextProducts, sessions] = await Promise.all([
        api.adminListProducts(),
        api.adminListTillSessions(),
      ]);
      setProducts(nextProducts);
      const open = sessions.items.find((s) => s.status === 'open') ?? null;
      setSession(open);
      if (open) {
        const [nextSummary, sales] = await Promise.all([
          api.adminTillSummary(open.id),
          api.adminListCounterSales(open.id),
        ]);
        setSummary(nextSummary);
        setRecent(sales.items);
      } else {
        setSummary(null);
        setRecent([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not load the counter');
    }
  }

  useEffect(() => {
    if (active) load();
  }, [active]);

  // The counter is a keyboard surface: the operator is typing a product name
  // with a customer waiting, not reaching for a mouse.
  useEffect(() => {
    if (active && session) searchRef.current?.focus();
  }, [active, session]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, products]);

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const vat = applyVat ? subtotal * VAT_RATE : 0;
  const total = subtotal + vat;
  const change = method === 'cash' ? Math.max(0, tendered - total) : 0;
  const shortBy = method === 'cash' ? Math.max(0, total - tendered) : 0;

  function addProduct(p: Product) {
    setCart((prev) => {
      const at = prev.findIndex((l) => l.product_id === p.id);
      if (at >= 0) {
        const next = [...prev];
        // Refuse here as well as on the server. Discovering the shelf is empty
        // after the customer has paid is the wrong moment.
        if (next[at].available !== null && next[at].quantity + 1 > next[at].available!) {
          toast.warning(`Only ${next[at].available} of ${p.name} on the shelf`);
          return prev;
        }
        next[at] = { ...next[at], quantity: next[at].quantity + 1 };
        return next;
      }
      if (p.stock <= 0) {
        toast.warning(`${p.name} is out of stock`);
        return prev;
      }
      return [...prev, { product_id: p.id, description: p.name, quantity: 1, unit_price: p.price, available: p.stock }];
    });
    setQuery('');
    searchRef.current?.focus();
  }

  function setQuantity(index: number, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((_, i) => i !== index);
      const line = prev[index];
      if (line.available !== null && quantity > line.available) {
        toast.warning(`Only ${line.available} on the shelf`);
        return prev;
      }
      return prev.map((l, i) => (i === index ? { ...l, quantity } : l));
    });
  }

  function clearSale() {
    setCart([]);
    setTendered(0);
    setCustomerName('');
    setCustomerTpin('');
    setReference('');
    setApplyVat(false);
    searchRef.current?.focus();
  }

  async function completeSale() {
    if (cart.length === 0) return;
    setSelling(true);
    try {
      const body: CounterSaleInput = {
        till_session_id: session?.id,
        customer_name: customerName,
        customer_tpin: customerTpin,
        apply_vat: applyVat,
        payment_method: method,
        amount_tendered: method === 'cash' ? tendered : total,
        reference,
        lines: cart.map((l) => ({
          product_id: l.product_id, description: l.description,
          quantity: l.quantity, unit_price: l.unit_price,
        })),
      };
      const sale = await api.adminCreateCounterSale(body);
      setLastSale(sale);
      clearSale();
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not complete the sale');
    } finally {
      setSelling(false);
    }
  }

  async function openTill(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.adminOpenTill({ opening_float: openingFloat });
      toast.success('Till open');
      setShowOpen(false);
      setOpeningFloat(0);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not open the till');
    }
  }

  async function closeTill(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      const result = await api.adminCloseTill(session.id, { counted_cash: countedCash });
      const variance = result.variance ?? 0;
      if (Math.abs(variance) < 0.005) {
        toast.success('Till closed. The drawer balances.');
      } else if (variance < 0) {
        toast.warning(`Till closed. The drawer is short by ${ZMW(Math.abs(variance))}.`);
      } else {
        toast.warning(`Till closed. The drawer holds ${ZMW(variance)} more than expected.`);
      }
      setShowClose(false);
      setCountedCash(0);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not close the till');
    }
  }

  if (!active) {
    // Nothing to keep mounted: this feature's dialogs are only reachable while
    // the counter is on screen, so there is no focus to restore from elsewhere.
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Shift bar */}
      <article className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {session ? (
          <>
            <div>
              <strong style={{ fontSize: '15px' }}>Till open since {new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '3px' }}>
                {session.opened_by} · float {ZMW(session.opening_float)}
                {summary && ` · drawer should hold ${ZMW(summary.expected_cash)}`}
              </div>
            </div>
            {can('counter_sales', 'update') && (
              <button onClick={() => { setCountedCash(0); setShowClose(true); }} style={{ background: '#eef0ea', color: '#111512', border: 0, borderRadius: '6px', minHeight: '40px', padding: '0 16px', fontWeight: 700 }}>
                <Lock size={15} /> Cash up
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              <strong style={{ fontSize: '15px' }}>No till is open</strong>
              <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '3px' }}>
                Count the float and open a till before selling.
              </div>
            </div>
            {can('counter_sales', 'create') && (
              <button onClick={() => setShowOpen(true)} className="primary" style={{ minHeight: '40px' }}>
                <Unlock size={15} /> Open till
              </button>
            )}
          </>
        )}
      </article>

      {session && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px', alignItems: 'start' }}>
          {/* Item entry */}
          <section className="data-section" style={{ marginTop: 0 }}>
            <h2 style={{ marginTop: 0 }}>Add items</h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8a908a', pointerEvents: 'none' }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter takes the top match, so a whole sale can be rung up
                  // without leaving the keyboard.
                  if (e.key === 'Enter' && matches.length > 0) {
                    e.preventDefault();
                    addProduct(matches[0]);
                  }
                  if (e.key === 'Escape') setQuery('');
                }}
                placeholder="Type a product name, then press Enter"
                style={{ color: '#111512', background: '#fff', paddingLeft: '40px', minHeight: '48px', fontSize: '15px' }}
              />
            </div>

            {matches.length > 0 && (
              <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
                {matches.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                      background: i === 0 ? '#f2f7ea' : '#fff', border: `1px solid ${i === 0 ? '#c5dfa6' : '#dfe1da'}`,
                      borderRadius: '8px', padding: '10px 14px', textAlign: 'left', color: '#111512', minHeight: '48px',
                    }}
                  >
                    <span>
                      <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: p.stock > 0 ? '#5a625d' : '#a00' }}>
                        {p.stock > 0 ? `${p.stock} on the shelf` : 'Out of stock'}
                      </span>
                    </span>
                    <strong style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{ZMW(p.price)}</strong>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: '8px', marginTop: '18px' }}>
              {cart.length === 0 ? (
                <p className="empty" style={{ textAlign: 'center', color: '#5a625d' }}>Search for the first item.</p>
              ) : (
                cart.map((line, i) => (
                  <div key={`${line.product_id}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'center', background: '#fff', border: '1px solid #dfe1da', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '14px' }}>{line.description}</strong>
                      <div style={{ fontSize: '11px', color: '#5a625d' }}>{ZMW(line.unit_price)} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button aria-label="One fewer" onClick={() => setQuantity(i, line.quantity - 1)} style={{ background: '#eef0ea', border: 0, borderRadius: '4px', width: 30, height: 30 }}><Minus size={13} /></button>
                      <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</span>
                      <button aria-label="One more" onClick={() => setQuantity(i, line.quantity + 1)} style={{ background: '#eef0ea', border: 0, borderRadius: '4px', width: 30, height: 30 }}><Plus size={13} /></button>
                    </div>
                    <strong style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{ZMW(line.quantity * line.unit_price)}</strong>
                    <button aria-label={`Remove ${line.description}`} onClick={() => setQuantity(i, 0)} style={{ background: 'transparent', border: 0, color: '#8a908a', padding: 4 }}><X size={15} /></button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="data-section" style={{ marginTop: 0 }}>
            <h2 style={{ marginTop: 0 }}>Take payment</h2>
            <article className="panel" style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5a625d' }}>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ZMW(subtotal)}</span>
                </div>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#5a625d' }}>
                    <input type="checkbox" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} style={{ width: 'auto' }} />
                    VAT at 16%
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ZMW(vat)}</span>
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dfe1da', paddingTop: '10px', marginTop: '4px' }}>
                  <strong style={{ fontSize: '17px' }}>Total</strong>
                  <strong style={{ fontSize: '22px', fontVariantNumeric: 'tabular-nums' }}>{ZMW(total)}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    aria-pressed={method === m.value}
                    style={{
                      minHeight: '42px', borderRadius: '6px', fontWeight: 700, fontSize: '13px',
                      border: `1px solid ${method === m.value ? '#5f7c29' : '#d8dbd1'}`,
                      background: method === m.value ? '#e8f2dc' : '#fff',
                      color: '#111512',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {method === 'cash' ? (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Cash received</label>
                  <NumberField value={tendered} onChange={setTendered} style={{ minHeight: '46px', fontSize: '16px' }} />
                  {shortBy > 0 ? (
                    <span style={{ fontSize: '13px', color: '#a00', fontWeight: 700 }}>Short by {ZMW(shortBy)}</span>
                  ) : (
                    <span style={{ fontSize: '15px', color: '#35520f', fontWeight: 800 }}>Change {ZMW(change)}</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Reference</label>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction or slip number" style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              )}

              <details>
                <summary style={{ fontSize: '12px', color: '#5a625d', cursor: 'pointer' }}>Customer details</summary>
                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" style={{ color: '#111512', background: '#f7f8f3' }} />
                  <input value={customerTpin} onChange={(e) => setCustomerTpin(e.target.value)} placeholder="TPIN, if they need to reclaim the VAT" style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </details>

              <button
                onClick={completeSale}
                disabled={selling || cart.length === 0 || shortBy > 0}
                className="primary"
                style={{ minHeight: '52px', fontSize: '16px', opacity: selling || cart.length === 0 || shortBy > 0 ? 0.5 : 1 }}
              >
                {selling ? 'Recording…' : 'Complete sale'}
              </button>
              {cart.length > 0 && (
                <button onClick={clearSale} style={{ background: 'transparent', border: '1px solid #d8dbd1', color: '#5a625d', borderRadius: '6px', minHeight: '38px', fontSize: '13px' }}>
                  Clear
                </button>
              )}
            </article>

            {recent.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <h3 style={{ fontSize: '14px', margin: '0 0 8px' }}>This shift</h3>
                <div style={{ display: 'grid', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {recent.map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: '#fff', border: '1px solid #dfe1da', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
                      <span style={{ color: '#5a625d' }}>
                        {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {METHODS.find((m) => m.value === s.payment_method)?.label ?? s.payment_method}
                      </span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{ZMW(s.total)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        open={showOpen}
        onClose={() => setShowOpen(false)}
        title="Open the till"
        description="Count what is in the drawer now. The cash-up at the end of the shift is measured against it."
        footer={<button type="submit" form="open-till-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>Open till</button>}
      >
        <form id="open-till-form" onSubmit={openTill} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Opening float</label>
            <NumberField required value={openingFloat} onChange={setOpeningFloat} style={{ minHeight: '46px', fontSize: '16px' }} />
          </div>
        </form>
      </Modal>

      <Modal
        open={showClose}
        onClose={() => setShowClose(false)}
        title="Cash up"
        description={summary ? `The drawer should hold ${ZMW(summary.expected_cash)}: ${ZMW(session?.opening_float ?? 0)} float plus ${ZMW(summary.takings.cash ?? 0)} taken in cash.` : undefined}
        footer={<button type="submit" form="close-till-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>Close till</button>}
      >
        <form id="close-till-form" onSubmit={closeTill} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Cash counted</label>
            <NumberField required value={countedCash} onChange={setCountedCash} style={{ minHeight: '46px', fontSize: '16px' }} />
          </div>
          {summary && countedCash > 0 && Math.abs(countedCash - summary.expected_cash) >= 0.005 && (
            <p style={{ fontSize: '13px', color: '#c98745', margin: 0, fontWeight: 700 }}>
              {countedCash < summary.expected_cash
                ? `That is ${ZMW(summary.expected_cash - countedCash)} short.`
                : `That is ${ZMW(countedCash - summary.expected_cash)} over.`}
            </p>
          )}
          <p style={{ fontSize: '11px', color: '#8a908a', margin: 0, lineHeight: 1.5 }}>
            Card, transfer and mobile money are not in the drawer, so they are not part of this count.
          </p>
        </form>
      </Modal>

      <Modal
        open={!!lastSale}
        onClose={() => setLastSale(null)}
        title="Sale recorded"
        cancelLabel="Done"
      >
        {lastSale && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Receipt size={20} style={{ color: '#5f7c29' }} />
              <strong style={{ fontSize: '20px' }}>{ZMW(lastSale.total)}</strong>
            </div>
            {lastSale.payment_method === 'cash' && lastSale.change > 0 && (
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111512' }}>
                Change {ZMW(lastSale.change)}
              </p>
            )}
            <p style={{ margin: 0, fontSize: '12px', color: '#5a625d', lineHeight: 1.5 }}>
              Stock has been taken off the shelf for {lastSale.lines.length} item{lastSale.lines.length === 1 ? '' : 's'}.
              {lastSale.apply_vat && ' Put this through Smart Invoice to issue a valid tax invoice.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
