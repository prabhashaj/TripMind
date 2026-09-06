"use client";

import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  Wallet,
  Clock,
  Plane,
  Hotel,
  Compass,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  MessageSquareText,
  Map,
} from "lucide-react";
import { TravelImage } from "@/components/TravelImage";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DestinationSpotlight {
  id: string;
  name: string;
  region: string;
  tag: string;
  duration: string;
  budgetEstimate: string;
  image: string;
  prompt: string;
}

const TRENDING_DESTINATIONS: DestinationSpotlight[] = [
  {
    id: "kashmir",
    name: "Kashmir & Gulmarg",
    region: "Jammu & Kashmir, India",
    tag: "Snow Peaks & Houseboats",
    duration: "7 Days",
    budgetEstimate: "₹60,000 for 2",
    image: "https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a 7-day trip from Hyderabad to Kashmir for 2 people under ₹60,000 with scenic valley stays and a gondola ride in Gulmarg",
  },
  {
    id: "goa",
    name: "South Goa Retreat",
    region: "Goa, India",
    tag: "Secluded Beaches & Cafes",
    duration: "4 Days",
    budgetEstimate: "₹30,000 for 2",
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a relaxing 4-day beach vacation in South Goa from Mumbai under ₹30,000 for 2 adults with sunset cruises and beach shacks",
  },
  {
    id: "kyoto",
    name: "Kyoto & Tokyo",
    region: "Japan",
    tag: "Shrines, Bamboo & Cuisine",
    duration: "6 Days",
    budgetEstimate: "₹1,40,000 for 2",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a 6-day cultural journey to Kyoto and Tokyo for 2 people with historic temples, bamboo groves, bullet train passes, and authentic ramen trails",
  },
  {
    id: "amalfi",
    name: "Amalfi Coast",
    region: "Campania, Italy",
    tag: "Cliffside Towns & Azure Waters",
    duration: "5 Days",
    budgetEstimate: "₹1,60,000 for 2",
    image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a romantic 5-day trip along the Amalfi Coast from Rome with scenic cliffside stays, lemon grove tours, and boat excursions to Capri",
  },
  {
    id: "coorg",
    name: "Coorg & Abbey Falls",
    region: "Karnataka, India",
    tag: "Misty Hills & Coffee Estates",
    duration: "3 Days",
    budgetEstimate: "₹25,000 for 2",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a cozy 3-day weekend trip to Coorg from Bangalore for a couple under ₹25,000 with estate homestays and waterfall treks",
  },
  {
    id: "rajasthan",
    name: "Udaipur & Jodhpur",
    region: "Rajasthan, India",
    tag: "Royal Palaces & Forts",
    duration: "5 Days",
    budgetEstimate: "₹45,000 for 2",
    image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800&auto=format&fit=crop&q=80",
    prompt: "Plan a 5-day cultural trip to Udaipur and Jodhpur from Delhi under ₹45,000 for 2 friends focused on palaces, rooftop dinners, and heritage walks",
  },
];

const FEATURES = [
  {
    icon: <Calendar className="w-5 h-5 text-amber-700" />,
    title: "Smart Day-by-Day Timeline",
    description: "Every day is mapped hour-by-hour with realistic travel buffers, opening times, and optimal transit pacing so you never feel rushed.",
  },
  {
    icon: <Plane className="w-5 h-5 text-sky-400" />,
    title: "Live Transport & Route Mapping",
    description: "Verified direct flights, scenic rail routes, and private cab transfers calculated with transparent fares and carrier details.",
  },
  {
    icon: <Hotel className="w-5 h-5 text-orange-400" />,
    title: "Curated Boutique Stays",
    description: "Handpicked accommodations matching your travel style, with live pricing, guest ratings, and verified amenities.",
  },
  {
    icon: <Wallet className="w-5 h-5 text-emerald-400" />,
    title: "Itemized Budget Shield",
    description: "Full visibility into every expense: lodging, intercity transit, local commute, dining, and activities with no hidden surprises.",
  },
  {
    icon: <MessageSquareText className="w-5 h-5 text-amber-700" />,
    title: "Interactive AI Trip Copilot",
    description: "Modify any itinerary in plain English: 'Swap Day 3 for a quieter hike', 'Find a cheaper boutique hotel', or 'Add vegetarian dining spots'.",
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-teal-400" />,
    title: "Route & Pacing Feasibility",
    description: "Every itinerary passes automatic sanity checks on wake times, transit buffers, and activity fatigue so your trip runs smoothly.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Share your dream vibe & budget",
    desc: "Tell TripMind where you want to go, who is traveling, and your approximate budget or preferred style.",
  },
  {
    step: "02",
    title: "Instant personalized itinerary",
    desc: "TripMind synthesizes real-time flights, verified stays, curated attractions, and a balanced daily schedule.",
  },
  {
    step: "03",
    title: "Customize on the fly",
    desc: "Use the built-in AI Copilot to swap activities, tweak hotels, or recalculate costs with a single message.",
  },
];

