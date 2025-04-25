"use client"

import { TabNavigation, TabNavigationLink } from "@/components/TabNavigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownUserProfile } from "./UserProfile"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/DropdownMenu"
import { RiMenuLine, RiLogoutBoxLine } from "@remixicon/react"

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
                    {/* Inner orbit (angled) */}
                    <ellipse 
                      cx="12" 
                      cy="12" 
                      rx="5" 
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
                <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  Dacroq
                </span>
              </Link>

              {/* Desktop Navigation Links */}
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
                    href="/monitor"
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname.startsWith("/monitor") 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Monitor
                  </Link>
               
                  <Link 
                    href="/tools"
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname.startsWith("/tools") 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Tools
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


                  <Link 
                    href="/feedback"
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname.startsWith("/docs") 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Feedback
                  </Link>

                  <Link 
                    href="/sitemap"
                    className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                      ${pathname.startsWith("/docs") 
                        ? "border-blue-500 text-gray-900 dark:text-white" 
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                      }`}
                  >
                    Sitemap
                  </Link>
                  

                 


                </div>
              </nav>
            </div>

            {/* Menu Dropdown Button (Mobile) */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                  <span className="sr-only">Open menu</span>
                  <RiMenuLine className="h-6 w-6" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <Link href="/" className="flex w-full">
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem>
                    <Link href="/monitor" className="flex w-full">
                      Monitor
                    </Link>
                  </DropdownMenuItem>
                 
                  <DropdownMenuItem>
                    <Link href="/tools" className="flex w-full">
                      Tools
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem>
                    <Link href="/docs" className="flex w-full">
                      Docs
                    </Link>
                  </DropdownMenuItem>


                  <DropdownMenuItem>
                    <Link href="/feedback" className="flex w-full">
                      Feedback
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/sitemap" className="flex w-full">
                      Sitemap
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
                    <Link href="/login" className="flex w-full items-center">
                      <RiLogoutBoxLine className="mr-2 h-4 w-4" />
                      Sign Out
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Desktop Sign Out Button */}
              <div className="hidden md:flex items-center ml-4">
                <Link 
                  href="/login"
                  className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors flex items-center"
                >
                  <RiLogoutBoxLine className="mr-2 h-4 w-4" />
                  Sign Out
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Navigation }