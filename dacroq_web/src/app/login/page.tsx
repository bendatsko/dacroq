"use client";

import { useRouter } from "next/navigation";
import { RiGoogleFill } from "@remixicon/react";
import { Button } from "@/components/Button";
import { signInWithGoogle, auth } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ensure this code runs only client-side.
  useEffect(() => {
    console.log("LoginPage mounted");
    setIsMounted(true);

    // Listen for authentication state changes as a backup
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? "User logged in" : "No user");

      if (user && !isProcessing) {
        await handleSuccessfulLogin(user);
      }
    });

    return () => unsubscribe();
  }, [router, isMounted]);

  // Function to handle successful login
  const handleSuccessfulLogin = async (user) => {
    if (isProcessing) return; // Prevent duplicate processing
    setIsProcessing(true);

    try {
      console.log("Processing login for user:", user.email);

      // User is signed in. Proceed with Firestore user document update.
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.exists() ? userDoc.data() : null;

      console.log("User data:", userData);

      // Check maintenance mode.
      const maintenanceRef = doc(db, "system", "maintenance");
      const maintenanceDoc = await getDoc(maintenanceRef);
      const maintenanceMode = maintenanceDoc.exists() && maintenanceDoc.data()?.enabled;
      if (maintenanceMode) {
        const whitelistedEmails = maintenanceDoc.data()?.whitelistedEmails || [];
        if (userData?.role !== "admin" && !whitelistedEmails.includes(user.email)) {
          setError("System is currently under maintenance. Only administrators and whitelisted users may access at this time.");
          setIsProcessing(false);
          return;
        }
      }

      // Check for a disabled account.
      if (userData?.accountState === "disabled") {
        setError("Access denied. Please contact support if you believe this is an error.");
        setIsProcessing(false);
        return;
      }

      // Create or update the user document.
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: userData?.createdAt || serverTimestamp(),
          lastLogin: serverTimestamp(),
          testsRun: userData?.testsRun || 0,
          accountState: userData?.accountState || "enabled",
          role: userData?.role || "user"
        },
        { merge: true }
      );

// Store minimal user info in localStorage.
      if (isMounted) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: userData?.role || "user"  // Also store role for easier access
          })
        );
      }

      console.log("Redirecting to dashboard...");

      // Try both methods for redirection
      router.push("/");

      // Method 2: Add a backup with a slight delay using window.location
      setTimeout(() => {
        if (document.location.pathname.includes("login")) {
          console.log("Backup redirect triggered");
          window.location.href = "/";
        }
      }, 1000);

    } catch (err) {
      console.error("Error handling login:", err);
      setError("An error occurred while processing your login. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log("Starting Google sign-in process...");
      // Clear any previous errors
      setError(null);

      // Using popup authentication - this will handle everything in the current window
      const result = await signInWithGoogle();
      console.log("Sign-in successful, user:", result.user.email);

      // Process the login with the returned user
      await handleSuccessfulLogin(result.user);
    } catch (error) {
      console.error("Error during sign-in", error);
      setError("An error occurred during sign in. Please try again.");
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-28 lg:px-6"
      suppressHydrationWarning
    >
      <div className="relative sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Background decoration and logo code remains unchanged */}
        <div className="relative mx-auto w-fit">
          <span className="sr-only">Dacroq</span>
          <div className="relative">
            <img src="/Logo.svg" alt="Logo" className="block dark:hidden h-12" />
            <img src="/Logo_White.svg" alt="Logo" className="hidden dark:block h-12" />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/10 dark:text-red-500">
            {error}
          </div>
        )}

        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isProcessing}
          >
            <span className="inline-flex items-center gap-2">
              <RiGoogleFill className="size-5" aria-hidden={true} />
              {isProcessing ? "Processing..." : "Continue with Google"}
            </span>
          </Button>
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
          By signing in, you agree to our{" "}
          <a
            href="https://its.umich.edu/computing/ai/terms-of-service"
            className="underline underline-offset-2"
          >
            terms of service
          </a>{" "}
          and{" "}
          <a
            href="https://spg.umich.edu/policy/601.07"
            className="underline underline-offset-2"
          >
            privacy policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}