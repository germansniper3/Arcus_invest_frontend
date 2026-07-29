import type { CSSProperties, ReactNode } from 'react';

/**
 * The ten status tones defined in `styles.css`.
 *
 * A tone is chosen for what a value *means*, not for which table it happens to
 * appear in. Before this there were five separate `Record<string, {bg, fg}>`
 * maps in AdminPage — stage, grade, segment, contract status and audit action —
 * each with its own hand-picked pastels, so "contract active", "audit approve"
 * and "growth segment" were three different greens for no reason anyone could
 * state, and restyling everything that means trouble meant visiting all five.
 */
export type Tone =
  | 'neutral'   /* no opinion — draft, standard, a log entry */
  | 'positive'  /* the good terminal state — created, active, won */
  | 'active'    /* in progress and healthy — approved, growth */
  | 'info'      /* administrative, not a judgement — sent, updated */
  | 'notice'    /* worth a look, not yet wrong — uploaded, gold */
  | 'danger'    /* deleted, expired, overdue */
  | 'special'   /* elevated or privileged — super admin, signed, strategic */
  | 'earth'     /* bronze, broadcast */
  | 'slate'     /* silver */
  | 'cool';     /* platinum */

export function Badge({
  tone = 'neutral',
  upper = false,
  style,
  children,
}: {
  tone?: Tone;
  /** Uppercase the label. For category codes (grade, segment, an audit verb),
   *  where the text is a token rather than prose. */
  upper?: boolean;
  /** Escape hatch for the one or two badges that need a fixed width to keep a
   *  column of them aligned. Colour and size come from the tone; do not pass
   *  those here. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className="badge"
      data-tone={tone}
      style={upper ? { textTransform: 'uppercase', ...style } : style}
    >
      {children}
    </span>
  );
}
