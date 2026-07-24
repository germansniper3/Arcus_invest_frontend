import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Nav } from '../components/Nav';
import { ChatWidget } from '../components/ChatWidget';

interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  image_url?: string;
  is_published: boolean;
}

export function GreenEngineeringPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [resCount, setResCount] = useState<number>(0);
  const [resForm, setResForm] = useState({ fullName: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await api.listPublicEvents();
        setEvents(data);
      } catch (err: any) {
        toast.error('Failed to load events: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  async function handleEventClick(event: Event) {
    setSelectedEvent(event);
    setResForm({ fullName: '', email: '', phone: '', notes: '' });
    try {
      const data = await api.getPublicEvent(event.slug);
      setResCount(data.reservations_count);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    setSubmitting(true);
    try {
      await api.reserveEvent(selectedEvent.id, {
        full_name: resForm.fullName,
        email: resForm.email,
        phone: resForm.phone,
        notes: resForm.notes,
      });
      toast.success('Seat reserved successfully!');
      // Refresh count
      const data = await api.getPublicEvent(selectedEvent.slug);
      setResCount(data.reservations_count);
      setResForm({ fullName: '', email: '', phone: '', notes: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to reserve seat');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="hub" style={{ minHeight: '100vh', background: '#0e120f' }}>
        <section className="hub-hero" style={{ paddingBottom: '40px' }}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">Green Engineering & Public Programs 2026</p>
            <h1>Join Arcus for Hands-on Innovation.</h1>
            <p>Participate in technical talks, workshops, and community engineering showcases. Reserve your seat for our upcoming programs below.</p>
          </motion.div>
        </section>

        <section style={{ padding: '0 clamp(20px, 5vw, 72px) 80px' }}>
          {loading ? (
            <div style={{ color: '#b8b7ad', textAlign: 'center', padding: '40px' }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={{ color: '#b8b7ad', textAlign: 'center', padding: '40px', background: '#121714', borderRadius: '8px', border: '1px solid var(--line)' }}>
              No public events scheduled at the moment. Please check back later!
            </div>
          ) : !selectedEvent ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {events.map((event) => (
                <motion.article 
                  whileHover={{ y: -6 }} 
                  key={event.id} 
                  style={{
                    background: '#121714', 
                    border: '1px solid var(--line)', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    cursor: 'pointer'
                  }}
                  onClick={() => handleEventClick(event)}
                >
                  <div style={{ height: '200px', background: 'linear-gradient(135deg, #1d2621, #0e120f)', position: 'relative' }}>
                    {event.image_url ? (
                      <img src={event.image_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="image-fallback" style={{ width: '100%', height: '100%' }} />
                    )}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(11,13,12,0.85)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--line)' }}>
                      <span className="eyebrow" style={{ fontSize: '10px' }}>Upcoming</span>
                    </div>
                  </div>
                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px', color: '#fff' }}>{event.title}</h3>
                      <p style={{ fontSize: '14px', color: '#b8b7ad', marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--line)', paddingTop: '16px', fontSize: '13px', color: '#ede8d8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={15} style={{ color: 'var(--accent)' }} />
                        <span>{new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={15} style={{ color: 'var(--accent)' }} />
                        <span>{event.location}</span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', padding: '40px' }}>
              <button 
                onClick={() => setSelectedEvent(null)} 
                style={{ background: 'transparent', border: '0', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '800', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
              >
                <ArrowLeft size={16} /> Back to events
              </button>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '48px' }}>
                <div>
                  <h2 style={{ fontSize: '36px', color: '#fff', fontWeight: '800', marginBottom: '16px' }}>{selectedEvent.title}</h2>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBlock: '24px', fontSize: '14px', color: '#ede8d8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                      <Calendar size={16} style={{ color: 'var(--accent)' }} />
                      <span>{new Date(selectedEvent.date).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                      <MapPin size={16} style={{ color: 'var(--accent)' }} />
                      <span>{selectedEvent.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                      <Users size={16} style={{ color: 'var(--accent)' }} />
                      <span>{resCount} / {selectedEvent.capacity || 'Unlimited'} reserved</span>
                    </div>
                  </div>

                  <p style={{ color: '#b8b7ad', fontSize: '16px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>{selectedEvent.description}</p>
                </div>

                <div style={{ background: '#0e120f', border: '1px solid var(--line)', borderRadius: '8px', padding: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>Reserve Your Seat</h3>
                  <p style={{ fontSize: '13px', color: '#b8b7ad', marginBottom: '20px' }}>Fill in your contact information below. Seating is limited and reserved on a first-come, first-served basis.</p>
                  
                  {selectedEvent.capacity > 0 && resCount >= selectedEvent.capacity ? (
                    <div style={{ background: 'rgba(201,135,69,0.1)', border: '1px solid var(--copper)', color: 'var(--copper)', padding: '16px', borderRadius: '6px', fontSize: '14px', textAlign: 'center' }}>
                      This event is currently at full capacity.
                    </div>
                  ) : (
                    <form onSubmit={handleReserve} style={{ display: 'grid', gap: '12px' }}>
                      <div>
                        <input 
                          required 
                          placeholder="Full Name" 
                          value={resForm.fullName} 
                          onChange={(e) => setResForm({ ...resForm, fullName: e.target.value })} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', color: '#fff' }}
                        />
                      </div>
                      <div>
                        <input 
                          required 
                          type="email" 
                          placeholder="Email Address" 
                          value={resForm.email} 
                          onChange={(e) => setResForm({ ...resForm, email: e.target.value })} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', color: '#fff' }}
                        />
                      </div>
                      <div>
                        <input 
                          placeholder="Phone / WhatsApp Number" 
                          value={resForm.phone} 
                          onChange={(e) => setResForm({ ...resForm, phone: e.target.value })} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', color: '#fff' }}
                        />
                      </div>
                      <div>
                        <textarea 
                          placeholder="Optional: Dietary preferences, accessibility requirements, or questions." 
                          value={resForm.notes} 
                          onChange={(e) => setResForm({ ...resForm, notes: e.target.value })} 
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', color: '#fff', minHeight: '80px' }}
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submitting} 
                        className="primary" 
                        style={{ minHeight: '44px', width: '100%', marginTop: '8px' }}
                      >
                        {submitting ? 'Reserving...' : 'Confirm Reservation'} <Send size={16} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </section>
      </main>
      <ChatWidget />
    </>
  );
}
