import type { OpportunityStage, OpportunityGrade, ActivityType, PaymentMethod } from '../types';
import type { Tone } from '../components/Badge';

/**
 * The vocabulary of the deal side — stages, grades, segments, committee roles,
 * activity types and payment methods.
 *
 * Shared rather than owned by the pipeline because the accounts index grades and
 * segments the same records, and contracts and receivables name the same payment
 * methods. Two copies of a taxonomy drift, and a "gold" account that is gold in
 * one table and silver in another is worse than no grading at all.
 */

export const STAGE_ORDER: OpportunityStage[] = [
  'prospecting', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

/** Deal grades, ordered least to most valuable. */
export const GRADE_STYLES: Record<OpportunityGrade, { tone: Tone; label: string }> = {
  bronze: { tone: 'earth', label: 'Bronze' },
  silver: { tone: 'slate', label: 'Silver' },
  gold: { tone: 'notice', label: 'Gold' },
  platinum: { tone: 'cool', label: 'Platinum' },
};

/** Account-based-marketing segments. */
export const SEGMENT_STYLES: Record<string, { tone: Tone; label: string }> = {
  strategic: { tone: 'special', label: 'Strategic' },
  growth: { tone: 'active', label: 'Growth' },
  standard: { tone: 'neutral', label: 'Standard' },
};

/** Buying-committee roles — who inside the account actually decides. */
export const CONTACT_ROLES: { value: string; label: string }[] = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion', label: 'Champion' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'technical', label: 'Technical' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'other', label: 'Other' },
];

/** Engagement-log entry types (deal activity timeline). */
export const ACTIVITY_TYPES: { value: ActivityType; label: string; color: string }[] = [
  { value: 'call', label: 'Call', color: 'var(--tone-info-fg)' },
  { value: 'meeting', label: 'Meeting', color: 'var(--tone-special-fg)' },
  { value: 'email', label: 'Email', color: 'var(--tone-active-fg)' },
  { value: 'note', label: 'Note', color: 'var(--ws-fg-muted)' },
  { value: 'task', label: 'Task', color: 'var(--tone-notice-fg)' },
  { value: 'other', label: 'Other', color: 'var(--ws-fg-subtle)' },
];

/** Falls back to "note", the neutral entry, for an unrecognised type. */
export const ACTIVITY_STYLE = (t: ActivityType) =>
  ACTIVITY_TYPES.find((a) => a.value === t) ?? ACTIVITY_TYPES[3];

/** Payment methods for recording receipts against an invoiced deal. */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_LABEL = (m: string) =>
  PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
