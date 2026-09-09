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
    default: "Milo — your thoughtful reply coach",
    template: "%s · Milo",
  },
  description:
    "Upload a dating-chat screenshot and get three natural, editable reply ideas without storing your conversation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request rendering is required for Next.js to attach the CSP nonce to
  // its framework scripts and generated style elements.
  await connection();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${jakarta.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
