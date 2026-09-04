"use client";

import { useState } from "react";
import {
  Sparkles,
  MapPin,
  Calendar,
  Wallet,
  Clock,
  Plane,
  Hotel,
  Compass,
  ArrowRight,
  ShieldCheck,
  MessageSquareText,
  Map,
} from "lucide-react";
import { TravelImage } from "@/components/TravelImage";
import { TravelChat } from "@/components/TravelChat";
import Link from "next/link";

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
    icon: <Calendar className="w-5 h-5 text-indigo-400" />,
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
    icon: <MessageSquareText className="w-5 h-5 text-purple-400" />,
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

export default function HomePage() {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: "linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-surface) 100%)", color: "var(--color-text-primary)" }}>
      {/* Subtle ambient light */}
      <div className="hero-glow" />

      {/* ── Top Header ────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--color-border)", background: "rgba(255, 255, 255, 0.98)", backdropFilter: "blur(16px)", boxShadow: "0 2px 8px rgba(139, 92, 246, 0.05)" }}>
        <div className="container-nav">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px -2px rgba(139, 92, 246, 0.5)" }}>
              <Map className="w-4 h-4 text-white" />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: "1.0625rem", letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>TripMind</span>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <a href="#destinations" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", color: "var(--color-text-secondary)", border: "1px solid transparent", background: "transparent", borderRadius: "var(--radius-md)", transition: "all var(--transition-base)" }}>
              Destinations
            </a>
            <a href="#features" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", color: "var(--color-text-secondary)", border: "1px solid transparent", background: "transparent", borderRadius: "var(--radius-md)", transition: "all var(--transition-base)" }}>
              Features
            </a>
            <a href="#how-it-works" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", color: "var(--color-text-secondary)", border: "1px solid transparent", background: "transparent", borderRadius: "var(--radius-md)", transition: "all var(--transition-base)" }}>
              How it works
            </a>
            <button
              onClick={() => {
                const el = document.getElementById("prompt-composer");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-primary"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.875rem" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Plan a Trip
            </button>

          </nav>
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
          <p className="animate-fade-in-up animate-delay-200" style={{ fontSize: "1.0625rem", lineHeight: 1.65, color: "var(--color-text-secondary)", maxWidth: "580px", marginBottom: "2.25rem" }}>
            Turn your ideas, budget, and travel style into complete day-by-day itineraries with verified transport, curated stays, and local experiences.
          </p>

          {/* Travel Chat Interface - Bigger */}
          <div className="animate-scale-in animate-delay-300" style={{ maxWidth: "720px", margin: "0 auto" }}>
            <TravelChat />
          </div>

        </section>

        {/* ── Curated Destinations ────────────── */}
        <section id="destinations" style={{ padding: "4rem 0", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "2.25rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-600)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Curated Inspiration</p>
                <h2 className="font-display" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
                  Trending Destinations
                </h2>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                  Select any destination to instantly populate your itinerary planner.
                </p>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              {TRENDING_DESTINATIONS.map((dest) => (
                <div
                  key={dest.id}
                  onClick={() => {
                    const textarea = document.querySelector("#main-chat-input");
                    if (textarea) {
                      (textarea as HTMLTextAreaElement).value = dest.prompt;
                      textarea.dispatchEvent(new Event("input", { bubbles: true }));
                      (textarea as HTMLTextAreaElement).focus();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="card"
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
                  <div style={{ position: "relative", height: "190px", overflow: "hidden", background: "var(--color-bg-input)" }}>
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
                  <div style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-bg-card)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {dest.duration}
                      </span>
                      <span>·</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        {dest.budgetEstimate}
                      </span>
                    </div>

                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-600)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      Plan this <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Section ─────────────────────────────────── */}
        <section id="features" style={{ padding: "5rem 0", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-600)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Bespoke Features</p>
              <h2 className="font-display" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>
                Everything in one unified workspace
              </h2>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-text-secondary)", maxWidth: "560px", margin: "0 auto" }}>
                Say goodbye to ten open browser tabs. TripMind coordinates every aspect of your holiday into a cohesive, realistic travel schedule.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
              {FEATURES.map((feat, i) => (
                <div key={i} className="card" style={{ padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-start", transition: "all var(--transition-base)" }}>
                  <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "var(--radius-md)", background: "var(--color-primary-50)", border: "1px solid var(--color-primary-200)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all var(--transition-base)" }}>
                    {feat.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>{feat.title}</h3>
                    <p style={{ fontSize: "0.8125rem", lineHeight: 1.65, color: "var(--color-text-secondary)" }}>{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────── */}
        <section id="how-it-works" style={{ padding: "5rem 0", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-600)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Simple & Seamless</p>
              <h2 className="font-display" style={{ fontSize: "1.75rem", letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>
                How TripMind designs your journey
              </h2>
              <p style={{ fontSize: "0.9375rem", color: "var(--color-text-secondary)", maxWidth: "520px", margin: "0 auto" }}>
                From a single casual thought to a complete, verified holiday in three effortless steps.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={i} className="card" style={{ padding: "1.75rem", transition: "all var(--transition-base)" }}>
                  <div style={{ marginBottom: "1rem", color: "var(--color-primary-300)", fontSize: "0.875rem", fontWeight: 600 }}>
                    {step.step}
                  </div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>{step.title}</h3>
                  <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--color-border)", padding: "2rem 0", background: "var(--color-bg-surface)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem", height: "auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{ width: "1.5rem", height: "1.5rem", borderRadius: "0.375rem", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Map className="w-3 h-3 text-white" />
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>TripMind</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>— Intelligent Travel Designer</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            © 2026 TripMind. Verified itineraries & live travel intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
}
