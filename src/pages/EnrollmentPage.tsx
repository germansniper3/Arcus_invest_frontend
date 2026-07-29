import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Layers, Rocket, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { ChatWidget } from '../components/ChatWidget';
import { Nav } from '../components/Nav';
import { SmartImage } from '../components/SmartImage';
import { api, errorMessage } from '../lib/api';
import { arcusImages } from '../lib/assets';

const tiers = [
  { name: 'Explorer', body: 'For learners still shaping a product idea or technical direction.' },
  { name: 'Builder', body: 'For students ready to prototype, test, and document their build.' },
  { name: 'Professional', body: 'For advanced projects and industry-ready engineering solutions.' }
];

const emptyForm = { full_name: '', email: '', phone: '', tier: 'Explorer', interests: '', project_idea: '' };

export function EnrollmentPage() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Anything typed beyond the default tier counts as work in progress.
  const isDirty = Object.entries(form).some(([k, v]) => k !== 'tier' && v.trim() !== '') || form.tier !== emptyForm.tier;

  function clearForm() {
    if (!confirm('Clear this application? Anything you have typed will be lost.')) return;
    setForm(emptyForm);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.createEnrollment(form);
      toast.success('Enrollment application submitted successfully!');
      setForm(emptyForm);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to submit enrollment'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="hub">
        <section className="hub-hero">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">Arcus Innovation Hub</p>
            <h1>Turn a technical idea into a mentored capstone build.</h1>
            <p>Enroll, get reviewed by admissions, receive a secure student portal invitation, then track your project from orientation through completion.</p>
          </motion.div>
          <SmartImage src={arcusImages.pcbService} alt="PCB design and electronics service" />
        </section>

        <section className="hub-flow">
          <article><GraduationCap /><span>Apply</span><p>Submit your interests and project direction.</p></article>
          <article><ShieldCheck /><span>Review</span><p>Admissions checks fit, tier, and next action.</p></article>
          <article><Layers /><span>Portal</span><p>Accepted students receive secure onboarding link.</p></article>
          <article><Rocket /><span>Milestones</span><p>Track checklists, updates, and verify orientation status.</p></article>
        </section>

        <section className="enroll-layout">
          <div className="tier-list">
            {tiers.map((tier) => (
              <button 
                type="button"
                key={tier.name} 
                className={form.tier === tier.name ? 'tier active' : 'tier'} 
                onClick={() => setForm({ ...form, tier: tier.name })}
              >
                <strong>{tier.name}</strong>
                <span>{tier.body}</span>
              </button>
            ))}
          </div>
          <form className="enrollment-form" onSubmit={submit}>
            <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Technical interests" value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
            <textarea required placeholder="Project idea or capstone direction" value={form.project_idea} onChange={(e) => setForm({ ...form, project_idea: e.target.value })} />
            <div className="enroll-actions">
              <button className="primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit enrollment'}
              </button>
              {isDirty && !submitting && (
                <button type="button" className="enroll-clear" onClick={clearForm}>
                  <X size={15} /> Clear form
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
      <ChatWidget />
    </>
  );
}
