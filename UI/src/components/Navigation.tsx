// Navigation.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RiShutDownLine, RiMenuLine } from "@remixicon/react";
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
    label: "Dashboard",
    mobileLabel: "Dashboard",
    match: ["/dashboard"],
  },
  {
    href: "/ldpc",
    label: "LDPC",
    mobileLabel: "LDPC",
    match: ["/ldpc"],
  },
  {
    href: "/sat",
    label: "SAT",
    mobileLabel: "SAT",
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
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const linkClasses = (active: boolean, base: string) =>
      active
          ? `${base} text-foreground bg-accent`
          : `${base} text-muted-foreground hover:text-foreground hover:bg-accent`;

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
        {/* top-nav */}
        <header
            className={`fixed inset-x-0 top-0 z-50 h-11 border-b transition-all duration-200 ${
                scrolled
                    ? "bg-background/80 backdrop-blur-md shadow-sm border-border"
                    : "bg-card border-border"
            }`}
        >

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-t from-foreground/5 to-transparent" />
          </div>

          <nav className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-6">
            {/* logo + desktop links */}
            <div className="flex h-full items-center">
              {/* brand */}
              <Link href="/dashboard" className="mr-8 flex h-[27px] items-center">
                <DacroqLogo className="h-4 w-4 text-foreground/95" />
                <span className="text-md font-semibold text-foreground/95">
                  Dacroq
                </span>
              </Link>

              {/* main nav – desktop */}
              <div className="hidden h-full items-center gap-6 md:flex">
                {user &&
                    NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={linkClasses(
                                isActive(item),
                                "inline-flex items-center h-[27px] px-3 text-sm font-medium rounded-md transition-colors"
                            )}
                        >
                          {item.label}
                        </Link>
                    ))}
              </div>
            </div>


            {/* mobile menu button */}
            <div className="flex h-full items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex items-center h-[27px] px-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
              >
                <RiMenuLine className="h-4 w-4" />
              </button>
            </div>

            {/* theme + sign-out */}
            <div className="hidden h-full items-center gap-2 md:flex">
              <ThemeToggle />
              {user && (
                  <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
                    <DialogTrigger asChild>
                      <button className="inline-flex items-center h-[27px] px-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent">
                        <RiShutDownLine className="h-4 w-4" />
                      </button>
                    </DialogTrigger>

                    <DialogContent className="bg-popover text-popover-foreground border-border">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">
                          Are you sure you want to log out?
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          You'll be redirected to the login page.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex justify-end gap-3">
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
                          OK
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
              )}
            </div>
          </nav>
        </header>

        {/* mobile sheet */}
        {mobileOpen && (
            <>
              {/* backdrop */}
              <div 
                className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setMobileOpen(false)}
              />
              
              {/* mobile menu panel */}
              <div className="fixed inset-x-0 top-0 z-[70] bg-background/95 backdrop-blur-md border-b border-border shadow-lg animate-in slide-in-from-top duration-300 ease-out">
                {/* Gradient effects matching navbar */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-t from-foreground/5 to-transparent" />
                </div>
                
                <div className="relative mx-auto max-w-7xl">
                  {/* Mobile menu header - matches navbar structure */}
                  <div className="flex h-11 items-center justify-between px-6 border-b border-border/50">
                    {/* Logo section - matches navbar */}
                    <Link 
                      href="/dashboard" 
                      className="flex h-[27px] items-center transition-colors hover:opacity-80"
                      onClick={() => setMobileOpen(false)}
                    >
                      <DacroqLogo className="h-5 w-5 text-foreground/95" />
                      <span className="ml-1 mt-0.5 text-sm font-semibold text-foreground/95 leading-none flex items-center">
                        Dacroq
                      </span>
                    </Link>

                    {/* Close button - matches navbar button styling */}
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex items-center h-[27px] px-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-all duration-200"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Navigation links */}
                  <div className="px-6 py-4 space-y-1">
                    {user &&
                      NAV_ITEMS.map((item, index) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={linkClasses(
                            isActive(item),
                            "flex items-center h-10 px-3 text-sm font-medium rounded-md transition-all duration-200 animate-in slide-in-from-left"
                          )}
                          style={{
                            animationDelay: `${(index + 1) * 50}ms`,
                            animationFillMode: 'both'
                          }}
                        >
                          {item.mobileLabel}
                        </Link>
                      ))}

                    {/* Sign out button - matches other navigation styling */}
                    {user && (
                      <button
                        onClick={() => {
                          setMobileOpen(false);
                          handleSignOut();
                        }}
                        className="flex items-center h-10 px-3 w-full text-left text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md transition-all duration-200 animate-in slide-in-from-left"
                        style={{
                          animationDelay: `${(NAV_ITEMS.length + 1) * 50}ms`,
                          animationFillMode: 'both'
                        }}
                      >
                        <RiShutDownLine className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
        )}

        {/* spacer */}
        <div className="h-11" />
      </>
  );
}