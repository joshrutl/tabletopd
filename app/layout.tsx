import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabletopd — track & rate board games",
  description: "A social-first way to log, rate and shelve your board games.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans antialiased">{children}</body>
    </html>
  );
}
