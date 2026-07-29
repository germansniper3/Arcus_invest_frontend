import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** The slot the admin shell renders above the section body, for the active
 *  section's own figures. */
export const SECTION_METRICS_SLOT_ID = 'section-metrics-slot';

/**
 * Renders a feature's own metric row into the shell, the way `SectionAction`
 * does for its header button.
 *
 * The shell used to choose between two metric rows on `activeTab`: the deal
 * pipeline's four forecast KPIs, or the generic hub counts. That conditional
 * was the last piece of section-specific rendering left in the shell, and it
 * was load-bearing in a worse way than it looked — it read `forecast`, so the
 * shell had to keep fetching and holding pipeline state even after everything
 * else about the pipeline had moved out. A section cannot own its data while
 * the shell is still rendering part of it.
 *
 * With this, the shell renders a slot and a list of which sections want the hub
 * counts, and a feature that has figures of its own contributes them itself.
 *
 * The slot is styled `display: contents` for the same reason the action slot
 * is: it must generate no box of its own, so an empty slot cannot introduce a
 * stray gap or count as a layout item. It sits inside `.work-main` so the
 * mobile rule that collapses inline `grid-template-columns` to one column
 * still reaches whatever a feature portals in.
 */
export function SectionMetrics({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // The slot is rendered by the shell in the same commit, so it exists by the
  // time effects run; looking it up during render would be too early.
  useEffect(() => {
    setHost(document.getElementById(SECTION_METRICS_SLOT_ID));
  }, []);

  return host ? createPortal(children, host) : null;
}
