import { useEffect, useState } from 'react';
import { Download, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { zmw } from '../../lib/money';
import type { ReceivablesReport } from '../../types';
import { Loadable } from '../../components/Loadable';
import { useRefreshSignal } from '../../lib/refresh';

/**
 * The ageing ramp. Current is healthy, 90+ is a problem, and the two in between
 * are a gradient rather than two more categories — which is why these are a
 * deliberate sequence rather than four unrelated status colours drawn from the
 * badge tones.
 */
const BUCKET_COLOUR: Record<string, string> = {
  current: 'var(--ws-accent)',
  '30': '#d8c15a',
  '60': 'var(--copper)',
  '90+': 'var(--tone-danger-fg)',
};

const BUCKET_LABEL: Record<string, string> = {
  current: 'Current',
  '30': '30 days',
  '60': '60 days',
  '90+': '90+ days',
};

const BUCKETS = ['current', '30', '60', '90+'] as const;

const EXPORTS = [
  ['Receivables', () => api.exportReceivablesCSV()],
  ['Pipeline', () => api.exportPipelineCSV()],
  ['Payments', () => api.exportPaymentsCSV()],
] as const;

interface Props {
  /** Whether the debtor book is the section on screen. */
  active: boolean;
}

export function ReceivablesSection({ active }: Props) {
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setReport(await api.adminReceivables());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load receivables'));
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

  if (!active) return null;

  return (
    <section className="data-section" style={{ marginTop: 0 }}>
      <p style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
        What clients still owe, aged from the date each deal was invoiced. Balances are computed
        live from line items and recorded payments. Nothing here is stored, so it cannot drift.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        {EXPORTS.map(([label, run]) => (
          <button
            key={label}
            onClick={() => run().catch((err: unknown) => toast.error(errorMessage(err, 'Export failed')))}
            style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: '8px 14px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Download size={14} /> {label} CSV
          </button>
        ))}
      </div>

      <Loadable
        loading={loading}
        empty={!report}
        emptyMessage="The debtor book could not be loaded."
        emptyIcon={<Wallet size={26} strokeWidth={1.5} />}
      >
        {report && (
          <>
            {/* Ageing summary. The total leads at display size because it is the
                one figure someone opening this screen is here to read; the
                buckets beneath it explain the shape of that number. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {BUCKETS.map((b) => (
                <div
                  key={b}
                  style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderLeft: `4px solid ${BUCKET_COLOUR[b]}`, borderRadius: '8px', padding: '12px 14px' }}
                >
                  <div style={{ fontSize: 'var(--fs-100)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--fw-strong)', color: 'var(--ws-fg-muted)' }}>
                    {BUCKET_LABEL[b]}
                  </div>
                  <div style={{ fontSize: 'var(--fs-500)', fontWeight: 'var(--fw-heavy)', color: 'var(--ws-fg)', marginTop: 'var(--space-1)' }}>
                    {zmw(report.buckets[b] ?? 0)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-200)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--fw-strong)', color: 'var(--ws-fg-muted)' }}>
                Total outstanding
              </span>
              <strong style={{ fontSize: 'var(--fs-600)', fontWeight: 'var(--fw-heavy)', color: 'var(--ws-fg)', lineHeight: 'var(--lh-tight)' }}>
                {zmw(report.total_outstanding)}
              </strong>
            </div>

            {report.rows.length === 0 ? (
              <div className="empty">
                <Wallet size={26} strokeWidth={1.5} />
                <span>Nothing outstanding. A deal appears here once it is marked invoiced and still has a balance.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {report.rows.map((r) => (
                  <div
                    key={r.opportunity_id}
                    style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderLeft: `4px solid ${r.bucket === 'current' ? 'var(--ws-border-strong)' : BUCKET_COLOUR[r.bucket]}`, borderRadius: '8px', padding: '12px 14px', display: 'grid', gap: 'var(--space-2)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 'var(--fs-300)', fontWeight: 'var(--fw-medium)', color: 'var(--ws-fg)' }}>{r.name}</strong>
                        {r.account_name && <span style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}> · {r.account_name}</span>}
                      </div>
                      {/* Overdue money is red; current money is not, because
                          colouring every balance as a problem means none of
                          them reads as one. */}
                      <strong style={{ fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-strong)', color: r.bucket === 'current' ? 'var(--ws-fg)' : 'var(--tone-danger-fg)' }}>
                        {zmw(r.outstanding)}
                      </strong>
                    </div>
                    <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <span>Invoiced {r.invoiced_at ? new Date(r.invoiced_at).toLocaleDateString() : '—'}</span>
                      <span>{zmw(r.invoiced)} billed{r.apply_vat ? ' (incl. VAT)' : ''}</span>
                      <span>{zmw(r.paid)} received</span>
                      <span style={{ fontWeight: r.bucket === 'current' ? 'var(--fw-regular)' : 'var(--fw-strong)', color: r.bucket === 'current' ? undefined : 'var(--ws-fg)' }}>
                        {r.days_overdue} {r.days_overdue === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Loadable>
    </section>
  );
}
