// Navigation.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RiShutDownLine, RiHomeLine, RiCpuLine, RiTestTubeLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AnnouncementBanner from "./AnnouncementBanner";
import { ThemeToggle } from "./ThemeToggle";
import { auth, User } from "@/lib/auth";
import { DacroqLogo } from "@/components/DacroqLogo";

/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Home",
    icon: RiHomeLine,
    match: ["/dashboard"],
  },
  {
    href: "/ldpc",
    label: "LDPC",
    icon: RiCpuLine,
    match: ["/ldpc"],
  },
  {
    href: "/sat",
    label: "SAT",
    icon: RiTestTubeLine,
    match: ["/sat"],
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  COMPONENT                                                                 */
/* -------------------------------------------------------------------------- */

export default function Navigation() {
  /* ----------------------------- state / refs ----------------------------- */
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  /* -------------------------------- effect -------------------------------- */

  /* auth listener */
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  /* navbar background on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ------------------------------ callbacks -------------------------------- */

  const isActive = useCallback(
    (item: (typeof NAV_ITEMS)[number]) =>
      item.match.some(
        (slug) => pathname === slug || pathname.startsWith(`${slug}/`)
      ),
    [pathname]
  );

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem("intentionalLogout", "true");
      setConfirmLogout(false); // Close dialog first
      await auth.signOut();
      router.push("/login"); // Use Next.js router instead of window.location
    } catch (error) {
      console.error("Error during logout:", error);
      // Still redirect on error
      router.push("/login");
    }
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <>
      {/* Desktop Navigation */}
      <header
        className={`fixed inset-x-0 top-0 z-50 hidden sm:block h-14 border-b transition-all duration-200 ${
          scrolled
            ? "bg-background/95 backdrop-blur-md shadow-sm border-border"
            : "bg-background border-border"
        }`}
      >
        <nav className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          {/* Left side: Logo + Navigation */}
          <div className="flex h-full items-center gap-8">
            {/* Brand */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <DacroqLogo className="h-5 w-5 text-foreground" />
              <span className="text-lg font-semibold text-foreground">
                Dacroq
              </span>
            </Link>

            {/* Main nav links */}
            {user && (
              <div className="flex h-full items-center">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        relative flex items-center h-full px-4 text-sm font-medium transition-all
                        ${active 
                          ? "text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                        }
                      `}
                    >
                      {item.label}
                      {active && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right side: Theme toggle + Sign out */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && (
              <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <RiShutDownLine className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-popover text-popover-foreground border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">
                      Sign out?
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      You'll be redirected to the login page.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="border-border"
                      onClick={() => setConfirmLogout(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile Navigation - Top Bar */}
      <header
        className={`fixed inset-x-0 top-0 z-50 sm:hidden h-14 border-b transition-all duration-200 ${
          scrolled
            ? "bg-background/95 backdrop-blur-md shadow-sm border-border"
            : "bg-background border-border"
        }`}
      >
        <nav className="relative flex h-full items-center justify-between px-4">
          {/* Left: Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <DacroqLogo className="h-5 w-5 text-foreground" />
            <span className="text-lg font-semibold text-foreground">
              Dacroq
            </span>
          </Link>

          {/* Right: Theme toggle + Sign out */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user && (
              <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <RiShutDownLine className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-popover text-popover-foreground border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">
                      Sign out?
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      You'll be redirected to the login page.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="border-border"
                      onClick={() => setConfirmLogout(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </nav>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Mobile Navigation - Bottom Tab Bar */}
      {user && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background border-t border-border">
            <nav className="flex items-center justify-around h-16">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors
                      ${active 
                        ? "text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                    <span className={`text-xs ${active ? "font-medium" : ""}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Additional spacer for mobile bottom nav - only when user is logged in */}
          <div className="h-16 sm:hidden" />
        </>
      )}
    </>
  );
}