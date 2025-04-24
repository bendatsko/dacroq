"use client"

import { TabNavigation, TabNavigationLink } from "@/components/TabNavigation"
import Link from "next/link"
import { Notifications } from "./Notifications"
import { usePathname } from "next/navigation"
import { DropdownUserProfile } from "./UserProfile"

function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Top navigation bar with logo and utilities */}
      <div className="bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and main navigation */}
            <div className="flex items-center gap-4">
              {/* Logo with quantum icon */}
              <Link href="/" className="flex items-center ">
                <span className="sr-only">Dacroq</span>
                <div className="relative h-8 w-8 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    className="h-8 w-8 text-blue-600 dark:text-blue-400"
                  >
                    {/* Circular orbit */}
               
                    
                    {/* Inner orbit (angled) */}
                    <ellipse 
                      cx="12" 
                      cy="12" 
                      rx="6" 
                      ry="10" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      className="opacity-70"
                      transform="rotate(45, 12, 12)"
                    />
                    
                    {/* Core (qubit) */}
                    <circle 
                      cx="12" 
                      cy="12" 
                      r="3" 
                      fill="currentColor" 
                      className="opacity-90"
                    />
                  </svg>
                </div>
                <span className="ml-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  Dacroq
                </span>
              </Link>

              {/* Main navigation links */}
              <nav className="hidden md:flex">
                <div className="flex h-16 space-x-4">
                  <Link 
                    href="/" 
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname === "/" 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Dashboard
                  </Link>

                  <Link 
                    href="/docs"
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname.startsWith("/docs") 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Docs
                  </Link>
                </div>
              </nav>
            </div>

            {/* Right side - utility links and user controls */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center">
                <Link 
                  href="/feedback"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  Feedback
                </Link>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700"></div>
                <DropdownUserProfile />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation - only shown on smaller screens */}
      <div className="md:hidden bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <TabNavigation className="border-t-0 pb-1">
            <TabNavigationLink
              className="inline-flex gap-1 text-sm py-3"
              asChild
              active={pathname === "/"}
            >
              <Link href="/">Dashboard</Link>
            </TabNavigationLink>

            <TabNavigationLink
              className="inline-flex gap-1 text-sm py-3"
              asChild
              active={pathname.startsWith("/docs")}
            >
              <Link href="/docs">Docs</Link>
            </TabNavigationLink>

            <TabNavigationLink
              className="inline-flex gap-1 text-sm py-3"
              asChild
              active={pathname === "/feedback"}
            >
              <Link href="/feedback">Feedback</Link>
            </TabNavigationLink>
          </TabNavigation>
        </div>
      </div>
    </>
  )
}

export { Navigation }