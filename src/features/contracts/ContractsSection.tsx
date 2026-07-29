import { useEffect, useState } from 'react';
import { Plus, Trash2, Download, Clock, ScrollText, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatFileSize, MAX_SUBMISSION_FILE_SIZE, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import { useReportIfBlocked, NIL_UUID } from '../../lib/useReportIfBlocked';
import { zmw } from '../../lib/money';
import type { Contract, ContractStatus, Opportunity, DocumentVersion, DocumentAccessLog } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { Loadable } from '../../components/Loadable';
import { SectionAction } from '../../components/SectionAction';
import { Badge, type Tone } from '../../components/Badge';
import { useRefreshSignal } from '../../lib/refresh';

const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'sent', 'signed', 'active', 'expired'];

const CONTRACT_STATUS_TONES: Record<ContractStatus, Tone> = {
  draft: 'neutral',
  sent: 'info',
  signed: 'special',
  active: 'positive',
  expired: 'danger',
};

/** Days until renewal that count as "due soon". */
const RENEWAL_SOON_DAYS = 30;

function renewalState(iso?: string | null): 'none' | 'overdue' | 'soon' | 'ok' {
  if (!iso) return 'none';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= RENEWAL_SOON_DAYS) return 'soon';
  return 'ok';
}

/**
 * Only PDFs can carry a stamped signature. Contracts also accept .doc/.docx,
 * which have no page geometry to place one on; the server refuses those too.
 */
function isSignablePdf(ct: Contract): boolean {
  return ct.content_type.toLowerCase().includes('pdf') || ct.file_name.toLowerCase().endsWith('.pdf');
}

const EMPTY_CONTRACT = {
  id: '', account_name: '', opportunity_id: '', title: '',
  status: 'draft' as ContractStatus, value: 0, start_date: '', renewal_date: '', notes: '',
};

interface Props {
  /**
   * Whether contracts is the section on screen. The component stays mounted
   * either way so its dialog is never torn down — Radix restores focus on the
   * open→closed transition, which an unmounted dialog never emits.
   */
  active: boolean;
  /** Opens the signing flow, which the shell owns because the signature modal
   *  is shared with the deal pipeline. */
  onSign: (ct: Contract) => void;
  /** Bumped by the shell when a contract is signed elsewhere, so the list
   *  refetches without this component having to own the signing modal. */
  signedAt: number;
}

