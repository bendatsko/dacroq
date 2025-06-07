"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RiShutDownLine,
  RiHomeLine,
  RiArrowRightSLine,
  RiMoonLine,
  RiSunLine,
  RiComputerLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { auth, User } from "@/lib/auth";
import { DacroqLogo } from "@/components/DacroqLogo";
import { Button } from "@/components/ui/button";
import {
  Dropdownmenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownmenu";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Only show theme-specific icon after hydration to prevent SSR mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Get the appropriate icon based on current theme
  const getIcon = () => {
    if (!mounted) {
      // Show a neutral icon during SSR/before hydration
      return <RiSunLine className="h-[18px] w-[18px]" />;
    }
    
    switch (theme) {
      case "light":
        return <RiSunLine className="h-[18px] w-[18px]" />;
      case "dark":
        return <RiMoonLine className="h-[18px] w-[18px]" />;
      case "system":
        return <RiComputerLine className="h-[18px] w-[18px]" />;
      default:
        return <RiSunLine className="h-[18px] w-[18px]" />;
    }
  };

  return (
    <Dropdownmenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-[27px] px-2 text-muted-foreground hover:text-foreground"
        >
          {getIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-popover text-popover-foreground border-border"
        sideOffset={5}
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RiSunLine className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RiMoonLine className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&:focus]:outline-none [&:focus]:ring-0 [&:focus-visible]:outline-none [&:focus-visible]:ring-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <RiComputerLine className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </Dropdownmenu>
  );
}

/* -------------------------------------------------------------------------- */
/*  COMPONENT                                                                 */
/* -------------------------------------------------------------------------- */

interface PageNavigationProps {
  currentPage: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function PageNavigation({ currentPage, breadcrumbs }: PageNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* -------------------------------- EFFECTS -------------------------------- */

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  // Navbar background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ----------------------------- CALLBACKS --------------------------------- */

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem("intentionalLogout", "true");
      setConfirmLogout(false);
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error during logout:", error);
      router.push("/login");
    }
  };

  /* -------------------------------- RENDER -------------------------------- */

  return (
    <>
      {/* Desktop & Mobile Navigation Header */}
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-200 ${
          scrolled
            ? "bg-background/95 backdrop-blur-md shadow-sm border-border"
            : "bg-background border-border"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-1">
                <DacroqLogo className="h-5 w-5 text-foreground" />
                <span className="text-lg font-semibold text-foreground">Dacroq</span>
              </Link>
            </div>

            {/* Right: Theme + Logout */}
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              {/* Logout */}
              {user && (
                <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      <RiShutDownLine className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sign out?</DialogTitle>
                      <DialogDescription>You'll be redirected to the login page.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                      <Button variant="outline" onClick={() => setConfirmLogout(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSignOut}>Sign out</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </nav>

        {/* Breadcrumbs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <RiHomeLine className="h-4 w-4" />
            </Link>
            {breadcrumbs?.map((crumb, index) => (
              <React.Fragment key={index}>
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
                {crumb.href ? (
                  <Link 
                    href={crumb.href} 
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
            {!breadcrumbs && (
              <>
                <RiArrowRightSLine className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">{currentPage}</span>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
} 