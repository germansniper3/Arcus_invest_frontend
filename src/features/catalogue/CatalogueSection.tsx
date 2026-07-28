import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { api, MAX_PRODUCT_IMAGE_SIZE } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Product } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';

const EMPTY_PRODUCT = { id: '', name: '', description: '', price: 0, stock: 0, image_url: '', specs: '', is_published: true };

interface Props {
  /**
   * Whether the catalogue is the section on screen.
   *
   * The component stays mounted either way and only its body is conditional,
   * because the modal below must never be torn down: Radix restores focus on
   * the open→closed transition, and unmounting the dialog means it never sees
   * that transition, dropping the keyboard user at <body>.
   */
  active: boolean;
}

export function CatalogueSection({ active }: Props) {
  const can = useCan();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      setProducts(await api.adminListProducts());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data');
    }
  }

  useEffect(() => {
    if (active) load();
  }, [active]);

  function openCreate() {
    setForm(EMPTY_PRODUCT);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setForm({ id: p.id, name: p.name, description: p.description, price: p.price, stock: p.stock, image_url: p.image_url || '', specs: p.specs || '', is_published: p.is_published });
    setShowModal(true);
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      toast.error('Image is too large. Maximum size is 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const url = await api.uploadProductImage(file);
      setForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (form.id) {
        await api.adminUpdateProduct(form.id, form);
        toast.success('Product updated');
      } else {
        await api.adminCreateProduct(form);
        toast.success('Product created');
      }
      setShowModal(false);
      setSelected(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await api.adminDeleteProduct(id);
      toast.success('Product deleted');
      setSelected(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  }

  return (
    <>
      {active && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <section className="data-section" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Product Catalog</h2>
              {can('products', 'create') && (
                <button onClick={openCreate} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                  <Plus size={14} /> New Product
                </button>
              )}
            </div>
            <div className="table" style={{ display: 'grid', gap: '10px' }}>
              {products.length === 0 ? (
                <p className="empty">No products added yet. Create your first product listing.</p>
              ) : (
                products.map((p) => (
                  <article
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{
                      padding: '14px 16px',
                      background: selected?.id === p.id ? '#f7f8f3' : '#fff',
                      border: '1px solid #dfe1da',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center'
                    }}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #dfe1da', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '6px', border: '1px solid #dfe1da', background: '#eef0ea', flexShrink: 0 }} role="img" aria-label={p.name} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                        <span style={{
                          fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', flexShrink: 0,
                          background: p.stock > 0 ? '#e8f2dc' : '#ffe2e2',
                          color: p.stock > 0 ? '#35520f' : '#a00'
                        }}>
                          {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '4px' }}>
                        {p.price > 0 ? `${p.price.toLocaleString()} ZMW` : 'Quote only'} · {p.is_published ? 'Published' : 'Draft'}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="data-section" style={{ marginTop: 0 }}>
            <h2>Product Details</h2>
            {!selected ? (
              <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                Select a product to view details, edit stock levels, or manage listing visibility.
              </div>
            ) : (
              <article className="panel" style={{ padding: '24px', background: '#fff', borderRadius: '8px', border: '1px solid #dfe1da' }}>
                {selected.image_url && (
                  <img src={selected.image_url} alt={selected.name} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '20px' }}>{selected.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#5a625d' }}>{selected.is_published ? '✓ Published on site' : '⏸ Draft — not public'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {can('products', 'update') && (
                      <button onClick={() => openEdit(selected)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                    )}
                    {can('products', 'delete') && (
                      <button onClick={() => remove(selected.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#111512', lineHeight: '1.6', marginBottom: '16px' }}>{selected.description}</p>

                {selected.specs && (
                  <div style={{ fontSize: '12px', color: '#c98745', background: '#faf8f2', padding: '10px 14px', borderRadius: '6px', border: '1px solid #eee5d4', marginBottom: '16px', fontFamily: 'monospace' }}>
                    {selected.specs}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #dfe1da', paddingTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>PRICE</span>
                    <strong style={{ fontSize: '18px', color: '#111512' }}>{selected.price > 0 ? `${selected.price.toLocaleString()} ZMW` : 'Quote Only'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>STOCK</span>
                    <strong style={{ fontSize: '18px', color: selected.stock > 0 ? '#35520f' : '#a00' }}>
                      {selected.stock > 0 ? `${selected.stock} units available` : 'Out of stock'}
                    </strong>
                  </div>
                </div>
              </article>
            )}
          </section>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Edit Product' : 'New Product'}
        footer={<button type="submit" form="product-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{form.id ? 'Save Changes' : 'Create Product'}</button>}
      >
        <form id="product-form" onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Product Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Description</label>
            <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '80px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Price (ZMW)</label>
              <NumberField required value={form.price} onChange={(price) => setForm({ ...form, price })} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#5a625d' }}>Stock Quantity</label>
              <NumberField required value={form.stock} onChange={(stock) => setForm({ ...form, stock })} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Product Image</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eef0ea', color: '#111512', border: '1px solid #d8dbd1', borderRadius: '6px', padding: '0 14px', minHeight: '40px', fontSize: '13px', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                <UploadCloud size={15} /> {uploading ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploading}
                  onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }}
                  style={{ display: 'none' }}
                />
              </label>
              {form.image_url && (
                <button type="button" onClick={() => setForm({ ...form, image_url: '' })} style={{ background: 'transparent', border: '1px solid #d8dbd1', color: '#5a625d', borderRadius: '6px', padding: '0 12px', minHeight: '40px', fontSize: '13px', cursor: 'pointer' }}>
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#8a908a', margin: '6px 0 4px' }}>PNG, JPG, WEBP or GIF up to 5 MB — or paste an image link below.</p>
            <input placeholder="https://example.com/product-photo.jpg" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            {form.image_url && (
              <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', maxHeight: '120px' }}>
                <img src={form.image_url} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: '120px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Specs (pipe-separated, e.g. Range: 60km | Motor: 350W)</label>
            <input value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} style={{ width: 'auto' }} />
            <label style={{ fontSize: '13px', color: '#5a625d' }}>Publish on website</label>
          </div>
        </form>
      </Modal>
    </>
  );
}
