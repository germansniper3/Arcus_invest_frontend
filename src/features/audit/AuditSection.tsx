import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import type { AuditLog } from '../../types';
import { Badge, type Tone } from '../../components/Badge';
import { Loadable } from '../../components/Loadable';
import { useRefreshSignal } from '../../lib/refresh';

/**
 * Audit-trail action verbs, toned by what the verb did rather than by which
 * subsystem raised it: anything that created value reads positive, anything
 * destructive reads danger.
 */
const AUDIT_ACTION_TONE: Record<string, Tone> = {
  create: 'positive',
  update: 'info',
  delete: 'danger',
  convert: 'special',
  upload: 'notice',
  approve: 'active',
  log: 'neutral',
  invite: 'info',
  broadcast: 'earth',
  other: 'neutral',
};
const auditActionTone = (a: string): Tone => AUDIT_ACTION_TONE[a] ?? 'neutral';

interface Props {
  /** Whether the audit trail is the section on screen. */
  active: boolean;
}

export function AuditSection({ active }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setLogs(await api.adminAuditLogs());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the audit trail'));
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
      <p style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}>
        Immutable trail of admin changes: who did what, and when. Showing the {logs.length} most
        recent {logs.length === 1 ? 'entry' : 'entries'}.
      </p>

      <Loadable
        loading={loading}
        empty={logs.length === 0}
        emptyMessage="Every change made in the portal is recorded here."
        emptyIcon={<History size={26} strokeWidth={1.5} />}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {logs.map((a) => (
            <article
              key={a.id}
              style={{
                padding: '12px 14px', background: 'var(--ws-panel)',
                border: '1px solid var(--ws-border)', borderRadius: '8px',
                display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap',
              }}
            >
              {/* Fixed width so the verbs line up down the log and the eye can
                  scan the column rather than re-reading it. */}
              <Badge tone={auditActionTone(a.action)} upper style={{ flexShrink: 0, minWidth: '74px' }}>
                {a.action}
              </Badge>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* The actor is what someone reading an audit log is scanning
                    for, so it carries the weight; everything qualifying it
                    steps down in colour rather than in size. */}
                <div style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>
                  <strong style={{ fontWeight: 'var(--fw-medium)' }}>{a.actor_name || 'Unknown'}</strong>
                  {a.actor_role && <span style={{ color: 'var(--ws-fg-subtle)' }}> ({a.actor_role})</span>}
                  <span style={{ color: 'var(--ws-fg-muted)' }}>
                    {' · '}{a.entity}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {a.method} {a.path} → {a.status}
                </div>
              </div>

              <span style={{ flexShrink: 0, fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>
                {new Date(a.created_at).toLocaleString()}
              </span>
            </article>
          ))}
        </div>
      </Loadable>
    </section>
  );
}
