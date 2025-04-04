"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/DropdownMenu";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface User {
  email: string;
  displayName?: string;
  photoURL?: string;
  uid?: string;
}

function DropdownUserProfile() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track if the avatar image fails to load.
  const [hasImageError, setHasImageError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Reset the error flag whenever the user's photoURL changes.
  useEffect(() => {
    setHasImageError(false);
  }, [user?.photoURL]);

  const getAvatarUrl = (user: User | null) => {
    if (!user) return null;
    return user.photoURL || null;
  };

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem("intentionalLogout", "true");
      localStorage.clear();
      setUser(null);
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  // Renders the avatar image if available and not in error, otherwise renders a fallback.
  const renderAvatar = () => {
    if (getAvatarUrl(user) && !hasImageError) {
      return (
        <img
          src={getAvatarUrl(user) || ""}
          alt={user?.displayName || "User"}
          className="w-8 h-8 rounded-full bg-white object-cover"
          onError={() => setHasImageError(true)}
        />
      );
    } else {
      const initials =
        user && user.displayName
          ? user.displayName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : user?.email?.charAt(0).toUpperCase() || "U";

      return (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
          {initials}
        </div>
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 p-0 hover:bg-transparent"
        >
          <div className="relative w-8 h-8">
            {renderAvatar()}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{user?.displayName || user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
    
          <DropdownMenuItem onClick={handleSignOut}>
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DropdownUserProfile };
