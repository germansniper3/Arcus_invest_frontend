import { X, Printer } from 'lucide-react';
import type { Opportunity, Payment, PurchaseOrder } from '../types';
import { arcusImages } from '../lib/assets';

// Zambian standard VAT rate, applied when a document opts into VAT.
export const VAT_RATE = 0.16;

// Issuer (letterhead) details. Location + name are taken from the public site;
// fill in the contact/tax fields below with the firm's real details — blank
// fields are simply omitted from the printed document.
export const ARCUS_ISSUER = {
  name: 'Arcus Investments',
  tagline: 'Zambian-owned engineering & innovation',
  address: 'Kitwe Innovation Hub, Kitwe, Zambia',
  email: '', // e.g. 'info@arcusinvestments.co.zm'
  phone: '', // e.g. '+260 ...'
  tpin: '',  // Taxpayer Identification Number
  logo: arcusImages.logo,
};

/**
 * The four documents this renders.
 *
 * `purchase_order` is the only one that goes OUT to a supplier rather than to a
 * client, which is why it is a kind here rather than a component of its own:
 * the letterhead, the line table, the totals block and the print path are all
 * the same, and the only real differences are which party is named and which
 * direction the money runs.
 */
export type DocumentKind = 'quotation' | 'invoice' | 'receipt' | 'purchase_order';

