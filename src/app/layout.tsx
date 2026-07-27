import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AnalysisProvider } from "@/context/AnalysisContext";

export const metadata: Metadata = {
  title: "Portfolio Risk Dashboard",
  description:
    "Lending and credit risk prototype — upload a lending policy PDF and a customer portfolio CSV to generate an executive risk dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AnalysisProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-[var(--muted)]">
              Prototype for internal review only. No real customer data. All
              processing happens locally in your browser — nothing is uploaded
              to a server.
            </p>
          </footer>
        </AnalysisProvider>
      </body>
    </html>
  );
}
