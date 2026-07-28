import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type { Event, Reservation } from '../../types';
import { Modal } from '../../components/Modal';
import { NumberField } from '../../components/NumberField';
import { Loadable } from '../../components/Loadable';

const EMPTY_EVENT = { id: '', title: '', description: '', date: '', location: '', capacity: 100, is_published: true, image_url: '' };

interface Props {
  /** See CatalogueSection: the body is conditional, the modals never unmount. */
  active: boolean;
}

export function EventsSection({ active }: Props) {
  const can = useCan();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventReservations, setEventReservations] = useState<Reservation[]>([]);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT);
  const [showEventModal, setShowEventModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '' });
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setEvents(await api.adminListEvents());
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) load();
  }, [active]);

  async function handleEventSelect(event: Event) {
    setSelectedEvent(event);
    setEventReservations([]);
    try {
      const res = await api.adminListReservations(event.id);
      setEventReservations(res);
    } catch (err: any) {
      console.error(err);
    }
  }

  function openCreateEventModal() {
    setEventForm(EMPTY_EVENT);
    setShowEventModal(true);
  }

  function openEditEventModal(event: Event) {
    setEventForm({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date ? event.date.substring(0, 16) : '',
      location: event.location,
      capacity: event.capacity,
      is_published: event.is_published,
      image_url: event.image_url || ''
    });
    setShowEventModal(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (eventForm.id) {
        await api.adminUpdateEvent(eventForm.id, eventForm);
        toast.success('Event updated successfully');
      } else {
        await api.adminCreateEvent(eventForm);
        toast.success('Event created successfully');
      }
      setShowEventModal(false);
      setSelectedEvent(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save event');
    }
  }

  async function approveReservation(rid: string) {
    try {
      const updated = await api.approveReservation(rid);
      setEventReservations((prev) => prev.map((r) => r.id === rid ? updated : r));
      toast.success('Seat confirmed for attendee!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve reservation');
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Are you sure you want to delete this event? All reservation records will be lost.')) return;
    try {
      await api.adminDeleteEvent(id);
      toast.success('Event deleted');
      setSelectedEvent(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    }
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      const res = await api.adminBroadcast(selectedEvent.id, broadcastForm.subject, broadcastForm.message);
      if (res.status === 'sent') {
        toast.success(`Broadcast emailed to ${res.recipients} confirmed attendee(s).`);
      } else {
        toast.warning(res.message || 'Broadcast stored, but no email was sent.');
      }
      setShowBroadcastModal(false);
      setBroadcastForm({ subject: '', message: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send broadcast');
    }
  }

  return (
    <>
      {active && (
        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '24px', alignItems: 'start' }}>
          <section className="data-section" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Public Events</h2>
              {can('events', 'create') && (
                <button onClick={openCreateEventModal} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                  <Plus size={14} /> New Event
                </button>
              )}
            </div>
            <div className="table">
              <Loadable loading={loading} empty={events.length === 0} emptyMessage="Create your first event.">
                {events.map((event) => (
                <article
                  key={event.id}
                  onClick={() => handleEventSelect(event)}
                  style={{
                    padding: '16px',
                    background: selectedEvent?.id === event.id ? '#f7f8f3' : '#fff',
                    border: '1px solid #dfe1da',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '15px' }}>{event.title}</strong>
                    <span className="status" style={{ background: event.is_published ? '#e8f2dc' : '#f0f0f0', color: event.is_published ? '#35520f !important' : '#555 !important' }}>
                      {event.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#5a625d', marginTop: '6px' }}>
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                    <span>{event.location}</span>
                  </div>
                </article>
                ))}
              </Loadable>
            </div>
          </section>

          <section className="data-section" style={{ marginTop: 0 }}>
            <h2>Event Administration</h2>
            {!selectedEvent ? (
              <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                Select an event to manage details, view attendee registrations, or send broadcast communications.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '24px' }}>
                {/* Event details block */}
                <article className="panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedEvent.title}</h3>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {can('events', 'update') && (
                        <button onClick={() => openEditEventModal(selectedEvent)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                      )}
                      {can('events', 'delete') && (
                        <button onClick={() => deleteEvent(selectedEvent.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', marginBlock: '8px', color: '#5a625d' }}>{selectedEvent.description}</p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#c98745', borderTop: '1px solid #eef0ea', paddingTop: '10px' }}>
                    <span>Date: {new Date(selectedEvent.date).toLocaleString()}</span>
                    <span>Location: {selectedEvent.location}</span>
                  </div>
                </article>

                {/* Attendee reservations */}
                <article className="panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Attendee Registrations ({eventReservations.length})</h3>
                    {can('events', 'create') && (
                      <button onClick={() => setShowBroadcastModal(true)} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }}>
                        <Mail size={14} /> Send Broadcast
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                    {eventReservations.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#5a625d', textAlign: 'center', padding: '12px' }}>No registrations yet.</p>
                    ) : (
                      eventReservations.map((res) => (
                        <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f8f3', padding: '10px 12px', borderRadius: '6px', border: `1px solid ${res.status === 'confirmed' ? '#c5dfa6' : '#d8dbd1'}`, fontSize: '12px', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: '13px' }}>{res.full_name}</strong>
                            <div style={{ color: '#5a625d', marginTop: '2px' }}>{res.email} · {res.phone || 'No phone'}</div>
                            {res.notes && <div style={{ fontSize: '11px', color: '#c98745', marginTop: '4px' }}>Note: "{res.notes}"</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{
                              fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold',
                              background: res.status === 'confirmed' ? '#e8f2dc' : '#fff3e0',
                              color: res.status === 'confirmed' ? '#35520f' : '#c98745'
                            }}>
                              {res.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                            </span>
                            {res.status === 'pending' && can('events', 'update') && (
                              <button
                                onClick={() => approveReservation(res.id)}
                                style={{ background: 'var(--accent)', color: '#11170e', border: 0, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Approve Seat
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      <Modal
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
        title={eventForm.id ? 'Edit Event' : 'Create Event'}
        footer={<button type="submit" form="event-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{eventForm.id ? 'Update Event' : 'Create Event'}</button>}
      >
        <form id="event-form" onSubmit={saveEvent} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Event Title</label>
            <input required value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Description</label>
            <textarea required value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '80px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Date & Time</label>
            <input required type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Location</label>
            <input required value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Seating Capacity</label>
            <NumberField required value={eventForm.capacity} onChange={(capacity) => setEventForm({ ...eventForm, capacity })} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Event image link (optional)</label>
            <input placeholder="https://example.com/event-banner.jpg" value={eventForm.image_url} onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
            {eventForm.image_url && (
              <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', maxHeight: '100px' }}>
                <img src={eventForm.image_url} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: '100px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={eventForm.is_published} onChange={(e) => setEventForm({ ...eventForm, is_published: e.target.checked })} style={{ width: 'auto' }} />
            <label style={{ fontSize: '13px', color: '#5a625d' }}>Publish Event immediately</label>
          </div>
        </form>
      </Modal>

      {/* Broadcast Modal */}
      <Modal
        open={showBroadcastModal && !!selectedEvent}
        onClose={() => setShowBroadcastModal(false)}
        title={`Broadcast to ${selectedEvent?.title ?? ''} attendees`}
        description={`This will dispatch an announcement/update email to all ${eventReservations.filter((r) => r.status === 'confirmed').length} confirmed seat reservation(s).`}
        footer={<button type="submit" form="broadcast-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>Send Broadcast <Send size={14} /></button>}
      >
        <form id="broadcast-form" onSubmit={sendBroadcast} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Subject</label>
            <input required placeholder="Important update regarding..." value={broadcastForm.subject} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#5a625d' }}>Message Body</label>
            <textarea required placeholder="Write your announcement details here..." value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '120px' }} />
          </div>
        </form>
      </Modal>
    </>
  );
}
