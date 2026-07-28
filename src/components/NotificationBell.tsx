import { useCallback, useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { api } from '../lib/api';
import type { EmailMode, Notification } from '../types';

/**
 * The notification inbox and its unread badge.
 *
 * Polls rather than holding a socket open: the sweep that raises these runs
 * every 15 minutes server-side, so a socket would idle almost all of the time
 * for a feed that changes a few times a day.
 */
const POLL_INTERVAL_MS = 60_000;

const EMAIL_MODES: { value: EmailMode; label: string; hint: string }[] = [
  { value: 'digest', label: 'A digest', hint: 'One message covering everything outstanding' },
  { value: 'per_event', label: 'Every event', hint: 'A message per item — expect volume' },
  { value: 'none', label: 'No email', hint: 'In-app only' },
];

interface NotificationBellProps {
  /**
   * Where to send the user when they click a notification. The admin area's
   * sections are local state rather than routes, so the bell cannot navigate on
   * its own — the page that owns the tab state supplies this.
   */
  onNavigate?: (entityType: string) => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [emailMode, setEmailMode] = useState<EmailMode>('digest');
  const [loading, setLoading] = useState(false);

  // A failed poll is left silent: a toast every minute because the API is
  // briefly unreachable would be worse than a stale badge.
  const refresh = useCallback(async () => {
    try {
      const res = await api.adminNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* keep whatever was last known */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    api.adminNotificationPreference()
      .then((p) => setEmailMode(p.email_mode))
      .catch(() => { /* the default shown is the server's default too */ });
  }, [open]);

  async function markRead(id: string) {
    // Optimistic: the badge should respond immediately, and a failed mark-read
    // is corrected by the next poll.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.adminMarkNotificationRead(id);
    } catch {
      void refresh();
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await api.adminMarkAllNotificationsRead();
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not mark all read');
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(mode: EmailMode) {
    const previous = emailMode;
    setEmailMode(mode);
    try {
      await api.adminSetNotificationPreference(mode);
      toast.success('Email preference saved');
    } catch (err: any) {
      setEmailMode(previous);
      toast.error(err.message || 'Could not save the preference');
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ position: 'relative' }}>
        <Bell size={17} /> Notifications
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            style={{ marginLeft: '6px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: '#a00', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'Nothing unread'}
        width="min(620px, 100%)"
        footer={
          items.some((n) => !n.read_at) ? (
            <button type="button" onClick={markAllRead} disabled={loading} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
              <Check size={15} /> {loading ? 'Marking…' : 'Mark all read'}
            </button>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>
            Nothing needs you right now. Renewals, unreviewed submissions, pending extensions and stalled deals show up here.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '8px', maxHeight: '46vh', overflowY: 'auto' }}>
            {items.map((n) => (
              <div
                key={n.id}
                // Clickable only when the parent can actually act on it —
                // a pointer cursor on something inert is a worse lie than no
                // affordance at all.
                onClick={onNavigate ? () => { onNavigate(n.entity_type); if (!n.read_at) void markRead(n.id); setOpen(false); } : undefined}
                role={onNavigate ? 'button' : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onKeyDown={onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(n.entity_type); setOpen(false); } } : undefined}
                style={{ background: n.read_at ? '#f7f8f3' : '#fff', border: `1px solid ${n.read_at ? '#e2e4dd' : '#c8d3b4'}`, borderLeft: `3px solid ${n.read_at ? '#e2e4dd' : '#5f7c29'}`, borderRadius: '6px', padding: '9px 11px', cursor: onNavigate ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: n.read_at ? 400 : 700, color: '#111512' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '2px' }}>{n.body}</div>
                    <div style={{ fontSize: '11px', color: '#8a908a', marginTop: '3px' }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {!n.read_at && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); void markRead(n.id); }} title="Mark read" style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '4px', padding: '5px 8px', fontSize: '11px', color: '#111512', cursor: 'pointer', flexShrink: 0 }}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid #e2e4dd', paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#5a625d', fontWeight: 700, marginBottom: '6px' }}>Email me</div>
          <div style={{ display: 'grid', gap: '6px' }}>
            {EMAIL_MODES.map((m) => (
              <label key={m.value} style={{ display: 'flex', alignItems: 'start', gap: '8px', fontSize: '13px', color: '#111512', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="email-mode"
                  checked={emailMode === m.value}
                  onChange={() => changeMode(m.value)}
                  style={{ width: 'auto', marginTop: '3px' }}
                />
                <span>
                  {m.label}
                  <span style={{ display: 'block', fontSize: '11px', color: '#8a908a' }}>{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
