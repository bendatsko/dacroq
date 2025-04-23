"use client";

// React and Next.js imports
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// UI components and icons
import { RiGoogleFill } from "@remixicon/react";
import { Button } from "@/components/Button";

// Firebase imports
import { auth, db, signInWithGoogle } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Enable client-side features after hydration
    setIsMounted(true);

    // Handle intentional logout scenario
    const wasIntentionalLogout = sessionStorage.getItem("intentionalLogout") === "true";
    if (wasIntentionalLogout) {
      // Clear the flag to prevent repeated signouts
      sessionStorage.removeItem("intentionalLogout");
      auth.signOut();
      return;
    }

    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Double-check logout flag in case it was set after initial check
      if (sessionStorage.getItem("intentionalLogout") === "true") {
        return;
      }

      // Process auto-login if user exists and we're not already processing
      if (user && !isProcessing) {
        await handleSuccessfulLogin(user);
      }
    });

    // Clean up listener on component unmount
    return () => unsubscribe();
  }, []);

  /**
   * Process user authentication and verify account status
   * Updates Firestore user document and stores minimal user info locally
   */
  const handleSuccessfulLogin = async (user: FirebaseUser) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Fetch current user data from Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.exists() ? userDoc.data() : null;

      // Check system maintenance status
      try {
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
      } catch (err) {
        // Fail open if maintenance check fails - allow login to proceed
        console.warn("Could not verify maintenance status:", err);
      }

      // Check for account restrictions
      if (userData?.accountState === "disabled") {
        setError("Access denied. Please contact support if you believe this is an error.");
        setIsProcessing(false);
        return;
      }

      // Update user document with latest info
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

      // Store minimal user profile for client-side access
      if (isMounted) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: userData?.role || "user"
          })
        );
      }

      // Redirect to dashboard
      router.push("/");
    } catch (err) {
      console.error("Error handling login:", err);
      setError("An error occurred while processing your login. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Initiate Google Sign-In flow
   */
  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const result = await signInWithGoogle();
      await handleSuccessfulLogin(result.user);
    } catch (error) {
      console.error("Error during sign-in:", error);
      setError("An error occurred during sign in. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-28 lg:px-6"
      suppressHydrationWarning
    >
      <div className="relative sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Logo section */}
        <div className="relative mx-auto w-fit">
          <span className="sr-only">Dacroq</span>
          <div className="relative">
            <img src="/Logo.svg" alt="Logo" className="block dark:hidden h-12" />
            <img src="/Logo_White.svg" alt="Logo" className="hidden dark:block h-12" />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/10 dark:text-red-500">
            {error}
          </div>
        )}

        {/* Sign-in button */}
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
              {isProcessing ? "Logging you in..." : "Continue with Google"}
            </span>
          </Button>
        </div>

        {/* Terms of service */}
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