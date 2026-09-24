import { Header } from "@/components/Header";
import { HeroStage } from "@/components/HeroStage";
import { FeatureStrip } from "@/components/FeatureStrip";
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
        <HeroStage />
        <FeatureStrip />
        <ClassesSection />
        <Gallery />
        <Reviews />
        <LocationsSection />
        <Membership />
      </main>
      <Footer />
      <MobileCallBar hideDuringHero />
    </>
  );
}
