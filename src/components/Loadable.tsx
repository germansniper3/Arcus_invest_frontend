import type { ReactNode } from 'react';

interface Props {
  loading: boolean;
  /** True when there is genuinely nothing to show, once loading has finished. */
  empty: boolean;
  /** What to say when the list really is empty. */
  emptyMessage: ReactNode;
  children: ReactNode;
}

/**
 * Keeps an empty state from being shown before the answer has arrived.
 *
 * Lists here render straight from state that starts as `[]`, so during the
 * first fetch every one of them displayed its empty message — "No applications
 * filed yet", "No products added yet" — and then replaced it with the real
 * rows. On a fast connection that is a flicker. On a slow one the screen sits
 * there stating something false for a second or more, which reads as a broken
 * page rather than a loading one.
 *
 * Skeleton rows rather than a spinner: they occupy the space the content will,
 * so nothing jumps when it lands.
 */
export function Loadable({ loading, empty, emptyMessage, children }: Props) {
  if (loading) return <Skeleton />;
  if (empty) return <p className="empty">{emptyMessage}</p>;
  return <>{children}</>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'grid', gap: '10px' }} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}