const KIND_META: Record<DocumentKind, { title: string; prefix: string }> = {
  quotation: { title: 'Quotation', prefix: 'QUO' },
  invoice: { title: 'Tax Invoice', prefix: 'INV' },
  receipt: { title: 'Receipt', prefix: 'RCP' },
  purchase_order: { title: 'Purchase Order', prefix: 'PO' },
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', mobile_money: 'Mobile Money',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

/**
 * Money on a printed document, in whichever currency the document is stated in.
 *
 * The deal documents are always kwacha; a purchase order is routinely not, and
 * printing USD figures under a ZMW label would be a document the supplier could
 * reasonably dispute.
 */
const moneyIn = (currency: string) => (n: number) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortId = (id: string, n = 6) => id.replace(/-/g, '').slice(0, n).toUpperCase();
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

interface DocumentViewProps {
  kind: DocumentKind;
  /** The three client-facing documents. Absent on a purchase order. */
  opportunity?: Opportunity;
  /** The supplier-facing document. Absent on the other three. */
  purchaseOrder?: PurchaseOrder;
  payments?: Payment[];
  ownerName?: string;
  applyVat: boolean;
  onToggleVat?: () => void;
  receiptPayment?: Payment;
  onClose: () => void;
}

export default function DocumentView({ kind, opportunity, purchaseOrder, payments = [], ownerName, applyVat, onToggleVat, receiptPayment, onClose }: DocumentViewProps) {
  const meta = KIND_META[kind];
  const isPO = kind === 'purchase_order';

  // A kind with nothing to render is a caller bug, not a document. Bail rather
  // than printing a letterhead over empty fields.
  if (isPO ? !purchaseOrder : !opportunity) return null;

  const money = moneyIn(isPO ? (purchaseOrder?.currency ?? 'ZMW') : 'ZMW');

  // Line items. Deal documents fall back to a single implicit line at the deal
  // value when none were itemised; a purchase order always has real lines,
  // because the server refuses to create one without them.
  const items = isPO
    ? purchaseOrder!.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }))
    : (opportunity!.line_items && opportunity!.line_items.length > 0)
      ? opportunity!.line_items
      : [{ description: opportunity!.name || 'Professional services', quantity: 1, unit_price: opportunity!.deal_value }];

  const subtotal = items.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  // A purchase order carries no VAT of ours: what the supplier charges is on
  // their invoice, and on an import the VAT is assessed at the border. Showing
  // a VAT line here would state a figure we are not the ones setting.
  const vat = applyVat && !isPO ? subtotal * VAT_RATE : 0;
  const total = subtotal + vat;
  const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = total - amountPaid;

  const year = new Date().getFullYear();
  let docNumber: string;
  if (isPO) {
    // The server allocates the supplier-facing number on issue. A draft has
    // none, and inventing one here would print a reference nothing can match.
    docNumber = purchaseOrder!.number || `${meta.prefix}-DRAFT-${shortId(purchaseOrder!.id, 4)}`;
  } else {
    docNumber = `${meta.prefix}-${year}-${shortId(opportunity!.id)}`;
    if (kind === 'receipt' && receiptPayment) docNumber += `-${shortId(receiptPayment.id, 4)}`;
  }

  // The named party. On the three deal documents that is the client; on a
  // purchase order it is the supplier, and the money runs the other way.
  const primary = (opportunity?.contacts ?? []).find((c) => c.is_primary) ?? (opportunity?.contacts ?? [])[0];
  const partyLabel = isPO ? 'Supplier' : kind === 'receipt' ? 'Received From' : 'Bill To';
  const partyOrg = isPO ? purchaseOrder!.supplier : (opportunity!.account_name || primary?.name || opportunity!.contact_name);
  const buyerName = isPO ? '' : (primary?.name || opportunity!.contact_name);
  const buyerEmail = isPO ? '' : (primary?.email || opportunity!.contact_email);
  const buyerPhone = isPO ? '' : primary?.phone;
  const docNotes = isPO ? purchaseOrder!.notes : opportunity!.notes;

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#555', borderBottom: '2px solid #111' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: '13px', color: '#111', borderBottom: '1px solid #e2e2e2', verticalAlign: 'top' };
  const totalRow = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '5px 0', fontSize: strong ? '15px' : '13px', fontWeight: strong ? 800 : 500, color: '#111', borderTop: strong ? '2px solid #111' : undefined, marginTop: strong ? '4px' : undefined }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );

  return (
    <div className="doc-overlay">
      <div className="doc-toolbar doc-no-print">
        {kind !== 'receipt' && onToggleVat && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#e6e8e0', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={applyVat} onChange={onToggleVat} style={{ width: 'auto' }} /> Apply {Math.round(VAT_RATE * 100)}% VAT
          </label>
        )}
        <button onClick={() => window.print()} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px' }}>
          <Printer size={16} /> Print / Save as PDF
        </button>
        <button onClick={onClose} style={{ background: '#fff', border: '1px solid #cfd2c9', borderRadius: '8px', minHeight: '38px', padding: '0 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <X size={16} /> Close
        </button>
      </div>

      <div className="doc-print-root">
        <div className="doc-page">
          {/* Letterhead */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', borderBottom: '3px solid #5f7c29', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <img src={ARCUS_ISSUER.logo} alt="" style={{ height: '52px', width: 'auto' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#111', letterSpacing: '0.01em' }}>{ARCUS_ISSUER.name}</div>
                <div style={{ fontSize: '12px', color: '#5f7c29', fontWeight: 600 }}>{ARCUS_ISSUER.tagline}</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.5 }}>
                  {ARCUS_ISSUER.address}<br />
                  {[ARCUS_ISSUER.email, ARCUS_ISSUER.phone].filter(Boolean).join(' · ')}
                  {ARCUS_ISSUER.tpin && <><br />TPIN: {ARCUS_ISSUER.tpin}</>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '26px', fontWeight: 900, textTransform: 'uppercase', color: '#111', letterSpacing: '0.03em' }}>{meta.title}</div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '6px' }}><strong>No.</strong> {docNumber}</div>
              <div style={{ fontSize: '12px', color: '#555' }}><strong>Date</strong> {fmtDate(receiptPayment?.paid_at ?? new Date().toISOString())}</div>
              {kind === 'quotation' && opportunity?.expected_close_at && (
                <div style={{ fontSize: '12px', color: '#555' }}><strong>Valid to</strong> {fmtDate(opportunity.expected_close_at)}</div>
              )}
              {isPO && purchaseOrder!.expected_delivery && (
                <div style={{ fontSize: '12px', color: '#555' }}><strong>Required by</strong> {fmtDate(purchaseOrder!.expected_delivery)}</div>
              )}
              {isPO && purchaseOrder!.incoterms && (
                <div style={{ fontSize: '12px', color: '#555' }}><strong>Incoterms</strong> {purchaseOrder!.incoterms}</div>
              )}
            </div>
          </header>

          {/* Parties */}
          <section style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>{partyLabel}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{partyOrg || buyerName || '—'}</div>
              {buyerName && opportunity?.account_name && <div style={{ fontSize: '12px', color: '#333' }}>{buyerName}</div>}
              {buyerEmail && <div style={{ fontSize: '12px', color: '#555' }}>{buyerEmail}</div>}
              {buyerPhone && <div style={{ fontSize: '12px', color: '#555' }}>{buyerPhone}</div>}
              {isPO && purchaseOrder!.supplier_tpin && (
                <div style={{ fontSize: '12px', color: '#555' }}>TPIN: {purchaseOrder!.supplier_tpin}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>
                {isPO ? 'Deliver To' : 'Reference'}
              </div>
              {isPO ? (
                <>
                  <div style={{ fontSize: '13px', color: '#111' }}>{ARCUS_ISSUER.name}</div>
                  <div style={{ fontSize: '12px', color: '#555' }}>{ARCUS_ISSUER.address}</div>
                  {purchaseOrder!.raised_by && <div style={{ fontSize: '12px', color: '#555' }}>Raised by: {purchaseOrder!.raised_by}</div>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: '#111' }}>{opportunity!.name}</div>
                  {ownerName && <div style={{ fontSize: '12px', color: '#555' }}>Account manager: {ownerName}</div>}
                  {opportunity!.sector && <div style={{ fontSize: '12px', color: '#555' }}>Sector: {opportunity!.sector}</div>}
                </>
              )}
            </div>
          </section>

          {/* Receipt: payment confirmation banner */}
          {kind === 'receipt' && receiptPayment && (
            <div style={{ marginTop: '18px', background: '#eef3e4', border: '1px solid #cfe0b4', borderRadius: '8px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#3a4a1f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount received</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#35520f' }}>{money(receiptPayment.amount)}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#3a4a1f', textAlign: 'right' }}>
                <div>Method: <strong>{METHOD_LABELS[receiptPayment.method] ?? receiptPayment.method}</strong></div>
                {receiptPayment.reference && <div>Ref: {receiptPayment.reference}</div>}
                <div>Paid: {fmtDate(receiptPayment.paid_at)}</div>
              </div>
            </div>
          )}

          {/* Line items — quotation & invoice */}
          {kind !== 'receipt' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr>
                  <th style={th}>Description</th>
                  <th style={{ ...th, textAlign: 'right', width: '80px' }}>Qty</th>
                  <th style={{ ...th, textAlign: 'right', width: '130px' }}>Unit Price</th>
                  <th style={{ ...th, textAlign: 'right', width: '140px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, i) => (
                  <tr key={i}>
                    <td style={td}>{li.description}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{li.quantity.toLocaleString()}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(li.unit_price)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(li.quantity * li.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <section style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
            <div style={{ minWidth: '280px' }}>
              {kind !== 'receipt' && (
                <>
                  {totalRow('Subtotal', money(subtotal))}
                  {applyVat && !isPO && totalRow(`VAT (${Math.round(VAT_RATE * 100)}%)`, money(vat))}
                  {totalRow(kind === 'invoice' ? 'Total Due' : isPO ? 'Order Total' : 'Total', money(total), true)}
                  {/* A foreign-currency order also states its kwacha value, at
                      the rate on the order, so the approval it passed and the
                      figure on the paper are the same number. */}
                  {isPO && purchaseOrder!.currency !== 'ZMW' && totalRow(
                    `Equivalent at ${purchaseOrder!.exchange_rate}`,
                    moneyIn('ZMW')(total * purchaseOrder!.exchange_rate),
                  )}
                  {kind === 'invoice' && amountPaid > 0 && (
                    <>
                      {totalRow('Amount Paid', `- ${money(amountPaid)}`)}
                      {totalRow('Balance Due', money(balance), true)}
                    </>
                  )}
                </>
              )}
              {kind === 'receipt' && (
                <>
                  {totalRow('Invoice Total', money(total))}
                  {totalRow('Total Paid to Date', money(amountPaid))}
                  {totalRow('Outstanding Balance', money(Math.max(balance, 0)), true)}
                </>
              )}
            </div>
          </section>

          {/* Notes / terms */}
          {kind !== 'receipt' && docNotes && (
            <section style={{ marginTop: '22px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>Notes</div>
              <p style={{ fontSize: '12px', color: '#333', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{docNotes}</p>
            </section>
          )}

          <footer style={{ marginTop: '34px', paddingTop: '14px', borderTop: '1px solid #ddd', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: 1.6 }}>
            {kind === 'quotation' && <div>This quotation is valid until the date shown above. Prices are in Zambian Kwacha (ZMW).</div>}
            {kind === 'invoice' && <div>Please quote invoice number <strong>{docNumber}</strong> with your payment. Amounts are in Zambian Kwacha (ZMW).</div>}
            {kind === 'receipt' && <div>This receipt confirms the payment recorded above. Thank you for your business.</div>}
            {isPO && (
              <div>
                Please quote order number <strong>{docNumber}</strong> on your invoice and
                delivery note. Goods remain subject to inspection on delivery.
                {purchaseOrder!.currency !== 'ZMW' && ` Amounts are in ${purchaseOrder!.currency}.`}
              </div>
            )}
            <div style={{ marginTop: '6px' }}>{ARCUS_ISSUER.name} · Generated {fmtDate(new Date().toISOString())}</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
