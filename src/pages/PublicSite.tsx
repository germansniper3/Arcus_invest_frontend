import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Cpu, Hammer, Layers, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatWidget } from '../components/ChatWidget';
import { Nav } from '../components/Nav';
import { QuoteForm } from '../components/QuoteForm';
import { SmartImage } from '../components/SmartImage';
import { api } from '../lib/api';
import { arcusImages } from '../lib/assets';
import type { Event, GalleryItem, Product } from '../types';

const services = [
  {
    icon: Layers,
    title: 'Electronic maintenance, design and PCB manufacturing',
    body: 'Board repair, prototyping, circuit debugging, reflow work and production-ready printed circuit assemblies.',
  },
  {
    icon: Hammer,
    title: 'Mechanical engineering and fabrication',
    body: 'CNC machining, metal fabrication, enclosures, installation support and practical repair for industrial equipment.',
  },
  {
    icon: Cpu,
    title: 'Product development from concept to handover',
    body: 'Hardware, firmware, software and production support held together by one local engineering team.',
  },
];

const workshopSlides = [
  {
    id: 1,
    label: 'Electronics workshop',
    title: 'Electrical and electronics workshop',
    image: arcusImages.electronicsWorkshop,
    service: 'PCB & electronics',
    intro: 'PCB work, firmware programming and failure analysis happen in one controlled lab, so prototypes move from bench test to client review without leaving the team.',
    details: [
      ['Capabilities', 'PCB population, reflow soldering, hand soldering, circuit debugging, functional testing and firmware programming.'],
      ['Client benefit', 'Rapid prototype cycles and in-house validation shorten the distance between an idea, a failure and the next working version.'],
    ],
  },
  {
    id: 2,
    label: 'Machine shop',
    title: 'Mechanical workshop and machine shop',
    image: arcusImages.mechanicalWorkshop,
    service: 'Mechanical fabrication',
    intro: 'Precision components and rugged enclosures are built close to the electronics team, which keeps mechanical fit and electrical realities in the same conversation.',
    details: [
      ['Machine shop', 'CNC milling, lathes and drill presses for high-tolerance metal and plastic components.'],
      ['Fabrication shop', 'Cutting, welding, forming and finishing for durable enclosures, frames and structural chassis.'],
    ],
  },
];

