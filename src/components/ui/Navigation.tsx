"use client"

import { TabNavigation, TabNavigationLink } from "@/components/TabNavigation"
import Link from "next/link"
import { Notifications } from "./Notifications"
import { usePathname } from "next/navigation"
import { DropdownUserProfile } from "./UserProfile"
import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

function Navigation() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Parse pathname to get location for breadcrumb
  const getLocationInfo = () => {
    // Remove leading slash and split path
    const pathParts = pathname.substring(1).split('/');
    
    // If we're at root, just show dashboard
    if (pathname === '/') {
      return { main: 'Dashboard', sub: null };
    }
    
    // Get main section (first part of path)
    let main = pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1);
    
    // Get sub section (rest of path if exists)
    let sub = null;
    if (pathParts.length > 1) {
      sub = pathParts.slice(1).join('/');
      // Capitalize and format sub section
      sub = sub.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    
    return { main, sub };
  }
  
  const location = getLocationInfo();

  useEffect(() => {
    // Set up auth state change listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true)

      if (user) {
        try {
          // Fetch user data from Firestore
          const userRef = doc(db, "users", user.uid)
          const userSnap = await getDoc(userRef)

          if (userSnap.exists()) {
            const userData = userSnap.data()
            // Check if user has admin role
            setIsAdmin(userData.role === "admin")
          } else {
            // User document doesn't exist
            setIsAdmin(false)
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
          setIsAdmin(false)
        }
      } else {
        // User is not logged in
        setIsAdmin(false)
      }

      setIsLoading(false)
    })

    // Clean up subscription on unmount
    return () => unsubscribe()
  }, [])

  return (
    <>
      {/* Top navigation bar with logo and utilities */}
      <div className="bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and main navigation */}
            <div className="flex items-center gap-8">
              {/* Logo with quantum icon */}
              <Link href="/" className="flex items-center">
                <span className="sr-only">Dacroq</span>
                <div className="relative h-8 w-8 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    className="h-8 w-8 text-blue-600 dark:text-blue-400"
                  >
                    {/* Circular orbit */}
                    <circle 
                      cx="12" 
                      cy="12" 
                      r="8" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      className="opacity-50"
                    />
                    
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
                <span className="ml-2 text-lg font-medium tracking-tight text-gray-900 dark:text-white">
                  Dacroq
                </span>
              </Link>

              {/* Main navigation links */}
              <nav className="hidden md:flex items-center space-x-8">
                <Link 
                  href="/" 
                  className={`inline-flex items-center text-sm font-medium transition-colors 
                    ${pathname === "/" 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    }`}
                >
                  Overview
                </Link>

                <Link 
                  href="/tools"
                  className={`inline-flex items-center text-sm font-medium transition-colors 
                    ${pathname === "/tools" 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    }`}
                >
                  Tools
                </Link>

                <Link 
                  href="/monitoring"
                  className={`inline-flex items-center text-sm font-medium transition-colors 
                    ${pathname === "/monitoring" 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                    }`}
                >
                  Monitoring
                </Link>

          

              </nav>
            </div>

            {/* Right side - utility links and user controls */}
            <div className="flex items-center space-x-4">
              {/* Additional links */}
              <div className="hidden md:flex items-center space-x-4">
                <Link 
                  href="/feedback"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                >
                  Feedback
                </Link>
                <Link 
                  href="/changelog"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                >
                  Changelog
                </Link>
                <Link 
                  href="/help"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                >
                  Help
                </Link>
                <Link 
                  href="/docs"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                >
                  Docs
                </Link>
              </div>
              <Notifications />
              <DropdownUserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation - only shown on smaller screens */}
      <div className="md:hidden bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <TabNavigation className="border-t-0 pb-2">
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
              active={pathname === "/tools"}
            >
              <Link href="/tools">Tools</Link>
            </TabNavigationLink>

            <TabNavigationLink
              className="inline-flex gap-1 text-sm py-3"
              asChild
              active={pathname === "/monitoring"}
            >
              <Link href="/monitoring">Monitoring</Link>
            </TabNavigationLink>

            <TabNavigationLink
              className="inline-flex gap-1 text-sm py-3"
              asChild
              active={pathname === "/documentation"}
            >
              <Link href="/documentation">Docs</Link>
            </TabNavigationLink>

            {isAdmin && (
              <TabNavigationLink
                className="inline-flex gap-1 text-sm py-3"
                asChild
                active={pathname === "/admin"}
              >
                <Link href="/admin">Admin</Link>
              </TabNavigationLink>
            )}
          </TabNavigation>
        </div>
      </div>
      
      {/* Page Header - Location with title and description space */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="py-5">
            <div className="flex items-center">
              <h1 className="text-2xl font-medium text-gray-900 dark:text-white tracking-tight">
                {location.main}
              </h1>
              {location.sub && (
                <div className="flex items-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="mx-2 h-4 w-4 text-gray-400"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="text-2xl font-medium text-gray-900 dark:text-white tracking-tight">
                    {location.sub}
                  </span>
                </div>
              )}
            </div>
            {/* Description placeholder - can be filled by individual pages */}
            <div id="page-description" className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {/* This space can be populated by child pages */}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Navigation }