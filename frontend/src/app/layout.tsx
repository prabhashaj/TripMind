import type { Metadata } from 'next';
import './globals.css';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'TripMind — Intelligent Travel Planning',
  description:
    'Plan your perfect trip with an AI travel team. Personalized destinations, transport, hotels, activities, and day-by-day itineraries in real time.',
  keywords: ['travel planning', 'AI travel agent', 'trip planner', 'itinerary', 'India travel'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}<ThemeToggle /></body>
    </html>
  );
}
