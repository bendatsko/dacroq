// Navigation.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RiShutDownLine } from "@remixicon/react";
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
    mobileLabel: "Home",
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
            {/* left side: logo + navigation links (desktop only) */}
            <div className="flex h-full items-center">
              {/* brand */}
              <Link href="/dashboard" className="mr-4 sm:mr-6 flex h-[27px] items-center">
                <DacroqLogo className="h-4 w-4 text-foreground/95" />
                <span className="text-md font-semibold text-foreground/95">
                  Dacroq
                </span>
              </Link>

              {/* main nav – desktop only */}
              <div className="hidden sm:flex h-full items-center gap-1">
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

            {/* right side: navigation links (mobile) + theme + sign-out */}
            <div className="flex h-full items-center gap-2">
              {/* main nav – mobile only */}
              <div className="flex sm:hidden h-full items-center gap-1">
                {user &&
                    NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={linkClasses(
                                isActive(item),
                                "inline-flex items-center h-[27px] px-2 text-xs font-medium rounded-md transition-colors"
                            )}
                        >
                          {item.label}
                        </Link>
                    ))}
              </div>

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

        {/* spacer */}
        <div className="h-11" />
      </>
  );
}