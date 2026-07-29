import type { PermissionResource } from '../types';

/**
 * The back-office sections, and the URL slug each one answers to.
 *
 * The section used to be a local `activeTab` state value, which meant the whole
 * back office was a single URL: a section could not be linked or bookmarked,
 * the back button did nothing, and a refresh returned the user to Overview no
 * matter where they had been.
 *
 * This lives in its own module rather than in AdminPage because the extracted
 * feature components need the same list, and a file that exports both a
 * component and its constants breaks fast refresh.
 */
export const ADMIN_TABS = [
  'overview', 'pipeline', 'accounts', 'contracts', 'receivables', 'payables',
  'counter', 'approvals', 'enrollments', 'students', 'events', 'products',
  'gallery', 'users', 'audit',
] as const;

export type Tab = (typeof ADMIN_TABS)[number];

export const isTab = (v: string | undefined): v is Tab =>
  !!v && (ADMIN_TABS as readonly string[]).includes(v);

/**
 * Every resource the permission matrix can grant, in the order the roles editor
 * renders its rows.
 *
 * Declared as a `Record` keyed by the union rather than as a bare array,
 * because the array form had already drifted: it listed 17 of the 19 members of
 * `PermissionResource`, leaving `gallery` and `notifications` ungrantable
 * through the interface even though the server enforced both. An array cannot
 * notice that it is short. This shape cannot compile while it is — adding a
 * member to `PermissionResource` now fails the build here until it is given a
 * row, which is the only reason the gap went unnoticed for as long as it did.
 *
 * `Object.keys` preserves insertion order for non-numeric keys, so the grouping
 * below is the on-screen order.
 */
const RESOURCE_ROWS: Record<PermissionResource, true> = {
  opportunities: true, accounts: true, contracts: true, payments: true, quotes: true,
  enrollments: true, students: true, events: true, products: true, users: true,
  audit: true, email: true, metrics: true, roles: true, approvals: true,
  // Money out and walk-in selling. Both are separate resources from payments
  // and opportunities so a counter operator can be given the till without the
  // pipeline, and a bookkeeper the supplier ledger without either.
  expenses: true, counter_sales: true,
  // The two that were missing. `gallery` gates a section that is already in the
  // rail; `notifications` gates the bell, which AdminPage checks with
  // can('notifications') — so before this a custom role could never see it.
  gallery: true, notifications: true,
};

export const ALL_RESOURCES = Object.keys(RESOURCE_ROWS) as PermissionResource[];

/**
 * The permission each section requires. A section absent from this map (only
 * Overview) is available to anyone who can reach the back office at all.
 *
 * Used both to hide a section from the rail and to bounce a user who arrives at
 * its URL directly — now reachable, since the sections have URLs.
 */
export const TAB_RESOURCE: Partial<Record<Tab, PermissionResource>> = {
  pipeline: 'opportunities',
  accounts: 'accounts',
  contracts: 'contracts',
  enrollments: 'enrollments',
  students: 'students',
  events: 'events',
  products: 'products',
  users: 'users',
  audit: 'audit',
  gallery: 'gallery',
  // The debtor book follows payment access, matching the server's mapping.
  receivables: 'payments',
  // Money out and walk-in selling are their own resources, so a counter
  // operator can hold the till without the pipeline or the supplier ledger.
  payables: 'expenses',
  counter: 'counter_sales',
  approvals: 'approvals',
};
