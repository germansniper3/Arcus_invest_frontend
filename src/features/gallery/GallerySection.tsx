import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, MAX_PRODUCT_IMAGE_SIZE, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { GalleryItem, GalleryCategory } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { Loadable } from '../../components/Loadable';
import { SectionAction } from '../../components/SectionAction';
import { Badge } from '../../components/Badge';
import { useRefreshSignal } from '../../lib/refresh';

const CATEGORIES: GalleryCategory[] = [
  'Electronics', 'Fabrication', 'Software', 'Prototyping', 'Installations', 'Other',
];

const EMPTY_ITEM = {
  id: '', title: '', caption: '', category: 'Electronics' as GalleryCategory,
  image_url: '', position: 0, is_published: true,
};

interface Props {
  /**
   * Whether the gallery is the section on screen.
   *
   * The component stays mounted either way and only its body is conditional,
   * because the modal below must never be torn down: Radix restores focus on
   * the open→closed transition, and unmounting the dialog means it never sees
   * that transition, dropping the keyboard user at <body>.
   */
  active: boolean;
}

export function GallerySection({ active }: Props) {
  const can = useCan();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.adminListGallery());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the gallery'));
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

  function openCreate() {
    setForm(EMPTY_ITEM);
    setShowModal(true);
  }

  function openEdit(item: GalleryItem) {
    setForm({
      id: item.id, title: item.title, caption: item.caption,
      category: item.category, image_url: item.image_url,
      position: item.position, is_published: item.is_published,
    });
    setShowModal(true);
  }

  async function uploadImage(file: File) {
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      toast.error('That image is over the 5 MB limit.');
      return;
    }
    setUploading(true);
    try {
      const url = await api.uploadGalleryImage(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to upload image'));
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url) {
      toast.error('Upload an image first');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title, caption: form.caption,
        category: form.category, image_url: form.image_url,
        position: Number(form.position) || 0, is_published: form.is_published,
      };
      if (form.id) {
        await api.adminUpdateGalleryItem(form.id, payload);
        toast.success('Gallery item updated');
      } else {
        await api.adminCreateGalleryItem(payload);
        toast.success('Gallery item added');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save gallery item'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: GalleryItem) {
    if (!confirm(`Remove "${item.title}" from the gallery?`)) return;
    try {
      await api.adminDeleteGalleryItem(item.id);
      toast.success('Gallery item removed');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove gallery item'));
    }
  }

  const label = { fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' };
  const field = { color: 'var(--ws-fg)', background: 'var(--ws-sunken)' };

  return (
    <>
      {active && (
        <section className="data-section" style={{ marginTop: 0 }}>
          {active && can('gallery', 'create') && (
            <SectionAction>
              <button onClick={openCreate} className="primary" style={{ minHeight: '40px' }}>
                <Plus size={16} /> New Gallery Item
              </button>
            </SectionAction>
          )}

          <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)', maxWidth: '68ch', lineHeight: 'var(--lh-body)' }}>
            Photos of Arcus's work, shown in the Gallery section of the public site. Lower position
            numbers appear first. Unpublished items stay hidden from visitors.
          </p>

          <Loadable
            loading={loading}
            empty={items.length === 0}
            emptyMessage="The public site is showing placeholder photos. Add a gallery item to replace them."
            emptyIcon={<ImageIcon size={26} strokeWidth={1.5} />}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
              {items.map((item) => (
                <article
                  key={item.id}
                  style={{
                    background: 'var(--ws-panel)', border: '1px solid var(--ws-border)',
                    borderRadius: '8px', overflow: 'hidden', display: 'grid', gap: 0,
                    opacity: item.is_published ? 1 : 0.55, minWidth: 0,
                  }}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block', background: 'var(--tone-neutral-bg)' }}
                  />
                  <div style={{ padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 'var(--fs-400)', fontWeight: 'var(--fw-medium)', color: 'var(--ws-fg)', minWidth: 0, lineHeight: 'var(--lh-snug)' }}>
                        {item.title}
                      </strong>
                      <Badge tone={item.is_published ? 'positive' : 'neutral'} upper style={{ flexShrink: 0 }}>
                        {item.is_published ? 'Live' : 'Draft'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-subtle)' }}>
                      {item.category} · position {item.position}
                    </div>
                    {item.caption && (
                      <p style={{ margin: 0, fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', lineHeight: 'var(--lh-body)' }}>
                        {item.caption}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                      {can('gallery', 'update') && (
                        <button
                          onClick={() => openEdit(item)}
                          style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 10px', fontSize: 'var(--fs-100)', color: 'var(--ws-fg)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      )}
                      {can('gallery', 'delete') && (
                        <button
                          onClick={() => remove(item)}
                          title="Remove"
                          style={{ background: 'var(--ws-panel)', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: 'var(--tone-danger-fg)', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Loadable>
        </section>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Gallery Item' : 'New Gallery Item'}
        footer={
          <button type="submit" form="gallery-form" disabled={saving || uploading} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
            {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add to Gallery'}
          </button>
        }
      >
        <form id="gallery-form" onSubmit={save} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <label style={label}>Photo</label>
            {form.image_url && (
              <img src={form.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--ws-border)', marginBottom: 'var(--space-2)', background: 'var(--tone-neutral-bg)' }} />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
              style={field}
            />
            <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)' }}>
              {uploading ? 'Uploading…' : 'PNG, JPG, WEBP or GIF · max 5 MB'}
            </p>
          </div>
          <div>
            <label style={label}>Title</label>
            <input required placeholder="e.g. Reflow oven — PCB assembly" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={field} />
          </div>
          <div>
            <label style={label}>Caption (optional)</label>
            <textarea placeholder="Short description of the work shown" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} style={{ ...field, minHeight: '60px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={label}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as GalleryCategory })} style={field}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Position (lower shows first)</label>
              <NumberField min="0" value={form.position} onChange={(position) => setForm({ ...form, position })} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} style={{ width: 'auto' }} />
            <label style={{ fontSize: 'var(--fs-300)', color: 'var(--ws-fg-muted)' }}>Show on the public site</label>
          </div>
        </form>
      </Modal>
    </>
  );
}
