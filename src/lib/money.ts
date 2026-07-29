/**
 * Kwacha formatting.
 *
 * Two forms, because the two halves of the product genuinely want different
 * precision. Deal-side figures — pipeline value, forecast, receivables — are
 * negotiated in whole kwacha and a trailing `.00` on every one of them is noise
 * down a column. Counter-side figures are a till total handed to a customer,
 * where the toes matter and a rounded figure would disagree with the change.
 *
 * Both are used with `font-variant-numeric: tabular-nums`, applied at the
 * workspace root in styles.css, so columns of them align.
 */

/** Whole kwacha. Deal pipeline, forecasts, receivables, payables. */
export const zmw = (n: number) => `${Math.round(n).toLocaleString()} ZMW`;

/** Two decimal places. Counter sales, receipts, till reconciliation. */
export const zmw2 = (n: number) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZMW`;
