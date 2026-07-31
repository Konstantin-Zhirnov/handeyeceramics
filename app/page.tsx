import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeatureStrip } from "@/components/FeatureStrip";
import { StatBlock, ImageBand } from "@/components/StatBlock";
import { HowItWorks } from "@/components/HowItWorks";
import { ClassesSection } from "@/components/ClassesSection";
import { Gallery } from "@/components/Gallery";
import { Reviews } from "@/components/Reviews";
import { LocationsSection } from "@/components/LocationsSection";
import { Membership } from "@/components/Membership";
import { Footer, MobileCallBar } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <FeatureStrip />
        <StatBlock />
        <ImageBand />
        <HowItWorks />
        <ClassesSection />
        <Gallery />
        <Reviews />
        <LocationsSection />
        <Membership />
      </main>
      <Footer />
      <MobileCallBar />
    </>
  );
}
