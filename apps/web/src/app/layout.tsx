import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