export function ContractsSection({ active, onSign, signedAt }: Props) {
  const can = useCan();
  const reportIfBlocked = useReportIfBlocked();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(EMPTY_CONTRACT);
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [accessLog, setAccessLog] = useState<DocumentAccessLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [nextContracts, nextOpportunities] = await Promise.all([
        api.adminListContracts(),
        api.adminListOpportunities(),
      ]);
      setContracts(nextContracts);
      setOpportunities(nextOpportunities);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load contracts'));
    } finally {
      setLoading(false);
    }
  }

  const refresh = useRefreshSignal();

  useEffect(() => {
    if (active) load();
    // `refresh` is the rail's Refresh Data signal — see lib/refresh. The
    // `active` guard means a bump refetches only the visible section.
  }, [active, refresh]);

  // A signature applied through the shared modal changes the status, so the
  // list has to catch up. Skipped on first mount, where load() already ran.
  useEffect(() => {
    if (active && signedAt) {
      void api.adminListContracts().then(setContracts).catch(() => { /* the toast already reported it */ });
    }
  }, [signedAt]);

  /** Revision history and read log for a saved contract. Both are best-effort:
   *  a contract stays fully editable if either lookup fails. */
  async function loadHistory(id: string) {
    setHistoryLoading(true);
    try {
      const [nextVersions, nextAccess] = await Promise.all([
        api.adminContractVersions(id),
        api.adminContractAccessLog(id),
      ]);
      setVersions(nextVersions);
      setAccessLog(nextAccess);
    } catch {
      setVersions([]);
      setAccessLog([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_CONTRACT);
    setFile(null);
    setVersions([]);
    setAccessLog([]);
    setShowModal(true);
  }

  function openEdit(ct: Contract) {
    setForm({
      id: ct.id, account_name: ct.account_name, opportunity_id: ct.opportunity_id ?? '',
      title: ct.title, status: ct.status, value: ct.value,
      start_date: ct.start_date ? ct.start_date.slice(0, 10) : '',
      renewal_date: ct.renewal_date ? ct.renewal_date.slice(0, 10) : '',
      notes: ct.notes,
    });
    setFile(null);
    setVersions([]);
    setAccessLog([]);
    void loadHistory(ct.id);
    setShowModal(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (file && file.size > MAX_SUBMISSION_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 15 MB.');
      return;
    }
    setSaving(true);
    const payload = {
      account_name: form.account_name,
      opportunity_id: form.opportunity_id || NIL_UUID,
      title: form.title,
      status: form.status,
      value: Number(form.value) || 0,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      renewal_date: form.renewal_date ? new Date(form.renewal_date).toISOString() : null,
      clear_renewal: !form.renewal_date,
      notes: form.notes,
    };
    try {
      let id = form.id;
      if (id) {
        await api.adminUpdateContract(id, payload);
      } else {
        const created = await api.adminCreateContract(payload);
        id = created.id;
      }
      if (file) await api.uploadContractFile(id, file);
      toast.success(form.id ? 'Contract updated' : 'Contract created');
      setShowModal(false);
      setContracts(await api.adminListContracts());
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save contract'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this contract? This cannot be undone.')) return;
    try {
      await api.adminDeleteContract(id);
      toast.success('Contract deleted');
      setShowModal(false);
      setContracts(await api.adminListContracts());
    } catch (err) {
      if (!reportIfBlocked(err)) toast.error(errorMessage(err, 'Failed to delete contract'));
    }
  }

  async function download(ct: Contract) {
    setDownloadingId(ct.id);
    try {
      await api.downloadContract(ct.id, ct.file_name || 'contract');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to download contract'));
    } finally {
      setDownloadingId(null);
    }
  }

  const label = { fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' };
  const field = { color: 'var(--ws-fg)', background: 'var(--ws-sunken)' };

  return (
    <>
      {active && (
        <section className="data-section" style={{ marginTop: 0 }}>
          {can('contracts', 'create') && (
            <SectionAction>
              <button onClick={openCreate} className="primary" style={{ minHeight: '40px' }}>
                <Plus size={16} /> New Contract
              </button>
            </SectionAction>
          )}

          <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '72ch', lineHeight: 'var(--lh-body)' }}>
            Store agreements, track renewals, and download signed documents. Renewals due within{' '}
            {RENEWAL_SOON_DAYS} days are flagged.
          </p>

          <Loadable
            loading={loading}
            empty={contracts.length === 0}
            emptyMessage="Add your first contract."
            emptyIcon={<ScrollText size={26} strokeWidth={1.5} />}
          >
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {contracts.map((ct) => {
                const rs = renewalState(ct.renewal_date);
                // The left edge carries the renewal state, so a repository can
                // be scanned for what is about to lapse without reading it.
                const edge = rs === 'overdue' ? 'var(--tone-danger-fg)'
                  : rs === 'soon' ? 'var(--copper)'
                  : 'var(--ws-border-strong)';
                return (
                  <article
                    key={ct.id}
                    onClick={() => openEdit(ct)}
                    style={{ padding: 'var(--space-3)', background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderLeft: `4px solid ${edge}`, borderRadius: '8px', cursor: 'pointer', display: 'grid', gap: 'var(--space-2)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-medium)', color: 'var(--ws-fg)', lineHeight: 'var(--lh-snug)' }}>{ct.title}</strong>
                        {ct.account_name && (
                          <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', marginTop: '2px' }}>{ct.account_name}</div>
                        )}
                      </div>
                      <Badge tone={CONTRACT_STATUS_TONES[ct.status]} upper style={{ flexShrink: 0 }}>{ct.status}</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', alignItems: 'center' }}>
                      {ct.value > 0 && (
                        <strong style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg)' }}>{zmw(ct.value)}</strong>
                      )}
                      {ct.renewal_date && (
                        <span style={{ color: rs === 'overdue' ? 'var(--tone-danger-fg)' : rs === 'soon' ? 'var(--copper)' : 'var(--ws-fg-muted)', fontWeight: rs === 'ok' || rs === 'none' ? 'var(--fw-regular)' : 'var(--fw-strong)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <Clock size={12} /> Renews {new Date(ct.renewal_date).toLocaleDateString()}
                          {rs === 'overdue' ? ' · overdue' : rs === 'soon' ? ' · due soon' : ''}
                        </span>
                      )}
                      {ct.has_file ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); download(ct); }}
                          disabled={downloadingId === ct.id}
                          style={{ background: 'var(--ws-canvas)', color: 'var(--ws-fg)', minHeight: '28px', fontSize: 'var(--fs-100)', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                        >
                          <Download size={11} /> {downloadingId === ct.id ? 'Downloading…' : ct.file_name || 'Download'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--ws-fg-faint)' }}>No file attached</span>
                      )}
                      {/* Signing is offered only where it can actually succeed:
                          a sent contract with a PDF attached. The server
                          enforces the same rules regardless. */}
                      {ct.status === 'sent' && ct.has_file && isSignablePdf(ct) && can('contracts', 'update') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSign(ct); }}
                          style={{ background: 'var(--ws-accent)', color: '#fff', minHeight: '28px', fontSize: 'var(--fs-100)', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                        >
                          <ScrollText size={11} /> Sign
                        </button>
                      )}
                      {ct.status === 'signed' && (
                        <span style={{ color: 'var(--tone-positive-fg)', fontWeight: 'var(--fw-strong)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <CheckCircle2 size={12} /> Signed
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Loadable>
        </section>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Contract' : 'New Contract'}
        footer={
          <>
            {form.id && can('contracts', 'delete') && (
              <button type="button" onClick={() => remove(form.id)} style={{ background: 'var(--ws-panel)', border: '1px solid #e2b4b4', color: 'var(--tone-danger-fg)', borderRadius: '8px', padding: '0 16px', minHeight: '44px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            {can('contracts', form.id ? 'update' : 'create') && (
              <button type="submit" form="contract-form" disabled={saving} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
                {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Create Contract'}
              </button>
            )}
          </>
        }
      >
        <form id="contract-form" onSubmit={save} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <label style={label}>Contract Title</label>
            <input required placeholder="e.g. Managed Services Agreement 2026" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={field} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Account / Company</label>
              <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} style={field} />
            </div>
            <div>
              <label style={label}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })} style={{ ...field, textTransform: 'capitalize' }}>
                {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={label}>Linked Deal (optional)</label>
            <select value={form.opportunity_id} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })} style={field}>
              <option value="">None</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.account_name ? ` — ${o.account_name}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Value (ZMW)</label>
              <NumberField min="0" value={form.value} onChange={(value) => setForm({ ...form, value })} />
            </div>
            <div>
              <label style={label}>Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={field} />
            </div>
            <div>
              <label style={label}>Renewal Date</label>
              <input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} style={field} />
            </div>
          </div>
          <div>
            <label style={label}>Document (PDF / DOC / DOCX, max 15 MB)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ ...field, border: '1px solid var(--ws-border-strong)', padding: '8px' }}
            />
            {form.id && !file && (
              <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: '4px 0 0' }}>
                Leave this empty to keep the current file. Choosing one adds a version. The file it replaces stays downloadable below.
              </p>
            )}
          </div>
          <div>
            <label style={label}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...field, minHeight: '60px' }} />
          </div>
        </form>

        {/* Version history and read log — only meaningful for a saved contract */}
        {form.id && (
          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--ws-border)', paddingTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <History size={16} color="var(--ws-accent)" />
              <h3 style={{ margin: 0, fontSize: 'var(--fs-400)' }}>Document History</h3>
              <span style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)' }}>
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </span>
            </div>

            {historyLoading ? (
              <p style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)', margin: 0 }}>Loading history…</p>
            ) : versions.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-subtle)', margin: 0, lineHeight: 'var(--lh-body)' }}>
                No document uploaded yet. Every upload is kept as a version, so replacing a file never destroys the one before it.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {versions.map((v) => (
                  <div key={v.id} style={{ background: 'var(--ws-sunken)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: '9px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <div style={{ fontSize: 'var(--fs-300)', minWidth: 0 }}>
                        <strong style={{ color: 'var(--ws-fg)' }}>v{v.version}</strong>
                        <span style={{ color: 'var(--ws-fg-muted)' }}> · {v.file_name || 'document'} · {formatFileSize(v.size)}</span>
                        {/* Versions come back newest-first, so the head is the live one. */}
                        {v.id === versions[0]?.id && (
                          <Badge tone="positive" upper style={{ marginLeft: 'var(--space-2)' }}>Current</Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => api.downloadContractVersion(form.id, v.id, v.file_name || 'contract').catch((err) => toast.error(errorMessage(err, 'Download failed')))}
                        style={{ background: 'var(--ws-panel)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 10px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Download
                      </button>
                    </div>
                    <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', marginTop: 'var(--space-1)' }}>
                      {new Date(v.created_at).toLocaleString()}{v.uploaded_by ? ` · ${v.uploaded_by}` : ''}
                    </div>
                    {/* The hash is what proves this file was not swapped, so show
                        it in full rather than truncating it to look tidy. */}
                    {v.file_hash && (
                      <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', marginTop: '3px', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>
                        SHA256 {v.file_hash}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {accessLog.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', fontWeight: 'var(--fw-strong)', marginBottom: 'var(--space-2)' }}>
                  Who has downloaded this
                </div>
                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  {accessLog.slice(0, 10).map((a) => (
                    <div key={a.id} style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)' }}>
                      {new Date(a.created_at).toLocaleString()} · <strong style={{ color: 'var(--ws-fg)' }}>{a.actor_name || 'unknown'}</strong>
                      {a.ip ? ` · ${a.ip}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
