import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CircuitBoard, Hammer, Cpu, ShieldCheck, Calendar, MapPin, Wrench, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatWidget } from '../components/ChatWidget';
import { Nav } from '../components/Nav';
import { QuoteForm } from '../components/QuoteForm';
import { SmartImage } from '../components/SmartImage';
import { api } from '../lib/api';
import { arcusImages } from '../lib/assets';
import type { Event, Product } from '../types';

export function PublicSite() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [workshopSlide, setWorkshopSlide] = useState(1); // Slide 1: Electronics, Slide 2: Mechanical

  useEffect(() => {
    api.listPublicEvents().then((events) => setUpcomingEvents(events.slice(0, 3))).catch(() => {});
    api.listPublicProducts().then(setProducts).catch(() => {});
  }, []);

  return (
    <>
      <Nav />
      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <img src={arcusImages.pcbWorkbench} alt="PCB Workbench" className="hero-image" />
          <div className="hero-shade" />
          <motion.div 
            className="hero-copy" 
            initial={{ opacity: 0, y: 24 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7 }}
          >
            <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
              Mining Equipment | Construction Equipment | Electronics | Electrical | Mechanical | Software | Many More
            </p>
            <h1>ARCUS INVESTMENTS</h1>
            <p style={{ fontSize: '20px', color: '#ede8d8', lineHeight: '1.6', marginBottom: '32px' }}>
              Whether you're building from scratch, optimizing existing designs, or troubleshooting faults — we’re your partner.
            </p>
            <div className="hero-actions" style={{ display: 'flex', gap: '14px' }}>
              <a href="#quote" className="primary" style={{ padding: '0 24px' }}>Get A Quote <ArrowRight size={18} /></a>
              <a href="#about" className="secondary" style={{ padding: '0 24px' }}>Learn More</a>
              <Link to="/arcus-innovation-hub-enrollment-manager" className="secondary" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>Innovation Hub</Link>
            </div>
          </motion.div>
        </section>

        {/* ABOUT US SECTION */}
        <section id="about" className="band" style={{ background: '#0e120f', borderBottom: '1px solid var(--line)' }}>
          <div className="section-head" style={{ marginBottom: '48px' }}>
            <div>
              <p className="eyebrow">ABOUT US</p>
              <h2 style={{ color: '#fff' }}>Arcus Investments is a Zambian-owned engineering firm dedicated to bringing innovative products to life.</h2>
            </div>
            <div>
              <p style={{ fontSize: '16px', lineHeight: '1.8' }}>
                We provide complete, locally accessible maintenance, development and manufacturing services for a wide range of industries.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div style={{ background: '#121714', border: '1px solid var(--line)', padding: '32px', borderRadius: '12px' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}><Layers size={32} /></div>
              <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>Electronic Maintenance, Design & PCB Manufacturing</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>From single-layer boards to complex multi-layer designs, we ensure precision and reliability in all printed circuit assemblies.</p>
            </div>

            <div style={{ background: '#121714', border: '1px solid var(--line)', padding: '32px', borderRadius: '12px' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}><Hammer size={32} /></div>
              <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>Mechanical Engineering</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>Full maintenance, design, prototyping, installation and analysis for specialized systems, enclosures, components, and integrated machinery.</p>
            </div>

            <div style={{ background: '#121714', border: '1px solid var(--line)', padding: '32px', borderRadius: '12px' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}><Cpu size={32} /></div>
              <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>End-to-End Product Development</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>We manage the entire journey from initial concept and prototyping to full-scale production, industrial design, and lifetime support.</p>
            </div>
          </div>

          <div style={{ textAlign: 'center', background: '#131b15', border: '1px solid var(--line)', padding: '24px', borderRadius: '12px' }}>
            <p style={{ color: 'var(--accent)', fontWeight: '600', margin: 0 }}>
              Partner with us for an affordable, streamlined, and collaborative approach to maintaining and creating high-quality products.
            </p>
          </div>
        </section>

        {/* PRODUCTS & SERVICES SECTION */}
        <section id="products-services" className="band" style={{ background: '#0b0d0c' }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">PRODUCTS & SERVICES</p>
              <h2 style={{ color: '#fff' }}>Showcasing our proprietary systems and technical electronics capabilities.</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '32px', marginBottom: '56px' }}>
            {/* Custom PCB Card (service, not a database-backed product) */}
            <div style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: '620px' }}>
              <div style={{ height: '240px', overflow: 'hidden' }}>
                <img src={arcusImages.pcbService} alt="Custom PCB design" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ color: '#fff', fontSize: '24px', marginBottom: '12px' }}>CUSTOM PCB DESIGN & ELECTRONICS SOLUTIONS</h3>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
                    We design and develop custom printed circuit boards (PCBs) and complete electronic solutions tailored to your product requirements. From concept to production-ready hardware, we turn ideas into reliable, high-performance electronic systems.
                  </p>
                </div>
                <div style={{ display: 'flex' }}>
                  <a href="#quote" onClick={() => setSelectedService('PCB & electronics')} className="primary" style={{ fontSize: '13px', minHeight: '38px', padding: '0 16px' }}>
                    Get A Quote
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC PRODUCTS FROM DATABASE — the only source of product listings on this page */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '48px' }}>
            <h3 style={{ color: '#fff', marginBottom: '24px', fontSize: '20px' }}>Available Inventory & Models</h3>
            {products.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {products.map((p) => (
                  <div key={p.id} style={{ background: '#101410', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '200px', background: '#121712', overflow: 'hidden', position: 'relative' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div className="image-fallback" style={{ width: '100%', height: '100%', minHeight: 0 }} role="img" aria-label={p.name} />
                      )}
                      <div style={{ position: 'absolute', top: '12px', right: '12px', background: p.stock > 0 ? '#e8f2dc' : '#ffe2e2', color: p.stock > 0 ? '#35520f' : '#a00', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px' }}>
                        {p.stock > 0 ? `In Stock (${p.stock})` : 'Out of Stock / Custom Order'}
                      </div>
                    </div>
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>{p.name}</h4>
                        <p style={{ fontSize: '13px', color: '#b8b7ad', lineHeight: '1.6', marginBottom: '16px' }}>{p.description}</p>
                        {p.specs && (
                          <div style={{ fontSize: '12px', color: 'var(--accent)', background: '#131b14', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--line)', marginBottom: '20px', fontFamily: 'monospace' }}>
                            {p.specs}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#5a625d', display: 'block' }}>ESTIMATED PRICE</span>
                          <strong style={{ fontSize: '16px', color: '#fff' }}>
                            {p.price > 0 ? `${p.price.toLocaleString()} ZMW` : 'Quote Only'}
                          </strong>
                        </div>
                        <a
                          href="#quote"
                          onClick={() => setSelectedService(`Product: ${p.name}`)}
                          className="primary"
                          style={{ padding: '8px 16px', fontSize: '12px', minHeight: '36px' }}
                        >
                          Inquire Now <ArrowRight size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--line)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#b8b7ad' }}>
                Product catalogue coming soon — request a quote for custom builds.
              </div>
            )}
          </div>
        </section>

        {/* WORKSHOPS AND FACILITIES SECTION */}
        <section id="workshops" className="band" style={{ background: '#0e120f', borderTop: '1px solid var(--line)' }}>
          <div style={{ marginBottom: '32px' }}>
            <p className="eyebrow">OUR WORKSHOPS AND FACILITIES</p>
            <h2 style={{ color: '#fff', maxWidth: '900px' }}>At Arcus Investments, our ideas are brought to life in our dedicated, fully-equipped workshops.</h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', maxWidth: '850px', marginTop: '16px' }}>
              These spaces are the engine of our operation, where our design expertise meets physical fabrication. Investing in local, state-of-the-art facilities allows us to maintain complete control over quality, timelines, and cost, ensuring we deliver exceptional results for our clients at every stage of product development.
            </p>
          </div>

          {/* Slide Indicator Selector */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            <button 
              onClick={() => setWorkshopSlide(1)} 
              className={workshopSlide === 1 ? 'primary' : 'secondary'} 
              style={{ minHeight: '36px', fontSize: '12px', padding: '0 16px' }}
            >
              Slide 1: Electrical & Electronics Workshop
            </button>
            <button 
              onClick={() => setWorkshopSlide(2)} 
              className={workshopSlide === 2 ? 'primary' : 'secondary'} 
              style={{ minHeight: '36px', fontSize: '12px', padding: '0 16px' }}
            >
              Slide 2: Mechanical Workshop & Machine Shop
            </button>
          </div>

          {/* Slide 1 Content */}
          {workshopSlide === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
              <SmartImage src={arcusImages.electronicsWorkshop} alt="Electrical & Electronics Workshop" style={{ borderRadius: '8px', width: '100%', height: '360px', objectFit: 'cover' }} />
              <div>
                <h3 style={{ color: '#fff', fontSize: '22px', marginBottom: '14px' }}>ELECTRICAL & ELECTRONICS WORKSHOP</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.7', marginBottom: '16px' }}>
                  Our electronics lab is equipped for every stage of PCB development, from initial prototyping to rigorous testing and validation.
                </p>
                <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                  <div>
                    <strong style={{ color: 'var(--accent)', fontSize: '12px', display: 'block' }}>CAPABILITIES:</strong>
                    <span style={{ fontSize: '13px' }}>PCB population (reflow soldering), precise hand-soldering, circuit debugging, functional testing, and firmware programming.</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--accent)', fontSize: '12px', display: 'block' }}>CLIENT BENEFIT:</strong>
                    <span style={{ fontSize: '13px' }}>Rapid prototyping cycles and in-house testing mean we can iterate and solve problems quickly, dramatically speeding up your development timeline.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <a href="#quote" onClick={() => setSelectedService('PCB & electronics')} className="primary" style={{ fontSize: '13px', minHeight: '38px', padding: '0 16px' }}>
                    Get A Quote
                  </a>
                  <a href="#quote" onClick={() => setSelectedService('PCB & electronics')} className="secondary" style={{ fontSize: '13px', minHeight: '38px', padding: '0 16px' }}>
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Slide 2 Content */}
          {workshopSlide === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }}>
              <SmartImage src={arcusImages.mechanicalWorkshop} alt="Mechanical Workshop" style={{ borderRadius: '8px', width: '100%', height: '400px', objectFit: 'cover' }} />
              <div style={{ display: 'grid', gap: '24px' }}>
                <div>
                  <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>MECHANICAL WORKSHOP</h3>
                  <div style={{ background: '#121714', border: '1px solid var(--line)', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
                    <h4 style={{ color: 'var(--accent)', margin: '0 0 6px 0', fontSize: '15px' }}>Machine Shop</h4>
                    <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}>Our machine shop is dedicated to crafting high-tolerance metal and plastic components that form the backbone of robust mechanical designs.</p>
                    <span style={{ fontSize: '12px', display: 'block', color: '#b8b7ad' }}><strong>Equipment:</strong> CNC milling machines, lathes and drill presses.</span>
                    <span style={{ fontSize: '12px', display: 'block', color: '#b8b7ad', marginTop: '4px' }}><strong>Client Benefit:</strong> In-house fabrication eliminates outsourcing delays.</span>
                  </div>

                  <div style={{ background: '#121714', border: '1px solid var(--line)', padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ color: 'var(--accent)', margin: '0 0 6px 0', fontSize: '15px' }}>Fabrication Shop</h4>
                    <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}>For larger-scale builds and enclosures, our fabrication shop handles cutting, welding, and forming raw materials into finished products.</p>
                    <span style={{ fontSize: '12px', display: 'block', color: '#b8b7ad' }}><strong>Equipment:</strong> MIG welders, metal brakes and shears, grinders, and finishing stations.</span>
                    <span style={{ fontSize: '12px', display: 'block', color: '#b8b7ad', marginTop: '4px' }}><strong>Client Benefit:</strong> Create durable, professional-grade enclosures and structural chassis.</span>
                  </div>
                </div>
                <div>
                  <a href="#quote" onClick={() => setSelectedService('Mechanical fabrication')} className="primary" style={{ fontSize: '13px', minHeight: '38px', padding: '0 16px' }}>
                    Get A Quote
                  </a>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* EVENTS SECTION */}
        {upcomingEvents.length > 0 && (
          <section className="band" style={{ background: '#101410', borderTop: '1px solid var(--line)' }}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Green Engineering 2026</p>
                <h2>Upcoming programs and events.</h2>
              </div>
              <Link to="/green-engineering-2026" className="text-link" style={{ whiteSpace: 'nowrap' }}>
                View all events <ArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {upcomingEvents.map((event) => (
                <motion.article
                  whileHover={{ y: -5 }}
                  key={event.id}
                  style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}
                >
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                  ) : (
                    <div className="image-fallback" style={{ height: '160px' }} />
                  )}
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ color: '#fff', marginBottom: '10px' }}>{event.title}</h3>
                    <p style={{ fontSize: '13px', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</p>
                    <div style={{ fontSize: '12px', color: '#ede8d8', display: 'flex', flexDirection: 'column', gap: '5px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><Calendar size={13} style={{ color: 'var(--accent)' }} />{new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><MapPin size={13} style={{ color: 'var(--accent)' }} />{event.location}</div>
                    </div>
                    <Link to="/green-engineering-2026" className="primary" style={{ display: 'flex', marginTop: '14px', width: '100%', justifyContent: 'center' }}>
                      Reserve a seat <ArrowRight size={15} />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        )}

        {/* GALLERY SECTION */}
        <section id="gallery" className="band" style={{ background: '#0b0d0c', borderTop: '1px solid var(--line)' }}>
          <div className="section-head" style={{ marginBottom: '32px' }}>
            <div>
              <p className="eyebrow">GALLERY</p>
              <h2 style={{ color: '#fff' }}>Reflow Oven || Pick and Place || CNC Mill Prototyping</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', height: '220px', display: 'grid', placeItems: 'center', position: 'relative' }}>
              <SmartImage src={arcusImages.pcbWorkbench} alt="Reflow Oven" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.6)', padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>Reflow Oven</div>
            </div>
            <div style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', height: '220px', display: 'grid', placeItems: 'center', position: 'relative' }}>
              <SmartImage src={arcusImages.assembly} alt="Pick and Place" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.6)', padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>Pick and Place</div>
            </div>
            <div style={{ background: '#121714', border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden', height: '220px', display: 'grid', placeItems: 'center', position: 'relative' }}>
              <SmartImage src={arcusImages.mechanicalWorkshop} alt="CNC Mill Prototyping" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.6)', padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>CNC Mill Prototyping</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <a href="#quote" className="primary" style={{ padding: '0 24px' }}>Get A Quote</a>
          </div>
        </section>


        {/* QUOTE SECTION */}
        <section id="quote" className="quote-section" style={{ background: '#0e120f', borderTop: '1px solid var(--line)' }}>
          <div>
            <p className="eyebrow">Start a project</p>
            <h2>Send the scope. Arcus will turn it into a practical next step.</h2>
          </div>
          <QuoteForm preselectedService={selectedService} />
        </section>
      </main>

      <footer className="footer" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <span>© {new Date().getFullYear()} Arcus Investments. All rights reserved</span>
        <span style={{ fontSize: '12px', color: '#5a625d' }}>Kitwe Innovation Hub · Kitwe, Zambia</span>
      </footer>
      <ChatWidget />
    </>
  );
}
