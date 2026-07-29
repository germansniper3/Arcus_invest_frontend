import { useEffect, useState } from 'react';
import { Target, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { QuoteRequest } from '../../types';
import { Loadable } from '../../components/Loadable';
import { Badge, type Tone } from '../../components/Badge';
import { useRefreshSignal } from '../../lib/refresh';

/**
 * Lead lifecycle. The sixth colour map in the original AdminPage, and the last
 * one to be folded into the shared tone system — a lead that is won and a
 * contract that is active now read as the same kind of good.
 */
const QUOTE_STATUS_TONES: Record<string, Tone> = {
  new: 'notice',
  contacted: 'neutral',
  proposal: 'info',
  closed_won: 'positive',
  closed_lost: 'danger',
  converted: 'special',
};

const LEAD_STATUSES = [
  { value: 'new', label: 'New / Untouched' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal', label: 'Proposal Sent' },
  { value: 'closed_won', label: 'Closed / Won' },
  { value: 'closed_lost', label: 'Closed / Lost' },
];

interface Props {
  /** Whether the dashboard is the section on screen. */
  active: boolean;
}

export function OverviewSection({ active }: Props) {
  const can = useCan();
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [selected, setSelected] = useState<QuoteRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Permission-guarded so a restricted role never fires a request the
      // server will refuse.
      setQuotes(can('quotes') ? await api.quotes() : []);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load quote requests'));
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

  function select(item: QuoteRequest) {
    setSelected(item);
    setNotes(item.admin_notes || '');
  }

  async function updateStatus(item: QuoteRequest, status: string) {
    try {
      const updated = await api.updateQuote(item.id, { status });
      setQuotes((rows) => rows.map((row) => (row.id === item.id ? updated : row)));
      if (selected?.id === item.id) setSelected(updated);
      toast.success(`Quote status updated to ${status}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update quote status'));
    }
  }

  async function saveNotes(item: QuoteRequest) {
    try {
      const updated = await api.updateQuote(item.id, { admin_notes: notes });
      setQuotes((rows) => rows.map((row) => (row.id === item.id ? updated : row)));
      setSelected(updated);
      toast.success('Notes saved successfully');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save notes'));
    }
  }

  async function convert(item: QuoteRequest) {
    if (item.status === 'converted') {
      toast.info('This lead has already been converted.');
      return;
    }
    if (!confirm(`Convert "${item.name}" into a pipeline opportunity?`)) return;
    try {
      await api.convertQuoteToOpportunity(item.id);
      toast.success('Lead converted. Opening the pipeline.');
      setSelected(null);
      navigate('/admin/pipeline');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to convert lead'));
    }
  }

  if (!active) return null;

  const key: React.CSSProperties = {
    fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', display: 'block',
    fontWeight: 'var(--fw-strong)', textTransform: 'uppercase', letterSpacing: '0.04em',
  };
  const value: React.CSSProperties = { fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Quote &amp; Contact Requests</h2>
        <div className="table" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <Loadable
            loading={loading}
            empty={quotes.length === 0}
            emptyMessage="No contact queries yet."
            emptyIcon={<Inbox size={26} strokeWidth={1.5} />}
          >
            {quotes.map((item) => (
              <article
                key={item.id}
                onClick={() => select(item)}
                style={{
                  padding: 'var(--space-3)',
                  background: selected?.id === item.id ? 'var(--ws-sunken)' : 'var(--ws-panel)',
                  border: `1px solid ${selected?.id === item.id ? 'var(--ws-border-strong)' : 'var(--ws-border)'}`,
                  borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-medium)', color: 'var(--ws-fg)' }}>{item.name}</strong>
                    <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', marginTop: '2px' }}>
                      {item.company || 'Private Inquiry'}
                    </div>
                  </div>
                  <Badge tone={QUOTE_STATUS_TONES[item.status] ?? 'neutral'} upper style={{ flexShrink: 0 }}>
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                  Service: <strong style={{ color: 'var(--ws-fg)' }}>{item.service}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.message}
                </p>
              </article>
            ))}
          </Loadable>
        </div>
      </section>

      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Lead Details &amp; CRM Tracking</h2>
        {!selected ? (
          <div className="empty">
            <Target size={26} strokeWidth={1.5} />
            <span>Select a contact request to view details, update customer status, and log contact notes.</span>
          </div>
        ) : (
          <article className="panel" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', borderBottom: '1px solid var(--ws-border)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-500)' }}>{selected.name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--ws-fg-muted)', fontSize: 'var(--fs-300)' }}>
                  Company: <strong style={{ color: 'var(--ws-fg)' }}>{selected.company || 'None'}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
                <label style={key}>Lead status</label>
                <select
                  value={selected.status}
                  disabled={!can('quotes', 'update')}
                  onChange={(e) => updateStatus(selected, e.target.value)}
                  style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)', padding: '4px 8px', fontSize: 'var(--fs-200)', borderRadius: '4px' }}
                >
                  {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <span style={key}>Email address</span>
                <a href={`mailto:${selected.email}`} style={{ color: 'var(--copper)', fontSize: 'var(--fs-300)', textDecoration: 'underline' }}>{selected.email}</a>
              </div>
              <div>
                <span style={key}>Phone number</span>
                <span style={value}>{selected.phone || 'Not provided'}</span>
              </div>
              <div>
                <span style={key}>Requested service</span>
                <span style={{ ...value, fontWeight: 'var(--fw-medium)' }}>{selected.service}</span>
              </div>
              <div>
                <span style={key}>Estimated budget</span>
                <span style={{ ...value, fontWeight: 'var(--fw-medium)' }}>{selected.budget_range || 'N/A'}</span>
              </div>
            </div>

            <div style={{ background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)', padding: 'var(--space-3)', borderRadius: '6px', marginBottom: 'var(--space-4)' }}>
              <span style={{ ...key, marginBottom: 'var(--space-2)' }}>Customer message</span>
              <p style={{ margin: 0, fontSize: 'var(--fs-300)', color: 'var(--ws-fg)', whiteSpace: 'pre-line', lineHeight: 'var(--lh-body)' }}>{selected.message}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: 'var(--space-3)' }}>
              <span style={{ ...key, marginBottom: 'var(--space-2)' }}>Admin CRM notes &amp; next actions</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log contact attempts, meeting summaries, pricing proposals, or instructions on how to reach back…"
                style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)', minHeight: '100px', fontSize: 'var(--fs-300)', width: '100%', padding: '10px', borderRadius: '4px', marginBottom: 'var(--space-3)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  onClick={() => saveNotes(selected)}
                  disabled={!can('quotes', 'update')}
                  className="primary"
                  style={{ minHeight: '36px', fontSize: 'var(--fs-200)', padding: '0 16px' }}
                >
                  Save CRM Notes
                </button>
                <button
                  onClick={() => convert(selected)}
                  disabled={selected.status === 'converted' || !can('quotes', 'create')}
                  style={{ minHeight: '36px', fontSize: 'var(--fs-200)', padding: '0 16px', background: selected.status === 'converted' ? 'var(--ws-canvas)' : 'var(--ws-fg)', color: selected.status === 'converted' ? 'var(--ws-fg-subtle)' : '#fff', border: 0, borderRadius: '8px', cursor: selected.status === 'converted' ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  <Target size={14} /> {selected.status === 'converted' ? 'Converted' : 'Convert to opportunity'}
                </button>
              </div>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}
