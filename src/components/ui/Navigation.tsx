"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/DropdownMenu"
import { RiMenuLine, RiLogoutBoxLine } from "@remixicon/react"
import { auth } from "@/lib/firebase"

function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  // Handle sign out with intentional logout flag
  const handleSignOut = (e) => {
    e.preventDefault()
    // Set intentional logout flag in session storage
    sessionStorage.setItem("intentionalLogout", "true")
    // Sign out from Firebase
    auth.signOut().then(() => {
      // Navigate to login page
      router.push("/login")
    })
  }

  return (
    <div className="bg-white border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between"> {/* Reduced height from h-16 to h-14 */}
          {/* Logo and main navigation */}
          <div className="flex items-center gap-4">
            {/* Logo with quantum icon */}
            <Link href="/" className="flex items-center">
              <span className="sr-only">Dacroq</span>
              <div className="relative h-7 w-7 flex items-center justify-center"> {/* Reduced size from h-8 w-8 to h-7 w-7 */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  className="h-7 w-7 text-blue-600 dark:text-blue-400"
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
              <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"> {/* Reduced from text-lg to text-base */}
                Dacroq
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex">
              <div className="flex h-14 space-x-4"> {/* Reduced height from h-16 to h-14 */}
                <Link 
                  href="/" 
                  className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                    ${pathname === "/" 
                      ? "border-blue-500 text-gray-900 dark:text-white" 
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                    }`}
                >
                  Tests
                </Link>
                <Link 
                  href="/monitor"
                  className={`inline-flex items-center px-3 h-full border-b-2 text-sm font-medium transition-colors 
                    ${pathname.startsWith("/monitor") 
                      ? "border-blue-500 text-gray-900 dark:text-white" 
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700"
                    }`}
                >
                  Stats
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
          
          
              </div>
            </nav>
          </div>

          {/* Menu Dropdown Button (Mobile) */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                <span className="sr-only">Open menu</span>
                <RiMenuLine className="h-5 w-5" aria-hidden="true" /> {/* Reduced size from h-6 w-6 to h-5 w-5 */}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Link href="/" className="flex w-full">
                    Tests
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/monitor" className="flex w-full">
                    Stats
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
           
            
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400">
                  <button onClick={handleSignOut} className="flex w-full items-center">
                    <RiLogoutBoxLine className="mr-2 h-4 w-4" />
                    Sign Out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop Sign Out Button */}
            <div className="hidden md:flex items-center ml-4">
              <button 
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors flex items-center"
              >
                <RiLogoutBoxLine className="mr-1.5 h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Navigation }