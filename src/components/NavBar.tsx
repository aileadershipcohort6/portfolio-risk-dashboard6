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
      <div className="h-[3px] w-full bg-[var(--accent)]" />
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]"
              aria-hidden="true"
            >
              <div className="h-2.5 w-2.5 rounded-sm bg-[var(--surface)]" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold sm:text-base">
                Portfolio Risk Dashboard
              </div>
              <div className="text-xs text-[var(--muted)]">
                Lending &amp; credit risk prototype
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent)] font-medium text-white"
                      : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                  }`}
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
