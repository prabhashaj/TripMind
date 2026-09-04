"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Map, Sparkles } from "lucide-react";
import { TravelChat } from "@/components/TravelChat";

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("prompt");
    if (value) setPrompt(value);
  }, []);

  return (
    <main className="chat-studio-page">
      <header className="studio-header">
        <Link href="/" className="classical-brand"><span className="classical-brand-mark"><Map className="w-4 h-4" /></span><span>TripMind</span></Link>
        <Link href="/" className="studio-back"><ArrowLeft className="w-4 h-4" /> Back to inspiration</Link>
      </header>
      <section className="studio-main">
        <div className="studio-intro">
          <span className="eyebrow"><Sparkles className="w-4 h-4" /> Private trip studio</span>
          <h1>Your route, in conversation.</h1>
          <p>Share a destination, a mood, or a half-formed idea. TripMind will turn it into a thoughtful plan.</p>
        </div>
        <div className="studio-chat"><TravelChat initialPrompt={prompt} /></div>
      </section>
    </main>
  );
}
