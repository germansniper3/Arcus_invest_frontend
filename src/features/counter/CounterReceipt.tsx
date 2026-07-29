import { X, Printer } from 'lucide-react';
import { ARCUS_ISSUER, VAT_RATE } from '../../components/DocumentView';
import type { CounterSale } from '../../types';

/**
 * The paper a walk-in customer leaves with.
 *
 * This deliberately does not reuse `DocumentView` wholesale. That component is
 * built around an Opportunity and its Payments — a negotiated deal, billed and
 * settled over time — and a till receipt is a different document: it is issued
 * once, at the moment of sale, and its distinguishing content is the tender
 * block (what was handed over, what came back) which a deal invoice has no
 * concept of. What is shared is the letterhead, the page furniture and the
 * print stylesheet, and those are imported rather than copied.
 */

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

const money = (n: number) =>
  `ZMW ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortId = (id: string, n = 6) => id.replace(/-/g, '').slice(0, n).toUpperCase();
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export function CounterReceipt({ sale, onClose }: { sale: CounterSale; onClose: () => void }) {
  const docNumber = `RCP-${new Date(sale.created_at).getFullYear()}-${shortId(sale.id)}`;

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '7px 8px', fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.04em', color: '#555', borderBottom: '2px solid #111',
  };
  const td: React.CSSProperties = {
    padding: '8px', fontSize: '13px', color: '#111', borderBottom: '1px solid #e2e2e2',
    verticalAlign: 'top',
  };
  const line = (label: string, value: string, strong = false) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '5px 0',
      fontSize: strong ? '15px' : '13px', fontWeight: strong ? 800 : 500, color: '#111',
      borderTop: strong ? '2px solid #111' : undefined, marginTop: strong ? '4px' : undefined,
    }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );

  return (
    <div className="doc-overlay">
      <div className="doc-toolbar doc-no-print">
        <button onClick={() => window.print()} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px' }}>
          <Printer size={16} /> Print receipt
        </button>
        <button onClick={onClose} style={{ background: '#fff', border: '1px solid #cfd2c9', borderRadius: '8px', minHeight: '38px', padding: '0 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <X size={16} /> Close
        </button>
      </div>

      <div className="doc-print-root">
        <div className="doc-page doc-page--receipt">
          {/* Letterhead */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', borderBottom: '3px solid #5f7c29', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img src={ARCUS_ISSUER.logo} alt="" style={{ height: '44px', width: 'auto' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <div style={{ fontSize: '19px', fontWeight: 900, color: '#111' }}>{ARCUS_ISSUER.name}</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '3px', lineHeight: 1.5 }}>
                  {ARCUS_ISSUER.address}
                  {ARCUS_ISSUER.tpin && <><br />TPIN: {ARCUS_ISSUER.tpin}</>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#111', letterSpacing: '0.03em' }}>Sale Receipt</div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '5px' }}><strong>No.</strong> {docNumber}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>{fmtDateTime(sale.created_at)}</div>
            </div>
          </header>

          {/* Who served it, and who it was for. A till receipt is the only
              record tying a shift and an operator to a specific transaction,
              so both belong on the paper the customer keeps. */}
          <section style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginTop: '16px', fontSize: '12px', color: '#555' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '3px' }}>Customer</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{sale.customer_name || 'Cash sale'}</div>
              {sale.customer_tpin && <div>TPIN: {sale.customer_tpin}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '3px' }}>Served by</div>
              <div style={{ fontSize: '13px', color: '#111' }}>{sale.sold_by || '—'}</div>
              <div>Till {shortId(sale.till_session_id, 4)}</div>
            </div>
          </section>

          {/* Items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={{ ...th, textAlign: 'right', width: '60px' }}>Qty</th>
                <th style={{ ...th, textAlign: 'right', width: '110px' }}>Price</th>
                <th style={{ ...th, textAlign: 'right', width: '120px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l, i) => (
                <tr key={l.id ?? i}>
                  <td style={td}>{l.description}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{l.quantity.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(l.unit_price)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(l.quantity * l.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals and tender */}
          <section style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <div style={{ minWidth: '260px' }}>
              {line('Subtotal', money(sale.subtotal))}
              {sale.apply_vat && line(`VAT (${Math.round(VAT_RATE * 100)}%)`, money(sale.vat))}
              {line('Total', money(sale.total), true)}

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #bbb' }}>
                {line(METHOD_LABELS[sale.payment_method] ?? sale.payment_method, money(sale.amount_tendered))}
                {sale.payment_method === 'cash'
                  ? line('Change', money(sale.change), true)
                  : sale.reference
                    ? line('Reference', sale.reference)
                    : null}
              </div>
            </div>
          </section>

          {/* Smart Invoice. The system records a Mark ID; it never generates
              one. Arcus is not a ZRA-approved provider, and printing something
              that resembles a Smart Invoice would put an invalid tax document
              into a customer's hands — worse than printing none at all. */}
          {sale.apply_vat && (
            <section style={{ marginTop: '18px', padding: '10px 12px', background: '#f6f6f2', border: '1px solid #e2e2dc', borderRadius: '6px', fontSize: '11px', color: '#555', lineHeight: 1.6 }}>
              {sale.smart_invoice_ref ? (
                <>ZRA Smart Invoice reference: <strong style={{ color: '#111' }}>{sale.smart_invoice_ref}</strong></>
              ) : (
                <>VAT has been charged on this sale. The valid tax invoice for reclaim purposes is the ZRA Smart Invoice, issued separately; this receipt is not a substitute for it.</>
              )}
            </section>
          )}

          {sale.note && (
            <p style={{ fontSize: '12px', color: '#333', marginTop: '14px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{sale.note}</p>
          )}

          <footer style={{ marginTop: '26px', paddingTop: '12px', borderTop: '1px solid #ddd', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: 1.6 }}>
            <div>Goods remain checkable against this receipt. Amounts are in Zambian Kwacha (ZMW).</div>
            <div style={{ marginTop: '5px' }}>Thank you for your business.</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
