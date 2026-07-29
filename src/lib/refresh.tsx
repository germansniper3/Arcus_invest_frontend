import { createContext, useContext } from 'react';

/**
 * The shell's "Refresh Data" signal.
 *
 * Before this, the rail button called `loadData()`, which — once every section
 * was extracted and given its own fetching — only reloaded the four hub metric
 * counts. Those appear on Overview alone, so on fourteen of the fifteen
 * sections the button did nothing observable. A control that visibly does
 * nothing is worse than no control: the user cannot tell the difference between
 * "refreshed, nothing changed" and "broken".
 *
 * Rather than scope the label down to what it happened to do, the signal is
 * made real. Every section already loads through exactly the same shape:
 *
 *     useEffect(() => { if (active) load(); }, [active]);
 *
 * so subscribing is adding this hook's value to that dependency array. The
 * value is a counter rather than a boolean or a timestamp: a boolean cannot
 * represent two refreshes in a row, and `Date.now()` can repeat inside a single
 * millisecond.
 *
 * Sections stay mounted and only their body is conditional on `active`, so a
 * bump re-runs all fifteen effects and the `if (active)` guard means exactly
 * one of them fetches. The user gets the section they are looking at, not
 * fifteen simultaneous requests.
 *
 * A context rather than a prop because `active` is already threaded through
 * fifteen call sites in AdminPage and a second one would double that for no
 * gain — and because nothing between the shell and a section needs to see it.
 */
export const RefreshContext = createContext(0);

/**
 * Add the return value to a section's fetch effect dependencies:
 *
 *     const refresh = useRefreshSignal();
 *     useEffect(() => { if (active) load(); }, [active, refresh]);
 */
export function useRefreshSignal(): number {
  return useContext(RefreshContext);
}
