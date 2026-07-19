import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mobile Game Tracker",
  description: "Daily chart-rank, review-velocity, and UA-proxy tracking for Century Games & Gravity titles",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/compare", label: "Compare" },
  { href: "/signals", label: "Signals" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--page)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
            <Link href="/" className="mr-3 shrink-0 text-sm font-bold tracking-tight">
              GameTracker
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="shrink-0 rounded px-2.5 py-1 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-4">{children}</main>
        <footer className="mx-auto max-w-6xl px-3 pb-6 text-xs text-[var(--text-muted)]">
          Ranks are real store data · revenue figures are modeled estimates (labeled) · ad counts are EU
          Ad Library proxies
        </footer>
      </body>
    </html>
  );
}
