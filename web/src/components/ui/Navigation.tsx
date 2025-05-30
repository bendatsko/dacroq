"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  RiCpuLine,
  RiSettings3Line,
  RiShutDownLine
} from "@remixicon/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import AnnouncementBanner from "./AnnouncementBanner";
import { ThemeToggle } from "./ThemeToggle";
import { auth, User } from "@/lib/auth";

// Define fallback navigation links to avoid undefined href errors
export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const [userData, setUserData] = useState<User | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  // Combine siteConfig with fallback values to prevent undefined hrefs
  const navLinks = {
    dashboard: "/dashboard",
    ldpc: "/ldpc",
    sat: "/sat",
    settings: "/settings"
  };

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserData(user);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem("intentionalLogout", "true");
      await auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error during sign out:", error);
      // Fallback if signOut fails
      window.location.href = "/login";
    }
  };

  // Add scroll effect for navbar background
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    // Add the scroll event listener
    window.addEventListener('scroll', handleScroll);

    // Initial check for page load with scroll already happened
    handleScroll();

    // Clean up the event listener
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
      <>
        {/* Announcement Banner */}
        <AnnouncementBanner />

        {/* Desktop Navigation - Monochromatic Style */}
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 h-11 border-b ${
            scrolled
                ? "bg-background/80 backdrop-blur-md shadow-sm border-border"
                : "bg-card border-border"
        }`}>
          <nav className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
            <div className="flex items-center h-full">
              {/* Brand with icon */}
              <Link href="/dashboard" className="flex items-center mr-8 h-[27px]">
                <RiCpuLine className="h-5 w-5 text-foreground" />
                <span className="ml-2 font-semibold text-foreground text-sm hidden sm:block">Dacroq</span>
              </Link>

              {/* Main Navigation - Desktop */}
              <div className="hidden md:flex items-center gap-6 h-full">
                <Link
                    href={navLinks.dashboard}
                    className={`inline-flex items-center h-[27px] px-3 text-sm font-medium rounded-md transition-colors ${
                        pathname === navLinks.dashboard || pathname.includes('/dashboard')
                            ? 'text-foreground bg-accent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  Dashboard
                </Link>

                <Link
                    href={navLinks.ldpc}
                    className={`inline-flex items-center h-[27px] px-3 text-sm font-medium rounded-md transition-colors ${
                        pathname === navLinks.ldpc || pathname.includes('/ldpc')
                            ? 'text-foreground bg-accent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  LDPC Encoder/Decoder Core
                </Link>

                <Link
                    href={navLinks.sat}
                    className={`inline-flex items-center h-[27px] px-3 text-sm font-medium rounded-md transition-colors ${
                        pathname === navLinks.sat || pathname.includes('/sat')
                            ? 'text-foreground bg-accent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  SAT Solver Core
                </Link>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center h-full">
              <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex items-center h-[27px] px-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
              >
                Menu
              </button>
            </div>

            {/* User Section - Right side with theme toggle */}
            <div className="hidden md:flex items-center gap-2 h-full">
              {/* Theme Toggle */}
              <ThemeToggle />

              {userData && (
                  <>
                    {/* Settings Button */}
                    <Tooltip content="Settings" side="bottom" triggerAsChild={true}>
                      <Link
                          href={navLinks.settings}
                          className="inline-flex items-center h-[27px] px-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                      >
                        <RiSettings3Line className="h-4 w-4" />
                      </Link>
                    </Tooltip>
                    {/* Sign Out Button */}
                    <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
                      <Tooltip content="Sign Out" side="bottom" triggerAsChild={true}>
                        <DialogTrigger asChild>
                          <button
                              className="inline-flex items-center h-[27px] px-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                          >
                            <RiShutDownLine className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                      </Tooltip>
                      <DialogContent className="bg-popover text-popover-foreground border-border">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">Are you sure you want to log out this user?</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            You will be signed out of your account and redirected to the login page.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-3">
                          <Button
                              variant="outline"
                              onClick={() => setShowSignOutDialog(false)}
                              className="border-border"
                          >
                            Cancel
                          </Button>
                          <Button
                              onClick={() => {
                                setShowSignOutDialog(false);
                                handleSignOut();
                              }}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            OK
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
              )}
            </div>
          </nav>
        </header>

        {/* Mobile Navigation - Monochromatic sheet */}
        {mobileMenuOpen && (
            <div className="fixed inset-0 z-60 bg-background">
              <div className="max-w-5xl mx-auto p-4 h-full flex flex-col">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <span className="font-medium text-foreground text-base">Menu</span>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Done
                    </button>
                  </div>
                </div>

                {/* User Info - Mobile */}
                {userData && (
                    <div className="mb-6 pb-4 border-b border-border">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{userData.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                        </div>
                      </div>
                    </div>
                )}

                {/* Mobile Nav Links */}
                <nav className="space-y-2 flex-1">
                  <Link
                      href={navLinks.dashboard}
                      className={`block px-3 py-2 text-base font-medium rounded-md ${
                          pathname === navLinks.dashboard || pathname.includes('/dashboard')
                              ? 'text-foreground bg-accent'
                              : 'text-foreground hover:bg-accent'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  <Link
                      href={navLinks.ldpc}
                      className={`block px-3 py-2 text-base font-medium rounded-md ${
                          pathname === navLinks.ldpc || pathname.includes('/ldpc')
                              ? 'text-foreground bg-accent'
                              : 'text-foreground hover:bg-accent'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                  >
                    LDPC Encoder/Decoder Core
                  </Link>

                  <Link
                      href={navLinks.sat}
                      className={`block px-3 py-2 text-base font-medium rounded-md ${
                          pathname === navLinks.sat || pathname.includes('/sat')
                              ? 'text-foreground bg-accent'
                              : 'text-foreground hover:bg-accent'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                  >
                    Boolean Satisfiability (3SAT/KSAT)
                  </Link>

                  {/* Secondary Links */}
                  <div className="pt-4 mt-4 border-t border-border">
                    <Link
                        href={navLinks.settings}
                        className="block px-3 py-2 text-base font-medium text-foreground hover:bg-accent rounded-md"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                  </div>
                </nav>

                {/* Sign Out - Mobile */}
                <div className="py-4 border-t border-border">
                  <button
                      onClick={handleSignOut}
                      className="w-full py-2 px-3 text-left text-base text-destructive hover:bg-destructive/10 rounded-md"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Spacer to push content below fixed header */}
        <div className="h-11"></div>
      </>
  );
}