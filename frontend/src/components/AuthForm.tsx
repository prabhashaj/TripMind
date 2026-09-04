"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Map, Sparkles } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="auth-page">
      <div className="auth-atmosphere" />
      <Link href="/" className="auth-brand"><span className="classical-brand-mark"><Map className="w-4 h-4" /></span><span>TripMind</span></Link>
      <section className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow"><Sparkles className="w-4 h-4" /> A more considered way to travel</span>
          <h1>{isSignup ? "Keep every beautiful possibility in one place." : "Welcome back to your next journey."}</h1>
          <p>Save your travel rhythm, revisit ideas, and let your trip studio get more helpful over time.</p>
          <div className="auth-proof"><span><Check size={14} /> Personal trip memory</span><span><Check size={14} /> Thoughtful planning tools</span></div>
        </div>
        <div className="auth-card">
          <div className="auth-card-heading"><span className="eyebrow">{isSignup ? "Begin your atlas" : "Continue your atlas"}</span><h2>{isSignup ? "Create your account" : "Sign in to TripMind"}</h2><p>{isSignup ? "Your next great story deserves a home." : "Pick up where your plans left off."}</p></div>
          {submitted ? <div className="auth-success"><Check size={20} /><strong>{isSignup ? "Your account is ready to begin." : "Welcome back."}</strong><Link href="/chat" className="classical-launch-button">Open trip studio <ArrowRight size={16} /></Link></div> : <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && <label>Name<input name="name" placeholder="Your name" required /></label>}
            <label>Email<input name="email" type="email" placeholder="you@example.com" required /></label>
            <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} required /></label>
            <button type="submit" className="classical-launch-button">{isSignup ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
          </form>}
          <p className="auth-switch">{isSignup ? "Already have an account?" : "New to TripMind?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p>
        </div>
      </section>
    </main>
  );
}
