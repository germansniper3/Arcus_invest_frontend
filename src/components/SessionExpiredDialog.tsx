import { FormEvent, useState } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from './Modal';

interface SessionExpiredDialogProps {
  open: boolean;
  /** Prefilled and read-only: this re-opens an existing session, it does not switch accounts. */
  email: string;
  onReauthenticate: (password: string) => Promise<void>;
  onSignOut: () => void;
}

/**
 * Sign-in that renders over whatever the user was doing.
 *
 * The point is what it does NOT do: it never navigates and never clears `user`.
 * Redirecting to /login, or dropping the user object, unmounts the whole admin
 * tree — and with it every open form, the contract File handle, and the ink on
 * the signature canvas, none of which can be serialised and restored. Because
 * the tree stays mounted throughout, work in progress survives an expiry with no
 * per-form draft handling at all.
 */
export function SessionExpiredDialog({ open, email, onReauthenticate, onSignOut }: SessionExpiredDialogProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onReauthenticate(password);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      // Dismissing would leave the user looking at a screen whose every action
      // fails, so the only ways out are signing back in or signing out.
      onClose={onSignOut}
      title="Your session expired"
      description="Sign in again to carry on. Nothing you were working on has been lost."
      width="min(420px, 100%)"
      destructive
      cancelLabel="Sign out"
      footer={
        <button type="submit" form="reauth-form" disabled={submitting || password === ''} className="primary"
          style={{ padding: '9px 16px', fontSize: 'var(--fs-300)', borderRadius: '6px', cursor: 'pointer' }}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
      }
    >
      <form id="reauth-form" onSubmit={submit} style={{ display: 'grid', gap: '12px' }}>
        <div style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}>
          Signed in as <strong style={{ color: 'var(--ws-fg)' }}>{email}</strong>
        </div>
        <div className="auth-field">
          <Lock size={18} />
          <input
            autoFocus
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div style={{ fontSize: 'var(--fs-300)', color: 'var(--tone-danger-fg)' }}>{error}</div>}
      </form>
    </Modal>
  );
}
