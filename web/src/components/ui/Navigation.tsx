"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  RiArrowDownSLine,
  RiUser3Line,
  RiLogoutBoxRLine,
  RiHistoryLine,
  RiDashboardLine,
  RiSettings4Line,
  RiMenuLine,
  RiCloseLine,
  RiAdminLine,
  RiFeedbackLine,
  RiCpuLine
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/app/siteConfig";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const [userData, setUserData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get user data from localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUserData(parsedUser);
      setIsAdmin(parsedUser.role === "admin");
    }
  }, []);

  const handleSignOut = () => {
    sessionStorage.setItem("intentionalLogout", "true");
    window.location.href = "/login";
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as Element).closest('#user-menu')) {
        setUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  // Add scroll effect for navbar background
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Desktop Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm dark:bg-gray-900/95" : "bg-white dark:bg-gray-900"
      }`}>
        <nav className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-1.5 h-8 mr-10">
              <RiCpuLine className="size-5 text-gray-700 dark:text-gray-300" />
              <span className="font-medium text-gray-900 dark:text-white text-base tracking-tight">Dacroq</span>
            </Link>

            {/* Main Navigation - Desktop */}
            <div className="hidden md:flex gap-6">
              <Link 
                href={siteConfig.baseLinks.monitor} 
                className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors ${
                  pathname === siteConfig.baseLinks.monitor ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <RiDashboardLine className="size-4" />
                Dashboard
              </Link>
              
              <Link 
                href={siteConfig.baseLinks.testHistory} 
                className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors ${
                  pathname === siteConfig.baseLinks.testHistory ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <RiHistoryLine className="size-4" />
                History
              </Link>
              
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className={`flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors ${
                    pathname === '/admin' ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  <RiAdminLine className="size-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button 
              type="button" 
              onClick={() => setMobileMenuOpen(true)}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <RiMenuLine className="size-5" />
            </button>
          </div>

          {/* User Section */}
          {userData && (
            <div className="relative hidden md:block">
              <button
                id="user-menu"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center whitespace-nowrap gap-2"
              >
                {userData.photoURL ? (
                  <img
                    src={userData.photoURL}
                    alt={userData.displayName}
                    className="h-8 w-8 rounded-full mr-2"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-2 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    <RiUser3Line className="size-4" />
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{userData.displayName}</p>
                </div>
                <RiArrowDownSLine className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''} text-gray-500`} />
              </button>
              
              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white shadow-lg rounded-md border border-gray-100 py-1 z-50 dark:bg-gray-800 dark:border-gray-700">
                  {userData && (
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{userData.email}</p>
                    </div>
                  )}

                  <div className="py-1">
                    <Link 
                      href={siteConfig.baseLinks.settings} 
                      className="flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                    >
                      <RiSettings4Line className="mr-3 size-4 text-gray-500 dark:text-gray-400" />
                      Settings
                    </Link>
                    <Link 
                      href={siteConfig.baseLinks.feedback} 
                      className="flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
                    >
                      <RiFeedbackLine className="mr-3 size-4 text-gray-500 dark:text-gray-400" />
                      Feedback
                    </Link>
                  </div>
                  <div className="py-1 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 w-full text-left dark:text-gray-300 dark:hover:bg-gray-700/50"
                    >
                      <RiLogoutBoxRLine className="mr-3 size-4 text-gray-500 dark:text-gray-400" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
          <div className="container mx-auto p-4 h-full flex flex-col">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between mb-4">
              {/* Brand */}
              <Link href="/" className="flex items-center gap-1.5">
                <RiCpuLine className="size-5 text-gray-700 dark:text-gray-300" />
                <span className="font-medium text-gray-900 dark:text-white text-base">Dacroq</span>
              </Link>

              {/* Close Button */}
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-600 dark:text-gray-300">
                <RiCloseLine className="size-5" />
              </button>
            </div>

            {/* User Info - Mobile */}
            {userData && (
              <div className="mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center">
                  {userData?.photoURL ? (
                    <img 
                      src={userData.photoURL} 
                      alt="User" 
                      className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 mr-3"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3 text-gray-600 dark:text-gray-400">
                      <RiUser3Line className="size-4" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{userData.displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Nav Links */}
            <nav className="space-y-1 flex-1">
              <Link 
                href={siteConfig.baseLinks.monitor} 
                className={`flex items-center px-3 py-2 rounded-md ${
                  pathname === siteConfig.baseLinks.monitor ? 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <RiDashboardLine className="mr-3 size-4" />
                Dashboard
              </Link>
              
              <Link 
                href={siteConfig.baseLinks.testHistory} 
                className={`flex items-center px-3 py-2 rounded-md ${
                  pathname === siteConfig.baseLinks.testHistory ? 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <RiHistoryLine className="mr-3 size-4" />
                History
              </Link>
              
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className={`flex items-center px-3 py-2 rounded-md ${
                    pathname === '/admin' ? 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <RiAdminLine className="mr-3 size-4" />
                  Admin
                </Link>
              )}

              {/* Secondary Links */}
              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                <Link 
                  href={siteConfig.baseLinks.settings} 
                  className="flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <RiSettings4Line className="mr-3 size-4" />
                  Settings
                </Link>
                
                <Link 
                  href={siteConfig.baseLinks.feedback} 
                  className="flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <RiFeedbackLine className="mr-3 size-4" />
                  Feedback
                </Link>
              </div>
            </nav>

            {/* Sign Out - Mobile */}
            <div className="py-3 border-t border-gray-100 dark:border-gray-800">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full"
              >
                <RiLogoutBoxRLine className="size-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer to push content below fixed header */}
      <div className="h-14"></div>
    </>
  );
}