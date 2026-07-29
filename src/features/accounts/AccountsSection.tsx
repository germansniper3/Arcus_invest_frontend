import { Fragment, useEffect, useState } from 'react';
import { Building2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { zmw } from '../../lib/money';
import { GRADE_STYLES, SEGMENT_STYLES } from '../../lib/dealTaxonomy';
import type { AccountsIndex, AccountRecommendations } from '../../types';
import { Badge } from '../../components/Badge';
import { Loadable } from '../../components/Loadable';
import { useRefreshSignal } from '../../lib/refresh';

interface Props {
  /** Whether the accounts index is the section on screen. */
  active: boolean;
}

export function AccountsSection({ active }: Props) {
  const [index, setIndex] = useState<AccountsIndex | null>(null);
  const [loading, setLoading] = useState(true);

  // Cross-sell / upsell recommendations for the expanded account row.
  const [recsAccount, setRecsAccount] = useState<string | null>(null);
  const [recs, setRecs] = useState<AccountRecommendations | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setIndex(await api.adminAccountsIndex());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load accounts'));
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

  async function toggleRecommendations(account: string) {
    if (recsAccount === account) {
      setRecsAccount(null);
      setRecs(null);
      return;
    }
    setRecsAccount(account);
    setRecs(null);
    setRecsLoading(true);
    try {
      setRecs(await api.adminAccountRecommendations(account));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load recommendations'));
      setRecsAccount(null);
    } finally {
      setRecsLoading(false);
    }
  }

  if (!active) return null;

  const sectors = index?.sectors ?? [];
  const accounts = index?.accounts ?? [];
  const maxSector = sectors[0]?.total_value || 1;

  const th: React.CSSProperties = {
    padding: '12px 14px', fontSize: 'var(--fs-100)', textTransform: 'uppercase',
    letterSpacing: '0.03em', fontWeight: 'var(--fw-strong)', color: 'var(--ws-fg-muted)',
  };
  const td: React.CSSProperties = { padding: '12px 14px' };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      {/* Vertical Sales Index — sectors ranked */}
      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Vertical Sales Index</h2>
        <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}>
          Revenue ranked by sector: closed-won plus live pipeline.
        </p>

        <Loadable
          loading={loading}
          empty={sectors.length === 0}
          emptyMessage="Sectors rank here once deals carry one."
          emptyIcon={<Building2 size={26} strokeWidth={1.5} />}
        >
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {sectors.map((s, i) => (
              <article key={s.sector} className="panel" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <strong style={{ color: 'var(--ws-fg)', fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-medium)' }}>
                    <span style={{ color: 'var(--ws-fg-subtle)' }}>#{i + 1}</span> {s.sector}
                  </strong>
                  <strong style={{ color: 'var(--ws-fg)', fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-strong)' }}>{zmw(s.total_value)}</strong>
                </div>
                {/* The bar is proportional to the leading sector, so the ranking
                    is legible before any figure is read. */}
                <div style={{ height: '8px', background: 'var(--ws-border)', borderRadius: '999px', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                  <div style={{ width: `${Math.max(2, (s.total_value / maxSector) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                  <span>{s.account_count} account{s.account_count === 1 ? '' : 's'}</span>
                  <span>{s.deal_count} deal{s.deal_count === 1 ? '' : 's'}</span>
                  <span>Won <strong style={{ color: 'var(--tone-positive-fg)' }}>{zmw(s.won_value)}</strong></span>
                  <span>Open {zmw(s.open_value)}</span>
                  <span>Weighted {zmw(s.weighted_value)}</span>
                </div>
              </article>
            ))}
          </div>
        </Loadable>
      </section>

      {/* Top accounts ranked */}
      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Top Accounts</h2>
        <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
          Accounts ranked by total value (open pipeline + closed-won). Click an account for
          cross-sell &amp; upsell suggestions.
        </p>

        <Loadable
          loading={loading}
          empty={accounts.length === 0}
          emptyMessage="Name the account on a deal and it will appear here."
          emptyIcon={<Building2 size={26} strokeWidth={1.5} />}
        >
          <div style={{ overflowX: 'auto', border: '1px solid var(--ws-border-strong)', borderRadius: '8px', background: 'var(--ws-panel)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px', fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={th}>Account</th>
                  <th style={th}>Sector</th>
                  <th style={th}>Segment</th>
                  <th style={th}>Grade</th>
                  <th style={{ ...th, textAlign: 'right' }}>Open deals</th>
                  <th style={{ ...th, textAlign: 'right' }}>Weighted</th>
                  <th style={{ ...th, textAlign: 'right' }}>Won</th>
                  <th style={{ ...th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const grade = a.top_grade ? GRADE_STYLES[a.top_grade] : null;
                  const expanded = recsAccount === a.account;
                  return (
                    <Fragment key={a.account}>
                      <tr
                        onClick={() => toggleRecommendations(a.account)}
                        style={{ borderTop: '1px solid var(--tone-neutral-bg)', cursor: 'pointer', background: expanded ? 'var(--ws-sunken)' : undefined }}
                      >
                        <td style={{ ...td, fontWeight: 'var(--fw-medium)' }}>
                          <span style={{ color: 'var(--ws-fg-subtle)', marginRight: 'var(--space-2)' }}>{expanded ? '▾' : '▸'}</span>
                          {a.account}
                        </td>
                        <td style={{ ...td, color: 'var(--ws-fg-muted)' }}>{a.sector}</td>
                        <td style={td}>
                          {a.segment && SEGMENT_STYLES[a.segment]
                            ? <Badge tone={SEGMENT_STYLES[a.segment].tone} upper>{SEGMENT_STYLES[a.segment].label}</Badge>
                            : '—'}
                        </td>
                        <td style={td}>
                          {grade ? <Badge tone={grade.tone} upper>{grade.label}</Badge> : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{a.open_count}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--ws-accent)' }}>{zmw(a.weighted_value)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{zmw(a.won_value)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 'var(--fw-heavy)' }}>{zmw(a.total_value)}</td>
                      </tr>

                      {expanded && (
                        <tr style={{ background: 'var(--ws-sunken)' }}>
                          <td colSpan={8} style={{ padding: '0 14px 16px' }}>
                            {recsLoading ? (
                              <p style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)', margin: '10px 0' }}>Analysing account…</p>
                            ) : !recs || recs.recommendations.length === 0 ? (
                              <p style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)', margin: '10px 0' }}>
                                This account already has everything in the catalogue.
                              </p>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: '6px 0 10px' }}>
                                  <Sparkles size={14} color="var(--ws-accent)" />
                                  <strong style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>Cross-sell &amp; upsell suggestions</strong>
                                  {/* Says which engine produced the ranking, so a
                                      heuristic list is never mistaken for a
                                      model's judgement. */}
                                  <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>
                                    {recs.source.startsWith('anthropic') ? 'AI-assisted rationale' : 'heuristic ranking'}
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                                  {recs.recommendations.map((r) => (
                                    <div key={r.slug} style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: '10px 12px', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                                      <div style={{ flexShrink: 0, minWidth: '46px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-heavy)', color: r.probability >= 65 ? 'var(--tone-positive-fg)' : r.probability >= 45 ? 'var(--tone-notice-fg)' : 'var(--ws-fg-subtle)' }}>
                                          {r.probability}%
                                        </div>
                                        <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', textTransform: 'uppercase' }}>fit</div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                          <strong style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>{r.name}</strong>
                                          <Badge tone={r.kind === 'upsell' ? 'special' : 'info'} upper>
                                            {r.kind === 'upsell' ? 'Upsell' : 'Cross-sell'}
                                          </Badge>
                                          {r.price > 0 && <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>{zmw(r.price)}</span>}
                                        </div>
                                        {r.rationale && (
                                          <p style={{ margin: '3px 0 0', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', lineHeight: 'var(--lh-body)' }}>{r.rationale}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Loadable>
      </section>
    </div>
  );
}
