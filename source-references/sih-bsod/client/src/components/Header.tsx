// client/src/components/Header.tsx

import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, GraduationCap, Building2, Shield, Home } from "lucide-react";
import { Image, Smartphone, Headphones } from "lucide-react";

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // track currently selected portal
  const [portalSelected, setPortalSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPortalSelected(sessionStorage.getItem("portalSelected"));
    } catch {
      setPortalSelected(null);
    }

    function onStorage(e: StorageEvent) {
      if (e.key === "portalSelected") {
        try {
          setPortalSelected(sessionStorage.getItem("portalSelected"));
        } catch {
          setPortalSelected(null);
        }
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    { label: "Home", icon: Home, action: () => setLocation("/") },
    { label: "Gallery", icon: Image, action: () => scrollToSection("image-carousel-section") },
    { label: "Portals", icon: Shield, action: () => scrollToSection("portals-section") },
    { label: "Mobile App", icon: Smartphone, action: () => scrollToSection("mobile-app-section") },
    { label: "Support", icon: Headphones, action: () => scrollToSection("contact-section") },
  ];

  function openStudentProfile() {
    try {
      sessionStorage.setItem("portalSelected", "student");
      sessionStorage.setItem("forceProfileOpen", "1");
    } catch { }
    window.location.href = "/student";
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3" data-testid="link-home">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2 L12 22 M2 12 L22 12" stroke="white" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight">PM Internship Scheme</span>
              <span className="text-xs text-muted-foreground">Government of India</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          {showNav && (
            <nav className="hidden md:flex items-center gap-1">

              {/* Always show nav items on homepage, otherwise show portal-specific nav */}
              {location === "/" ? (
                navItems.map((item) => (
                  <Button
                    key={item.label}
                    variant={item.label === "Home" && location === "/" ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                    onClick={item.action}
                    data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))
              ) : portalSelected ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 capitalize">
                    {portalSelected} portal
                  </span>

                  {portalSelected === "student" && (
                    <Button
                      onClick={openStudentProfile}
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      data-testid="header-set-profile"
                    >
                      Set Profile
                    </Button>
                  )}
                </div>
              ) : (
                navItems.map((item) => (
                  <Button
                    key={item.label}
                    variant={item.label === "Home" && location === "/" ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                    onClick={item.action}
                    data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))
              )}

            </nav>
          )}

          {/* Theme / Auth / Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Login and Register buttons - only show on homepage or when not in a portal */}
            {(location === "/" || !portalSelected) && (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}

            <ThemeToggle />

            {showNav && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && showNav && (
          <nav className="md:hidden pb-4 flex flex-col gap-1">

            {/* Always show nav items on homepage, otherwise show portal-specific nav */}
            {location === "/" ? (
              navItems.map((item) => (
                <Button
                  key={item.label}
                  variant={item.label === "Home" && location === "/" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    item.action();
                    setMobileMenuOpen(false);
                  }}
                  data-testid={`mobile-nav-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))
            ) : portalSelected ? (
              <div className="flex flex-col gap-2 px-2">

                <span className="text-sm text-gray-600 capitalize">
                  {portalSelected} portal
                </span>

                {portalSelected === "student" && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openStudentProfile();
                    }}
                  >
                    Set Profile
                  </Button>
                )}
              </div>
            ) : (
              navItems.map((item) => (
                <Button
                  key={item.label}
                  variant={item.label === "Home" && location === "/" ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    item.action();
                    setMobileMenuOpen(false);
                  }}
                  data-testid={`mobile-nav-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))
            )}

          </nav>
        )}

      </div>
    </header>
  );
}