const FIELD_NOTES = [
  {
    title: "Morning markets",
    place: "Marrakech, Morocco",
    image: "https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=900&auto=format&fit=crop&q=85",
    note: "For the early riser who likes a city before it gets loud.",
  },
  {
    title: "Long way round",
    place: "Scottish Highlands",
    image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900&auto=format&fit=crop&q=85",
    note: "A scenic route, a warm inn, and nowhere else to be.",
  },
  {
    title: "Salt air",
    place: "Naxos, Greece",
    image: "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?w=900&auto=format&fit=crop&q=85",
    note: "For slow afternoons, small tavernas, and a later sunset.",
  },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-background text-foreground">
      {/* Subtle ambient light */}
      <div className="hero-glow" />

      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2 font-bold text-lg font-display">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Map className="w-4 h-4 text-primary" />
            </div>
            <span>TripMind</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#destinations" className="hover:text-primary transition-colors">Destinations</a>
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How it works</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" className="rounded-full shadow-sm">
                Start Planning
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>

        {/* ── Hero Section ────────────────────────────────────── */}
        <section id="prompt-composer" style={{ maxWidth: "1280px", margin: "0 auto", padding: "4rem 1.5rem 3.5rem 1.5rem", position: "relative" }}>
          {/* Headline */}
          <h1 className="font-display animate-fade-in-up animate-delay-100" style={{ fontSize: "clamp(2.2rem, 5.5vw, 3.5rem)", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: "1.125rem", maxWidth: "800px" }}>
            Where to next?
            <br />
            <span className="text-gradient-primary">Plan your bespoke journey in seconds.</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up animate-delay-200 text-lg leading-relaxed text-muted-foreground max-w-[580px] mb-9">
            Turn your ideas, budget, and travel style into complete day-by-day itineraries with verified transport, curated stays, and local experiences.
          </p>

          <div className="landing-launchpad animate-scale-in animate-delay-300">
            <div className="launchpad-copy">
              <span className="launchpad-kicker"><Compass className="w-4 h-4" /> Start with a thought</span>
              <h2>A good journey begins with a little curiosity.</h2>
              <p>Open your trip studio to shape a route, compare stays, and turn a loose idea into a plan worth following.</p>
              <div className="launchpad-actions">
                <Link href="/chat" className="classical-launch-button">Open trip studio <ArrowRight className="w-4 h-4" /></Link>
                <span className="launchpad-note">No tabs. No guesswork. Just a better journey.</span>
              </div>
            </div>
            <div className="launchpad-map" aria-hidden="true">
              <TravelImage src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1200&auto=format&fit=crop&q=85" alt="A vintage world map" className="launchpad-map-image" />
              <div className="launchpad-map-wash" />
              <div className="route-line" />
              <span className="map-flight"><Plane className="w-5 h-5" /></span>
              <span className="route-pin route-pin-one"><MapPin className="w-4 h-4" /></span>
              <span className="route-pin route-pin-two"><MapPin className="w-4 h-4" /></span>
              <span className="route-label route-label-one">NEW YORK</span>
              <span className="route-label route-label-two">JAPAN</span>
              <div className="map-location-card map-location-card-one"><strong>Tokyo</strong><span>Laneways, gardens, and late dinners</span></div>
              <div className="map-location-card map-location-card-two"><strong>Kyoto</strong><span>Temple walks and quiet mornings</span></div>
            </div>
          </div>

        </section>

        {/* ── Curated Destinations ────────────── */}
        <section id="destinations" className="py-16 border-t border-border bg-muted/30">
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "2.25rem" }}>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Curated Inspiration</p>
                <h2 className="font-display text-2xl tracking-tight text-foreground">
                  Trending Destinations
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select any destination to instantly populate your itinerary planner.
                </p>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              {TRENDING_DESTINATIONS.map((dest) => (
                <div
                  key={dest.id}
                  onClick={() => router.push(`/chat?prompt=${encodeURIComponent(dest.prompt)}`)}
                  className="card landing-destination-card"
                  style={{
                    overflow: "hidden",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    transition: "all var(--transition-base)",
                  }}
                >
                  {/* Photo container */}
                  <div className="relative h-[190px] overflow-hidden bg-muted">
                    <TravelImage
                      src={dest.image}
                      alt={dest.name}
                      className="w-full h-full object-cover"
                      
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 60%)" }} />

                    <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.25rem 0.625rem", borderRadius: "99px", background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255, 255, 255, 0.15)", color: "#fff" }}>
                        {dest.tag}
                      </span>
                    </div>

                    <div style={{ position: "absolute", bottom: "0.75rem", left: "0.875rem", right: "0.875rem" }}>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{dest.name}</h3>
                      <p style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.85)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.125rem" }}>
                        <MapPin className="w-3 h-3" />
                        {dest.region}
                      </p>
                    </div>
                  </div>

                  {/* Card bottom details */}
                  <div className="px-4 py-3.5 flex items-center justify-between bg-card">
                    <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {dest.duration}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        {dest.budgetEstimate}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-primary flex items-center gap-1 group-hover:underline">
                      Plan this <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="field-notes-section">
          <div className="field-notes-heading">
            <div>
              <p className="section-eyebrow">A little inspiration</p>
              <h2 className="font-display">Journeys with a point of view.</h2>
            </div>
            <p>Good plans leave room for the unexpected. Start with a mood and let the route take shape.</p>
          </div>
          <div className="field-notes-grid">
            {FIELD_NOTES.map((note, index) => (
              <article className={`field-note field-note-${index + 1}`} key={note.title}>
                <div className="field-note-image-wrap"><TravelImage src={note.image} alt={note.place} className="field-note-image" /><span className="field-note-index">0{index + 1}</span></div>
                <div className="field-note-copy"><span>{note.place}</span><h3>{note.title}</h3><p>{note.note}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="py-20 border-t border-border">
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Bespoke Features</p>
              <h2 className="font-display text-2xl tracking-tight mb-2 text-foreground">
                Everything in one unified workspace
              </h2>
              <p className="text-[15px] text-muted-foreground max-w-[560px] mx-auto">
                Say goodbye to ten open browser tabs. TripMind coordinates every aspect of your holiday into a cohesive, realistic travel schedule.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
              {FEATURES.map((feat, i) => (
                <div key={i} className="card p-6 flex gap-4 items-start transition-all">
                  <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1.5">{feat.title}</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 border-t border-border bg-muted/30">
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Simple & Seamless</p>
              <h2 className="font-display text-2xl tracking-tight mb-2 text-foreground">
                How TripMind designs your journey
              </h2>
              <p className="text-[15px] text-muted-foreground max-w-[520px] mx-auto">
                From a single casual thought to a complete, verified holiday in three effortless steps.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={i} className="card p-7 transition-all">
                  <div className="mb-4 text-primary/70 text-sm font-semibold">
                    {step.step}
                  </div>
                  <h3 className="text-base font-semibold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="travel-intelligence-band">
          <div><span className="section-eyebrow">Built for real plans</span><h2 className="font-display">Less scrolling. More going.</h2></div>
          <div className="intelligence-stats"><div><strong>01</strong><span>One calm workspace</span></div><div><strong>24/7</strong><span>Ideas when inspiration strikes</span></div><div><strong>ANY</strong><span>Routes worth revisiting</span></div></div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 bg-muted/20">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem", height: "auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div className="footer-brand">
            <div className="classical-brand-mark footer-brand-mark">
              <Map className="w-3 h-3 text-primary" />
            </div>
            <span className="footer-brand-name">TripMind</span>
            <span className="footer-brand-tagline">Intelligent Travel Designer</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 TripMind. Verified itineraries & live travel intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
}
