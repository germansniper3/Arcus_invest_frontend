import { useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * A numeric input that does not prefill with `0`.
 *
 * Binding a raw number to `<input type="number">` renders "0" for an unset
 * field, so typing 25 into a fresh form produces "025" unless the user clears
 * it first. This was the single most-reported annoyance in the admin forms.
 */
interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  required?: boolean;
  title?: string;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

/** An unset or zero field shows nothing rather than a "0" the user must delete. */
function format(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return String(value);
}

/** Empty means zero, and a half-typed value never escapes as NaN. */
function parse(text: string): number {
  if (text.trim() === '') return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function NumberField({ value, onChange, style, ...rest }: NumberFieldProps) {
  // `null` means "not being edited, show the prop". Once the user types we keep
  // their literal text so that "0", "1.50" and a lone "-" survive a round trip
  // through Number(), which would otherwise rewrite them mid-keystroke.
  const [typed, setTyped] = useState<string | null>(null);

  // Deriving this during render rather than syncing in an effect means a parent
  // reset (closing a modal, editing a different record) is picked up
  // immediately: the typed text is only trusted while it still agrees
  // numerically with the value the parent is holding.
  const display = typed !== null && parse(typed) === value ? typed : format(value);

  return (
    <input
      type="number"
      value={display}
      onChange={(e) => {
        setTyped(e.target.value);
        onChange(parse(e.target.value));
      }}
      // Select on focus so typing overwrites an existing value instead of
      // appending to it — the other half of the "025" complaint.
      onFocus={(e) => e.target.select()}
      onBlur={() => setTyped(null)}
      style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', ...style }}
      {...rest}
    />
  );
}
