import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** The slot the admin shell renders in its header for the active section. */
export const SECTION_ACTION_SLOT_ID = 'section-action-slot';

/**
 * Renders a feature's primary action into the shell's header.
 *
 * The header action for a section belongs to that section — it opens the
 * section's modal and is gated on the section's permission — but it has to
 * paint inside `.workspace-head`, which the shell owns. A portal lets the
 * feature keep the button while the markup lands where it always did.
 *
 * The slot element is styled `display: contents` so it generates no box of its
 * own. `.workspace-head` is a `space-between` flex row, and an empty wrapper
 * would otherwise count as a third item and push the title off its edge.
 */
export function SectionAction({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // The slot is rendered by the shell in the same commit, so it exists by the
  // time effects run; looking it up during render would be too early.
  useEffect(() => {
    setHost(document.getElementById(SECTION_ACTION_SLOT_ID));
  }, []);

  return host ? createPortal(children, host) : null;
}
