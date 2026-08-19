import type { Metadata } from "next";
import { Cormorant_Garamond, Cinzel, Jost } from "next/font/google";
import "./globals.css";

// Matches the Forge Digital brand type system seeded in
// packages/db/prisma/seed.ts (THEME_TOKENS) — headline/label/body, same as
// the widget and the live marketing site.
const fontHeadline = Cormorant_Garamond({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const fontLabel = Cinzel({
  variable: "--font-label",
  subsets: ["latin"],
  weight: ["500"],
});

const fontBody = Jost({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Forge Platform",
  description: "Forge Digital AI growth-consultant widget platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontHeadline.variable} ${fontLabel.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
