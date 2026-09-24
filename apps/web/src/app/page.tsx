import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { MoodSection } from "@/components/landing/mood-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { DesktopDemoSection } from "@/components/landing/desktop-demo-section";
import { MilosRoomSection } from "@/components/landing/milos-room-section";
import { FocusProgressSection } from "@/components/landing/focus-progress-section";
import { PrivacySection } from "@/components/landing/privacy-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Milo — Your AI Companion",
  description:
    "Milo is a private, intelligent desktop companion that lives with you. It helps you work, learn and focus — while keeping everything personal and under your control.",
  openGraph: {
    title: "Milo — Your AI Companion",
    description: "A small, private AI that lives on your desktop. Not another chatbot.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <main
      id="main-content"
      className="overflow-x-hidden outline-none bg-noise bg-[#050505]"
      tabIndex={-1}
    >
      {/* Navigation */}
      <LandingNav />

      {/* 1. Immersive Hero */}
      <HeroSection />

      {/* 2. Meet Milo / Emotions */}
      <MoodSection />

      {/* 3. Feature Bento */}
      <FeaturesSection />

      {/* 4. Interactive Desktop Demo */}
      <DesktopDemoSection />

      {/* 5. Milo's Room */}
      <MilosRoomSection />

      {/* 6. Focus & Progress */}
      <FocusProgressSection />

      {/* 7. Privacy */}
      <PrivacySection />

      {/* 8. How It Works */}
      <HowItWorksSection />

      {/* 9. Use Cases */}
      <UseCasesSection />

      {/* 10. Final CTA */}
      <FinalCtaSection />

      {/* Footer */}
      <LandingFooter />
    </main>
  );
}
