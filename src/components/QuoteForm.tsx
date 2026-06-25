import { FormEvent, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Product } from '../types';

interface QuoteFormProps {
  preselectedService?: string;
}

export function QuoteForm({ preselectedService }: QuoteFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    service: 'PCB & electronics',
    budget_range: '',
    message: ''
  });

  useEffect(() => {
    // Load products dynamically
    api.listPublicProducts()
      .then((data) => {
        setProducts(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (preselectedService) {
      setForm((prev) => ({ ...prev, service: preselectedService }));
    }
  }, [preselectedService]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createQuote(form);
      toast.success('Quote request submitted successfully!');
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        service: preselectedService || 'PCB & electronics',
        budget_range: '',
        message: ''
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit quote request');
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
        <optgroup label="General Services">
          <option>PCB & electronics</option>
          <option>Mechanical fabrication</option>
          <option>Maintenance</option>
          <option>Software or automation</option>
        </optgroup>
        {products.length > 0 && (
          <optgroup label="Hardware Products">
            {products.map((p) => (
              <option key={p.id} value={`Product: ${p.name}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <input placeholder="Budget range" value={form.budget_range} onChange={(e) => setForm({ ...form, budget_range: e.target.value })} />
      <textarea required placeholder="Project details or special product customization notes..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <button className="primary" type="submit">Request quote</button>
    </form>
  );
}
