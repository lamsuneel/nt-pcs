import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeuraTrace | Print Control System',
  description: 'GMP Controlled Printing and Physical Document Control',
};

// NeuraTrace brand type: Outfit (display) / IBM Plex Sans (body) / IBM Plex Mono
// (data). Loaded as self-hosted fallback-safe stacks rather than next/font/google
// so the app builds and runs with no outbound font-CDN dependency (relevant for
// paper-first, low-connectivity shop-floor deployments per spec §4).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