export function PublicSite() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [workshopSlide, setWorkshopSlide] = useState(1);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    api.listPublicEvents().then((events) => setUpcomingEvents(events.slice(0, 3))).catch(() => {});
    api.listPublicProducts().then(setProducts).catch(() => {});
    api.listPublicGallery().then(setGalleryItems).catch(() => {});
  }, []);

  const activeWorkshop = workshopSlides.find((item) => item.id === workshopSlide) ?? workshopSlides[0];
  const shownGallery = galleryItems.length > 0
    ? galleryItems.map((g) => ({ src: g.image_url, label: g.title, caption: g.caption }))
    : [
        { src: arcusImages.pcbWorkbench, label: 'Reflow oven', caption: 'Board-level repair and prototyping' },
        { src: arcusImages.assembly, label: 'Assembly bench', caption: 'Electronics builds and validation' },
        { src: arcusImages.mechanicalWorkshop, label: 'CNC prototyping', caption: 'Machined parts and enclosures' },
      ];

  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <img src={arcusImages.pcbWorkbench} alt="PCB repair and prototyping bench" className="hero-image" />
          <div className="hero-shade" />
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="eyebrow">Engineering, fabrication and technical support in Zambia</p>
            <h1>ARCUS INVESTMENTS</h1>
            <p>
              We repair, design and build electronics, mechanical parts, automation systems and custom equipment for teams that need practical engineering close to site.
            </p>
            <div className="hero-actions">
              <a href="#quote" className="primary">Get a quote <ArrowRight size={18} /></a>
              <a href="#workshops" className="secondary">See the workshops</a>
              <Link to="/arcus-innovation-hub-enrollment-manager" className="secondary secondary-accent">Innovation Hub</Link>
            </div>
          </motion.div>
        </section>

        <section id="about" className="band band-dark">
          <div className="section-head">
            <div>
              <p className="eyebrow">About Arcus</p>
              <h2>Zambian-owned engineering for equipment, electronics and product builds.</h2>
            </div>
            <p>
              Arcus brings maintenance, design, prototyping and manufacturing into one local workflow, giving mining, construction and product teams a faster path from problem to working solution.
            </p>
          </div>

          <div className="service-strip">
            {services.map(({ icon: Icon, title, body }) => (
              <article className="service-panel" key={title}>
                <Icon size={28} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>

          <p className="proof-line">Built for affordable, collaborative engineering with quality control kept close to the people doing the work.</p>
        </section>

        <section id="products-services" className="band band-black">
          <div className="section-head section-head-narrow">
            <div>
              <p className="eyebrow">Products and services</p>
              <h2>Custom electronics plus database-backed inventory from the Arcus catalogue.</h2>
            </div>
          </div>

          <article className="featured-service">
            <SmartImage src={arcusImages.pcbService} alt="Custom PCB design and electronics service" />
            <div>
              <p className="eyebrow">Core service</p>
              <h3>Custom PCB design and electronics solutions</h3>
              <p>
                From circuit design and PCB layout to assembly, debugging and production handover, Arcus turns product ideas into reliable electronic systems.
              </p>
              <a href="#quote" onClick={() => setSelectedService('PCB & electronics')} className="primary">
                Request PCB work <ArrowRight size={16} />
              </a>
            </div>
          </article>

          <div className="inventory-head">
            <h3>Available inventory and models</h3>
            <span>{products.length > 0 ? `${products.length} listed` : 'Catalogue warming up'}</span>
          </div>
          {products.length > 0 ? (
            <div className="inventory-grid">
              {products.map((product) => (
                <article className="product-tile" key={product.id}>
                  <div className="product-media">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} />
                    ) : (
                      <div className="image-fallback" role="img" aria-label={product.name} />
                    )}
                    <span data-stock={product.stock > 0 ? 'in' : 'out'}>
                      {product.stock > 0 ? `In stock (${product.stock})` : 'Custom order'}
                    </span>
                  </div>
                  <div className="product-body">
                    <h4>{product.name}</h4>
                    <p>{product.description}</p>
                    {product.specs && <code>{product.specs}</code>}
                    <footer>
                      <div>
                        <span>Estimated price</span>
                        <strong>{product.price > 0 ? `${product.price.toLocaleString()} ZMW` : 'Quote only'}</strong>
                      </div>
                      <a href="#quote" onClick={() => setSelectedService(`Product: ${product.name}`)} className="primary">
                        Inquire <ArrowRight size={14} />
                      </a>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-public">Product catalogue coming soon. Ask us for a quote on custom builds.</div>
          )}
        </section>

        <section id="workshops" className="workshop-feature">
          <div className="workshop-copy">
            <p className="eyebrow">Workshops and facilities</p>
            <h2>Design expertise meets physical fabrication on the same floor.</h2>
            <p>
              Arcus keeps electronics, machining, fabrication and testing close together so quality, cost and timing stay visible throughout the build.
            </p>
            <div className="segmented" role="tablist" aria-label="Workshop view">
              {workshopSlides.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setWorkshopSlide(item.id)}
                  className={item.id === workshopSlide ? 'active' : ''}
                  role="tab"
                  aria-selected={item.id === workshopSlide}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <motion.article
            className="workshop-panel"
            key={activeWorkshop.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <SmartImage src={activeWorkshop.image} alt={activeWorkshop.title} />
            <div>
              <h3>{activeWorkshop.title}</h3>
              <p>{activeWorkshop.intro}</p>
              <div className="detail-list">
                {activeWorkshop.details.map(([label, value]) => (
                  <div key={label}>
                    <strong>{label}</strong>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <a href="#quote" onClick={() => setSelectedService(activeWorkshop.service)} className="primary">
                Discuss this work <ArrowRight size={16} />
              </a>
            </div>
          </motion.article>
        </section>

        {upcomingEvents.length > 0 && (
          <section className="band band-dark">
            <div className="section-head">
              <div>
                <p className="eyebrow">Green Engineering 2026</p>
                <h2>Upcoming programs and events.</h2>
              </div>
              <Link to="/green-engineering-2026" className="text-link">
                View all events <ArrowRight size={16} />
              </Link>
            </div>
            <div className="event-grid">
              {upcomingEvents.map((event) => (
                <motion.article whileHover={{ y: -4 }} key={event.id} className="event-card">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} />
                  ) : (
                    <div className="image-fallback" />
                  )}
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.description}</p>
                    <dl>
                      <div><Calendar size={13} /><dt>Date</dt><dd>{new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}</dd></div>
                      <div><MapPin size={13} /><dt>Location</dt><dd>{event.location}</dd></div>
                    </dl>
                    <Link to="/green-engineering-2026" className="primary">Reserve a seat <ArrowRight size={15} /></Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        )}

        <section id="gallery" className="gallery-band">
          <div className="section-head section-head-narrow">
            <div>
              <p className="eyebrow">Gallery</p>
              <h2>Real work from the electronics and fabrication floors.</h2>
            </div>
          </div>
          <div className="gallery-grid">
            {shownGallery.map((item, i) => (
              <figure key={`${item.label}-${i}`}>
                <SmartImage src={item.src} alt={item.label} />
                <figcaption>
                  <strong>{item.label}</strong>
                  {item.caption && <span>{item.caption}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          <a href="#quote" className="primary gallery-cta">Get a quote</a>
        </section>

        <section id="quote" className="quote-section">
          <div>
            <p className="eyebrow">Start a project</p>
            <h2>Send the scope. Arcus will turn it into a practical next step.</h2>
            <p>Share the equipment, board, part, system or product you need help with. The portal stores the request directly in the back office.</p>
          </div>
          <QuoteForm preselectedService={selectedService} />
        </section>
      </main>

      <footer className="footer">
        <span>Copyright {new Date().getFullYear()} Arcus Investments. All rights reserved.</span>
        <span>Kitwe Innovation Hub - Kitwe, Zambia</span>
      </footer>
      <ChatWidget />
    </>
  );
}
