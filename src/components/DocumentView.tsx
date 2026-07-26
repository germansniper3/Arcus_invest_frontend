import { X, Printer } from 'lucide-react';
import type { Opportunity, Payment } from '../types';
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

export type DocumentKind = 'quotation' | 'invoice' | 'receipt';

const KIND_META: Record<DocumentKind, { title: string; prefix: string }> = {
  quotation: { title: 'Quotation', prefix: 'QUO' },
  invoice: { title: 'Tax Invoice', prefix: 'INV' },
  receipt: { title: 'Receipt', prefix: 'RCP' },
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', mobile_money: 'Mobile Money',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

const money = (n: number) => `ZMW ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortId = (id: string, n = 6) => id.replace(/-/g, '').slice(0, n).toUpperCase();
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

interface DocumentViewProps {
  kind: DocumentKind;
  opportunity: Opportunity;
  payments: Payment[];
  ownerName?: string;
  applyVat: boolean;
  onToggleVat?: () => void;
  receiptPayment?: Payment;
  onClose: () => void;
}

export default function DocumentView({ kind, opportunity, payments, ownerName, applyVat, onToggleVat, receiptPayment, onClose }: DocumentViewProps) {
  const meta = KIND_META[kind];

  // Fall back to a single implicit line at the deal value when no line items exist.
  const items = (opportunity.line_items && opportunity.line_items.length > 0)
    ? opportunity.line_items
    : [{ description: opportunity.name || 'Professional services', quantity: 1, unit_price: opportunity.deal_value }];

  const subtotal = items.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const vat = applyVat ? subtotal * VAT_RATE : 0;
  const total = subtotal + vat;
  const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = total - amountPaid;

  const year = new Date().getFullYear();
  let docNumber = `${meta.prefix}-${year}-${shortId(opportunity.id)}`;
  if (kind === 'receipt' && receiptPayment) docNumber += `-${shortId(receiptPayment.id, 4)}`;

  // Buyer block: prefer the primary buying-committee contact, else the deal contact.
  const primary = (opportunity.contacts ?? []).find((c) => c.is_primary) ?? (opportunity.contacts ?? [])[0];
  const buyerName = primary?.name || opportunity.contact_name;
  const buyerEmail = primary?.email || opportunity.contact_email;
  const buyerPhone = primary?.phone;

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
              {kind === 'quotation' && opportunity.expected_close_at && (
                <div style={{ fontSize: '12px', color: '#555' }}><strong>Valid to</strong> {fmtDate(opportunity.expected_close_at)}</div>
              )}
            </div>
          </header>

          {/* Parties */}
          <section style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>{kind === 'receipt' ? 'Received From' : 'Bill To'}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{opportunity.account_name || buyerName || '—'}</div>
              {buyerName && opportunity.account_name && <div style={{ fontSize: '12px', color: '#333' }}>{buyerName}</div>}
              {buyerEmail && <div style={{ fontSize: '12px', color: '#555' }}>{buyerEmail}</div>}
              {buyerPhone && <div style={{ fontSize: '12px', color: '#555' }}>{buyerPhone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>Reference</div>
              <div style={{ fontSize: '13px', color: '#111' }}>{opportunity.name}</div>
              {ownerName && <div style={{ fontSize: '12px', color: '#555' }}>Account manager: {ownerName}</div>}
              {opportunity.sector && <div style={{ fontSize: '12px', color: '#555' }}>Sector: {opportunity.sector}</div>}
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
                  {applyVat && totalRow(`VAT (${Math.round(VAT_RATE * 100)}%)`, money(vat))}
                  {totalRow(kind === 'invoice' ? 'Total Due' : 'Total', money(total), true)}
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
          {kind !== 'receipt' && opportunity.notes && (
            <section style={{ marginTop: '22px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '4px' }}>Notes</div>
              <p style={{ fontSize: '12px', color: '#333', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{opportunity.notes}</p>
            </section>
          )}

          <footer style={{ marginTop: '34px', paddingTop: '14px', borderTop: '1px solid #ddd', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: 1.6 }}>
            {kind === 'quotation' && <div>This quotation is valid until the date shown above. Prices are in Zambian Kwacha (ZMW).</div>}
            {kind === 'invoice' && <div>Please quote invoice number <strong>{docNumber}</strong> with your payment. Amounts are in Zambian Kwacha (ZMW).</div>}
            {kind === 'receipt' && <div>This receipt confirms the payment recorded above. Thank you for your business.</div>}
            <div style={{ marginTop: '6px' }}>{ARCUS_ISSUER.name} · Generated {fmtDate(new Date().toISOString())}</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
