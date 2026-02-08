import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { OfflineIndicator } from "@/components/landing/OfflineIndicator";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <section id="demo">
          <DemoSection />
        </section>
        <div className="container mx-auto px-4 py-12">
          <OfflineIndicator />
        </div>
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;