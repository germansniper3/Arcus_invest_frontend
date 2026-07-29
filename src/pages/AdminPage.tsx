import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LogOut, RefreshCcw, UserPlus, Calendar, CheckSquare, Settings, GraduationCap,
  Target, Building2, ScrollText, History, Users, Wallet, Image as ImageIcon, ShieldCheck,
  Banknote, Store, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Contract, PermissionResource } from '../types';
import { SignContractModal } from '../components/SignContractModal';
import { NotificationBell } from '../components/NotificationBell';
import { CatalogueSection } from '../features/catalogue/CatalogueSection';
import { EventsSection } from '../features/events/EventsSection';
import { IntakeSection } from '../features/intake/IntakeSection';
import { PayablesSection } from '../features/payables/PayablesSection';
import { PurchasingSection } from '../features/purchasing/PurchasingSection';
import { CounterSection } from '../features/counter/CounterSection';
import { SECTION_ACTION_SLOT_ID } from '../components/SectionAction';
import { SECTION_METRICS_SLOT_ID } from '../components/SectionMetrics';
import { isTab, TAB_RESOURCE, type Tab } from '../lib/adminSections';
import { RefreshContext } from '../lib/refresh';
import { AuditSection } from '../features/audit/AuditSection';
import { GallerySection } from '../features/gallery/GallerySection';
import { ReceivablesSection } from '../features/receivables/ReceivablesSection';
import { ContractsSection } from '../features/contracts/ContractsSection';
import { ApprovalsSection } from '../features/approvals/ApprovalsSection';
import { AccountsSection } from '../features/accounts/AccountsSection';
import { UsersSection } from '../features/users/UsersSection';
import { OverviewSection } from '../features/overview/OverviewSection';
import { StudentsSection } from '../features/students/StudentsSection';
import { PipelineSection } from '../features/pipeline/PipelineSection';

/**
 * The sections whose headline figures are the hub counts.
 *
 * Overview only. These three numbers used to appear on seven sections, which
 * was inherited from an exclusion list where the fallthrough case was "show
 * them", so a section got them by not opting out. On the sections that count
 * the thing they are already listing, the figure restates the list directly
 * beneath it — "Total Enrollments 12" above twelve enrollments — and on
 * receivables, approvals and products it was unrelated to the screen entirely.
 *
 * It was worst on a phone, where the row collapses to one column: three stacked
 * cards are 486px, and with the header above them 647px of a 812px screen went
 * to chrome before any content began.
 *
 * A section that wants figures of its own contributes them through
 * `SectionMetrics`, as the deal pipeline does with its forecast. Kept as a list
 * rather than an equality check so adding a section back is a one-word edit and
 * the policy stays stated in one place.
 */
const HUB_METRIC_TABS: Tab[] = ['overview'];

