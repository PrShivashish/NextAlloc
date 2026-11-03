// client/src/pages/HomePage.tsx
import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { IndiaMap } from "@/components/IndiaMap";
import { SuccessStories } from "@/components/SuccessStories";
import { NotificationTicker } from "@/components/NotificationTicker";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, GraduationCap, Building2, Shield, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthProvider";

const IMAGE_CREDITS = [
  { imgUrl: "/images/meow.png", content: "Teamwork & collaboration" },
  { imgUrl: "/images/office.jpeg", content: "Interns working at an office centre" },
  { imgUrl: "/images/modi.jpg", content: "Hon’ble Prime Minister Narendra Modi addressing youth" },
  { imgUrl: "/images/chart.jpg", content: "Economic growth- India's rising opportunities" },
  { imgUrl: "/images/students.jpg", content: "Young Indian students preparing for internships" },
];

// ------------------------
// ImageCarousel component
// (adapted from user-provided Card code; renamed to avoid export conflicts)
// ------------------------
interface CardData {
  id: number;
  imgUrl: string;
  content: string;
}

interface CarouselProps {
  data: CardData[];
  showCarousel?: boolean;
  cardsPerView?: number;
}

const ImageCarousel = ({ data, showCarousel = true, cardsPerView = 3 }: CarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSingleCard, setIsSingleCard] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsSingleCard(data?.length === 1);
  }, [data]);

  // AUTO-ROTATE
  useEffect(() => {
    if (!showCarousel || data.length <= cardsPerView) return;

    let interval = setInterval(() => {
      nextSlide();
    }, 3000); // 3 seconds — change to whatever you like

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, data, showCarousel, cardsPerView]);

  // Calculate width percentage for each card based on cardsPerView
  const cardWidth = 75 / cardsPerView;

  const nextSlide = () => {
    if (isAnimating || !showCarousel || !data) return;
    if (data.length <= cardsPerView) return;

    setIsAnimating(true);
    const nextIndex = (currentIndex + 1) % data.length;

    if (containerRef.current) {
      containerRef.current.style.transition = "transform 500ms ease";
      containerRef.current.style.transform = `translateX(-${cardWidth}%)`;

      setTimeout(() => {
        setCurrentIndex(nextIndex);
        if (containerRef.current) {
          containerRef.current.style.transition = "none";
          containerRef.current.style.transform = "translateX(0)";
          // Force reflow
          void containerRef.current.offsetWidth;
          setIsAnimating(false);
        }
      }, 500);
    }
  };

  const prevSlide = () => {
    if (isAnimating || !showCarousel || !data) return;
    if (data.length <= cardsPerView) return;

    setIsAnimating(true);
    const prevIndex = (currentIndex - 1 + data.length) % data.length;

    if (containerRef.current) {
      // First move instantly to the right position
      containerRef.current.style.transition = "none";
      containerRef.current.style.transform = `translateX(-${cardWidth}%)`;

      // Update the index immediately
      setCurrentIndex(prevIndex);

      // Force reflow
      void containerRef.current.offsetWidth;

      // Then animate back to center
      containerRef.current.style.transition = "transform 500ms ease";
      containerRef.current.style.transform = "translateX(0)";

      setTimeout(() => {
        setIsAnimating(false);
      }, 500);
    }
  };

  // Calculate which cards to show
  const getVisibleCards = () => {
    if (!showCarousel || !data) return data || [];

    const visibleCards: CardData[] = [];
    const totalCards = data.length;

    // For next slide animation, we need current cards + 1 extra
    for (let i = 0; i < cardsPerView + 1; i++) {
      const index = (currentIndex + i) % totalCards;
      visibleCards.push(data[index]);
    }

    return visibleCards;
  };

  if (!data || data.length === 0) {
    return <div>No card data available</div>;
  }

  return (
    <div className="w-full px-4" onMouseEnter={() => setIsAnimating(true)} onMouseLeave={() => setIsAnimating(false)}>
      <div className={`relative ${isSingleCard ? "max-w-sm mx-auto" : "w-full"}`}>
        {/* Carousel Controls */}
        {showCarousel && data.length > cardsPerView && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-all duration-300"
              disabled={isAnimating}
              aria-label="Previous slide"
            >
              &lt;
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-all duration-300"
              disabled={isAnimating}
              aria-label="Next slide"
            >
              &gt;
            </button>
          </>
        )}

        {/* Cards Container Wrapper - limits visible area */}
        <div className="overflow-hidden">
          {/* Sliding Cards Container */}
          <div
            ref={containerRef as any}
            className="flex"
            style={{
              transform: "translateX(0)",
              width: showCarousel ? `${(cardsPerView + 1) * 100 / cardsPerView}%` : "100%",
            }}
          >
            {getVisibleCards().map((card, idx) => (
              <div
                key={`card-${currentIndex}-${idx}`}
                style={{
                  width: showCarousel ? `${100 / (cardsPerView + 1)}%` : `${100 / Math.min(cardsPerView, data.length)}%`,
                }}
                className="px-2"
              >
                <div className="relative overflow-hidden rounded-lg shadow-md group h-full">
                  <div className="w-full h-64">
                    <img src={card.imgUrl} alt={card.content} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-0 bg-black/80 text-white p-4 transition-transform duration-300 transform translate-y-full group-hover:translate-y-0 overflow-y-auto">
                    <p className="text-sm">{card.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------
// HomePage component
// ------------------------
export default function HomePage(): JSX.Element {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  function enterPortal(key: "student" | "company" | "admin", path: string) {
    try {
      // Always update the portal selection to allow switching
      sessionStorage.setItem("portalSelected", key);
    } catch (e) {
      console.warn("enterPortal/sessionStorage error:", e);
    }
    setLocation(path);
  }

  // map IMAGE_CREDITS to CardData format
  const carouselData: CardData[] = IMAGE_CREDITS.map((it, idx) => ({
    id: idx + 1,
    imgUrl: it.imgUrl,
    content: it.content,
  }));

  return (
    <div className="min-h-screen pb-12 relative">
      {/* Background gradient layer – full bleed behind everything */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-purple-950 dark:to-blue-900" />

      {/* ⚠️ HACKATHON DEMO BANNER — clearly marks this as a non-official demo */}
      <div className="w-full bg-amber-500 text-black text-center py-2 px-4 text-sm font-semibold z-50 relative">
        ⚠️ HACKATHON DEMO — This is a Smart India Hackathon (SIH 2024) prototype. NOT an official Government of India portal. No real data is collected.
      </div>

      <Header />

      <section className="py-12 md:py-20 relative z-10">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Internship Matching
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Launch Your Career with <span className="text-primary">PM Internship Scheme</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              India's largest AI-powered internship allocation platform connecting talented students with top companies across the nation
            </p>
          </motion.div>
        </div>
      </section>

      <StatsBar />

      <section className="py-16 relative z-10">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Internships Across India</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Explore opportunities in major cities and emerging tech hubs nationwide</p>
          </motion.div>

          {/* India Map with Interactive States */}
          <div className="space-y-6">
            {/* Interactive India Map */}
            <motion.div initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 shadow-lg">
                <IndiaMap />
              </div>
            </motion.div>

            {/* ImageCarousel */}
            <motion.div id="image-carousel-section" initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="mt-4 overflow-hidden rounded-xl border bg-card/50 backdrop-blur-sm py-6 shadow">
                <ImageCarousel data={carouselData} showCarousel={true} cardsPerView={3} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 relative z-10">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Simple steps to your dream internship</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Register & Verify",
                description: "Create your profile and verify your identity through DigiLocker",
                icon: GraduationCap,
              },
              {
                step: "02",
                title: "AI Matching",
                description: "Our AI analyzes your skills and preferences to find perfect matches",
                icon: Sparkles,
              },
              {
                step: "03",
                title: "Get Placed",
                description: "Companies review your profile and extend offers for internships",
                icon: Building2,
              },
            ].map((item, index) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <Card className="h-full hover-elevate text-center" data-testid={`card-step-${item.step}`}>
                  <CardContent className="p-8">
                    <div className="text-5xl font-bold text-primary/20 mb-4">{item.step}</div>
                    <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                      <item.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SuccessStories />

      <section id="portals-section" className="py-16 relative z-10">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Portal</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Select the appropriate portal to get started with the PM Internship Scheme</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card onClick={() => enterPortal("student", "/student")} className="h-full hover-elevate group cursor-pointer" data-testid="card-student-portal" aria-label="Enter Student Portal">
                <CardContent className="p-6">
                  <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900 w-fit mb-4 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Student Portal</h3>
                  <p className="text-muted-foreground mb-4">Register, build your profile, and discover internships matched to your skills</p>
                  <Button variant="ghost" className="gap-2 p-0 h-auto">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <Card onClick={() => enterPortal("company", "/company")} className="h-full hover-elevate group cursor-pointer" data-testid="card-company-portal" aria-label="Enter Company Portal">
                <CardContent className="p-6">
                  <div className="p-4 rounded-lg bg-purple-100 dark:bg-purple-900 w-fit mb-4 group-hover:scale-105 transition-transform">
                    <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Company Portal</h3>
                  <p className="text-muted-foreground mb-4">Post roles, review AI-shortlisted candidates, and manage your intern pipeline</p>
                  <Button variant="ghost" className="gap-2 p-0 h-auto">
                    Register Company <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <Card onClick={() => enterPortal("admin", "/admin")} className="h-full hover-elevate group cursor-pointer" data-testid="card-admin-portal" aria-label="Enter Admin Portal">
                <CardContent className="p-6">
                  <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900 w-fit mb-4 group-hover:scale-105 transition-transform">
                    <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Admin Portal</h3>
                  <p className="text-muted-foreground mb-4">Government oversight dashboard for monitoring and policy management</p>
                  <Button variant="ghost" className="gap-2 p-0 h-auto">
                    Admin Access <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* About This Demo Section */}
      <section id="mobile-app-section" className="py-16 relative z-10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-8">
              <h2 className="text-2xl font-bold mb-4 text-amber-800 dark:text-amber-300">
                📋 About This Project
              </h2>
              <p className="text-muted-foreground mb-4">
                This is a <strong>Smart India Hackathon (SIH 2024) prototype</strong> built by Team BSoD.
                It demonstrates an AI-powered internship allocation system using a modified
                Gale-Shapley algorithm with LightGBM scoring and fairness-based boosting.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>This is NOT an official Government of India portal.</strong> All data shown is
                synthetic and for demonstration purposes only. No real Aadhaar numbers, personal
                information, or government data is collected or stored.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <NotificationTicker />

      {/* Footer */}
      <Footer />

    </div>
  );
}
