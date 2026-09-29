import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ReadinessScoreSection } from "@/components/landing/readiness-score-section";
import { SeeInActionSection } from "@/components/landing/see-in-action-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { SocialProofSection } from "@/components/landing/social-proof-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CTASection } from "@/components/landing/cta-section";
import { FeedbackSection } from "@/components/landing/feedback-section";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 paper-bg">
        <HeroSection />
        <FeaturesSection />
        <ReadinessScoreSection />
        <SeeInActionSection />
        <ComparisonSection />
        <HowItWorksSection />
        <SocialProofSection />
        <PricingSection />
        <CTASection />
        <FeedbackSection />
      </main>
      <Footer />
    </>
  );
}
