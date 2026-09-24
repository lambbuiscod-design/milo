import type { Metadata } from "next";
import { connection } from "next/server";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Milo — Your AI Companion",
    template: "%s · Milo",
  },
  description:
    "Milo is a private, intelligent desktop companion that lives with you. It helps you work, learn and focus — while keeping everything personal and under your control.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${jakarta.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full" style={{ background: "#060a10", color: "#e2e8f0" }}>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
