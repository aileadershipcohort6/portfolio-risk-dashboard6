"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Upload" },
  { href: "/dashboard", label: "Executive Dashboard" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header>
      {/* Accent rule across the very top of the page. */}
      <div className="h-[3px] w-full bg-[var(--accent)]" />
      <div className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Simple geometric logo mark — no icon library, no emoji. */}
            <div className="h-7 w-7 rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0">
              <div className="h-2.5 w-2.5 rounded-sm bg-[var(--surface)]" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-sm sm:text-base">
                Portfolio Risk Dashboard
              </div>
              <div className="text-[11px] sm:text-xs text-[var(--muted)]">
                Lending &amp; credit risk prototype
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 shrink-0">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs sm:text-sm font-medium text-white"
                      : "rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--muted)] hover:bg-[var(--background)]"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
