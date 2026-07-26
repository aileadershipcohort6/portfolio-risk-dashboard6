"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Upload" },
  { href: "/dashboard", label: "Executive Dashboard" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <div>
      <div className="h-[3px] w-full" style={{ background: "var(--accent)" }} />
      <header className="border-b bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-7 w-7 items-center justify-center rounded"
              style={{ background: "var(--accent)" }}
            >
              <div className="h-3 w-3 rounded-sm" style={{ background: "var(--surface)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Portfolio Risk Dashboard</p>
              <p className="text-xs leading-tight" style={{ color: "var(--muted)" }}>
                Lending &amp; credit risk prototype
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "rounded-md px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-md px-3 py-1.5 text-sm font-medium hover:bg-[var(--background)]"
                  }
                  style={active ? { background: "var(--accent)" } : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </div>
  );
}
