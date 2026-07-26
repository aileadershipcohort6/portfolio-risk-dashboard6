import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AnalysisProvider } from "@/context/AnalysisContext";

export const metadata: Metadata = {
  title: "Portfolio Risk Dashboard",
  description:
    "Executive lending portfolio risk dashboard prototype — client-side risk scoring, Green/Amber/Red categorisation and exposure analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AnalysisProvider>
          <NavBar />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
            <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-center text-xs text-[var(--muted)]">
              Prototype for internal review only. No real customer data. All
              processing happens locally in your browser — nothing is uploaded to
              a server.
            </p>
          </footer>
        </AnalysisProvider>
      </body>
    </html>
  );
}
