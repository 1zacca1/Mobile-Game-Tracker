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
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2.5">
            <Link href="/" className="mr-4 flex shrink-0 items-center gap-2 text-sm font-bold tracking-tight">
              <span className="inline-block h-5 w-5 rounded-md bg-[var(--s1)]" />
              GameTracker
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-[var(--text-muted)]">
          <div>
            Ranks are real store data · revenue figures are modeled estimates (labeled) · ad counts are EU
            Ad Library proxies
          </div>
          <div className="mt-1 opacity-70">
            build {(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}
            {process.env.VERCEL_GIT_COMMIT_REF ? ` · ${process.env.VERCEL_GIT_COMMIT_REF}` : ""}
          </div>
        </footer>
      </body>
    </html>
  );
}
