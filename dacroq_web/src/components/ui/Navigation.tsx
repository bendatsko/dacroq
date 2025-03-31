"use client"

import { TabNavigation, TabNavigationLink } from "@/components/TabNavigation"
import Link from "next/link"
import { Notifications } from "./Notifications"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/Logo"
import { DropdownUserProfile } from "./UserProfile"
import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

function Navigation() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
    <div className="shadow-s sticky top-0 z-20 bg-white dark:bg-gray-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 pt-3">
        <div>
          <span className="sr-only">Dacroq</span>
          <div className="relative">
            <img src="/Logo.svg" alt="Logo" className="block dark:hidden" />
            <img src="/Logo_White.svg" alt="Logo" className="hidden dark:block" />
          </div>
        </div>
        <div className="flex h-[42px] flex-nowrap gap-1">
          <Notifications />
          <DropdownUserProfile />
        </div>
      </div>
      <TabNavigation className="mt-5">
        <div className="mx-auto flex w-full max-w-7xl items-center px-6">
          <TabNavigationLink
            className="inline-flex gap-2"
            asChild
            active={pathname === "/"}
          >
            <Link href="/">Overview</Link>
          </TabNavigationLink>

          <TabNavigationLink
              className="inline-flex gap-2"
              asChild
              active={pathname === "/analytics"}
          >
            <Link href="/analytics">Analytics</Link>
          </TabNavigationLink>

          <TabNavigationLink
            className="inline-flex gap-2"
            asChild
            active={pathname === "/documentation"}
          >
            <Link href="/documentation">Documentation</Link>
          </TabNavigationLink>

          <TabNavigationLink
              className="inline-flex gap-2"
              asChild
              active={pathname === "/community"}
          >
            <Link href="/community">Community</Link>
          </TabNavigationLink>

          {/* Admin tab - only rendered if user is admin */}
          {isAdmin && (
            <TabNavigationLink
              className="inline-flex gap-2"
              asChild
              active={pathname === "/admin"}
            >
              <Link href="/admin">Admin</Link>
            </TabNavigationLink>
          )}
        </div>
      </TabNavigation>
    </div>
  )
}

export { Navigation }