export function AdminPage() {
  const { user, logout } = useAuth();

  // The section now lives in the URL rather than in state, so /admin/pipeline
  // is linkable, the back button walks the sections, and a refresh returns to
  // where the user was.
  const navigate = useNavigate();
  const { section } = useParams<{ section: string }>();
  const activeTab: Tab = isTab(section) ? section : 'overview';
  /**
   * `replace` for moves the user did not ask for — a normalised bad slug, or a
   * fallback after a permission check fails. Pushing those would leave a
   * history entry that sends the back button straight back to the same
   * rejection.
   */
  const setActiveTab = useCallback(
    (tab: Tab, replace = false) => navigate(`/admin/${tab}`, { replace }),
    [navigate],
  );
  // An unrecognised slug is normalised rather than rendered as Overview under a
  // URL that says otherwise.
  useEffect(() => {
    if (!isTab(section)) navigate('/admin/overview', { replace: true });
  }, [section, navigate]);
  // The hub counts behind the metric row — the only data the shell still owns.
  const [metrics, setMetrics] = useState({ enrollments: 0, open_quotes: 0, students: 0, active_events: 0 });

  // Effective permissions from /auth/me. Absent (older token/response) falls back
  // to the previous role check so the portal never renders empty.
  const perms = user?.permissions;
  const can = (res: PermissionResource, act: 'read' | 'create' | 'update' | 'delete' = 'read') => {
    if (!perms) return user?.role === 'super_admin' || user?.role === 'admin';
    return perms[res]?.[act] === true;
  };

  // The audit trail owns its own data now; the shell only needs to know
  // whether to offer the section at all.
  const canViewAudit = can('audit');

  /**
   * The one signature dialog, kept here rather than inside a feature so there
   * is exactly one of it mounted. ContractsSection opens it through `onSign`;
   * the counter below is bumped on success so that list refetches. Two
   * signature modals mounted at once would be two focus traps competing.
   */
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [contractSignedAt, setContractSignedAt] = useState(0);

  /** The hub counts behind the shell's metric row. Every section fetches its
   *  own data, so this is all the shell itself still loads. */
  async function loadData() {
    try {
      setMetrics(await api.adminMetrics());
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load admin data'));
    }
  }

  /**
   * The rail's Refresh Data signal.
   *
   * `loadData` above is the shell's whole data footprint, and the counts it
   * fetches render on Overview alone — so once the sections were extracted,
   * Refresh Data did nothing observable on fourteen of the fifteen. Sections
   * subscribe to this counter through `useRefreshSignal` and include it in the
   * dependencies of the `if (active) load()` effect they all share, so a bump
   * refetches whichever section is actually on screen.
   */
  const [refreshSignal, setRefreshSignal] = useState(0);
  function refreshAll() {
    // The hub counts are the shell's own; the signal covers everything else.
    if (HUB_METRIC_TABS.includes(activeTab)) loadData();
    setRefreshSignal((n) => n + 1);
  }

  /**
   * Re-triggers the section enter animation.
   *
   * A CSS animation only replays if something about it changes, and the usual
   * lever — a `key` on the wrapper — is unavailable here: the sections are
   * deliberately kept mounted so their Radix dialogs survive, and re-keying
   * would tear all fifteen down on every tab change. So the wrapper alternates
   * between two identical keyframe sets instead; changing `animation-name`
   * restarts the animation without touching the tree. See `.section-swap`.
   */
  const [swap, setSwap] = useState(0);
  useEffect(() => { setSwap((n) => n + 1); }, [activeTab]);

  // If the signed-in user has no access to the active section — their role
  // changed mid-session, or they followed a link to a section they cannot see —
  // fall back to Overview rather than repeatedly hitting a 403.
  useEffect(() => {
    const needed = TAB_RESOURCE[activeTab];
    if (needed && !can(needed)) {
      setActiveTab('overview', true);
      return;
    }
    // Only fetch the counts on a section that displays them. This used to run on
    // every section change for a row that now renders on one of them, which also
    // meant a role without `metrics` was shown "Failed to load admin data" each
    // time it moved between sections that were never going to show a figure.
    if (HUB_METRIC_TABS.includes(activeTab)) loadData();
  }, [activeTab, user]);

  return (
    <RefreshContext.Provider value={refreshSignal}>
    <main className="workspace">
      <aside className="rail">
        <div className="rail-head">
          <strong className="rail-title">Arcus Admin Portal</strong>
          <span className="rail-user">{user?.full_name}</span>
        </div>

        <nav className="rail-nav">
          {(([
            ['overview', 'Overview', Settings, true],
            ['pipeline', 'Sales Pipeline', Target, can('opportunities')],
            ['accounts', 'Accounts & VSI', Building2, can('accounts')],
            ['contracts', 'Contracts', ScrollText, can('contracts')],
            ['receivables', 'Receivables', Wallet, can('payments')],
            ['payables', 'Payables', Banknote, can('expenses')],
            ['purchasing', 'Purchasing', Truck, can('purchase_orders')],
            ['counter', 'Counter', Store, can('counter_sales')],
            ['approvals', 'Approvals', ShieldCheck, can('approvals')],
            ['enrollments', 'Enrollments', UserPlus, can('enrollments')],
            ['students', 'Students Portal', GraduationCap, can('students')],
            ['events', 'Events Manager', Calendar, can('events')],
            ['products', 'Products', CheckSquare, can('products')],
            ['gallery', 'Gallery', ImageIcon, can('gallery')],
            ['users', 'Users & Email', Users, can('users')],
            ['audit', 'Audit Log', History, canViewAudit],
          ] as [Tab, string, typeof Settings, boolean][])
            .filter(([, , , allowed]) => allowed))
            .map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'active' : ''}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="rail-actions">
          {/* Gated on the permission the inbox routes actually require, so a
              custom role without it never sees a bell that would 403. */}
          {can('notifications', 'read') && (
            <NotificationBell
              onNavigate={(entityType) => {
                // entity_type mirrors the server's resource names, which are
                // also the tab keys for the sections that have one.
                const tab = entityType as Tab;
                const resource = TAB_RESOURCE[tab];
                if (resource && can(resource)) setActiveTab(tab);
              }}
            />
          )}
          <button onClick={refreshAll}><RefreshCcw size={17} /> Refresh Data</button>
          <button onClick={logout}><LogOut size={17} /> Logout</button>
        </div>
      </aside>

      <section className="work-main">
        <div className="workspace-head">
          <div>
            <p className="eyebrow" style={{ textTransform: 'uppercase' }}>Management Area</p>
            <h1>
              {activeTab === 'overview' && 'Arcus Investments Dashboard'}
              {activeTab === 'pipeline' && 'Sales Pipeline & Forecast'}
              {activeTab === 'accounts' && 'Accounts & Vertical Sales Index'}
              {activeTab === 'contracts' && 'Contract Repository'}
              {activeTab === 'receivables' && 'Receivables'}
              {activeTab === 'payables' && 'Payables & Cash Position'}
              {activeTab === 'purchasing' && 'Purchase Orders & Landed Cost'}
              {activeTab === 'counter' && 'Counter'}
              {activeTab === 'approvals' && 'Approvals'}
              {activeTab === 'enrollments' && 'Innovation Hub Intake'}
              {activeTab === 'students' && 'Student Capstone Milestones'}
              {activeTab === 'events' && 'Public Programs & Events'}
              {activeTab === 'products' && 'Product Inventory Manager'}
              {activeTab === 'audit' && 'Audit Trail'}
              {activeTab === 'users' && 'Users & Email Delivery'}
              {activeTab === 'gallery' && 'Work Gallery'}
            </h1>
          </div>
          {/* Extracted features portal their header action in here. `display:
              contents` keeps the slot from counting as a flex item, which would
              otherwise break the space-between layout when it is empty. */}
          <div id={SECTION_ACTION_SLOT_ID} style={{ display: 'contents' }} />
        </div>

        {/* Metrics row. A section with figures of its own contributes them
            through the metrics portal; the rest take the hub counts or none.
            An allow-list rather than the exclusion list it replaces, so a
            section added later cannot inherit the hub counts by forgetting
            to opt out of them. */}
        <div id={SECTION_METRICS_SLOT_ID} style={{ display: 'contents' }} />
        {HUB_METRIC_TABS.includes(activeTab) && (
          <div className="metric-row">
            <article><span>{metrics.enrollments}</span><p>Total Enrollments</p></article>
            <article><span>{metrics.students}</span><p>Active Students</p></article>
            <article><span>{metrics.active_events}</span><p>Published Events</p></article>
          </div>
        )}

        {/* Every section body lives inside this wrapper so the enter animation
            has one thing to play on. It is a plain block box in a plain block
            container, so it changes no layout; see `.section-swap`. */}
        <div className="section-swap" data-swap={swap % 2}>
        {/* Overview Tab */}
        <OverviewSection active={activeTab === 'overview'} />

        {/* Enrollments Tab */}
        {/* Hub intake, the invite link and its modal; see features/intake. */}
        <IntakeSection active={activeTab === 'enrollments'} />

        {/* The supplier ledger and the combined cash position. */}
        <PayablesSection active={activeTab === 'payables'} />

        {/* The buy side: ordering, goods receipt and landed cost. Separate from
            payables because committing to an order, taking delivery and being
            invoiced are three events at three different times. */}
        <PurchasingSection active={activeTab === 'purchasing'} />

        {/* Walk-in selling. Not the deal pipeline — see models.CounterSale. */}
        <CounterSection active={activeTab === 'counter'} />

        {/* Student directory, capstone tracking and the submission gates; see features/students. */}
        <StudentsSection active={activeTab === 'students'} />

        {/* Events, its reservations and both its modals; see features/events. */}
        <EventsSection active={activeTab === 'events'} />

        {/* Products Tab */}
        {/* Catalogue owns its own state, fetching and modal; see features/catalogue. */}
        <CatalogueSection active={activeTab === 'products'} />

        {/* The deal board, forecast, the opportunity modal and the document
            generator; see features/pipeline. */}
        <PipelineSection active={activeTab === 'pipeline'} />

        {/* Accounts & VSI Tab */}
        <AccountsSection active={activeTab === 'accounts'} />

        <ApprovalsSection active={activeTab === 'approvals'} />

        <ReceivablesSection active={activeTab === 'receivables'} />

        <ContractsSection
          active={activeTab === 'contracts'}
          onSign={setSigningContract}
          signedAt={contractSignedAt}
        />

        <AuditSection active={activeTab === 'audit'} />

        <GallerySection active={activeTab === 'gallery'} />

        <UsersSection active={activeTab === 'users'} />
        </div>
      </section>

      <SignContractModal
        open={signingContract !== null}
        contract={signingContract}
        onClose={() => setSigningContract(null)}
        onSigned={() => setContractSignedAt(Date.now())}
      />

    </main>
    </RefreshContext.Provider>
  );
}
