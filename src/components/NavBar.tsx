"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Upload" },
  { href: "/dashboard", label: "Executive Dashboard" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header>
      <div style={{ height: 3, background: "var(--accent)" }} />
      <div className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0">
              <div className="w-3 h-3 rounded-sm bg-[var(--surface)]" />
            </div>
            <div>
              <div className="font-semibold leading-tight">Portfolio Risk Dashboard</div>
              <div className="text-xs text-[var(--muted)] leading-tight">
                Lending &amp; credit risk prototype
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-white"
                      : "px-3 py-1.5 rounded-md text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
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
