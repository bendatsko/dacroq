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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
      // If logged out intentionally, do not auto-login
      if (sessionStorage.getItem("intentionalLogout") === "true") {
        return;
      }

      // Check if user is authenticated
      if (user) {
        // Instead of auto-login, just set the logged in state
        setIsLoggedIn(true);
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
        const settingsRef = doc(db, "system", "settings");
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists() && settingsDoc.data()?.maintenanceMode) {
          // Only allow admins during maintenance mode
          if (userData?.role !== "admin") {
            const maintenanceMessage = settingsDoc.data()?.maintenanceMessage || 
              "System is currently under maintenance. Only administrators can access the system.";
            
            setError(maintenanceMessage);
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
      
      // For existing authenticated sessions, skip sign-in
      if (isLoggedIn && auth.currentUser) {
        await handleSuccessfulLogin(auth.currentUser);
        return;
      }
      
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
      className="flex min-h-screen flex-col items-center justify-center px-4 py-20 lg:px-6 bg-gray-50"
      suppressHydrationWarning
    >
      <div className="relative sm:mx-auto sm:w-full sm:max-w-sm">
        
        
        <div className="bg-white p-8 shadow-sm rounded-lg border border-gray-100">
          {/* Brand section */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-medium text-gray-900 tracking-tight">Dacroq</h1>
            <p className="mt-2 text-sm text-gray-500">Hardware Test Platform</p>
          </div>
          
          {/* Error display */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Sign-in button */}
          <div className="mt-6">
            <Button
              type="button"
              variant="secondary"
              className="w-full flex items-center justify-center py-2.5"
              onClick={handleGoogleSignIn}
              disabled={isProcessing}
            >
              <span className="inline-flex items-center gap-2">
                <RiGoogleFill className="size-5" aria-hidden={true} />
                {isProcessing ? "Signing in..." : "Continue with Google"}
              </span>
            </Button>
          </div>

          {/* Status message when logged in but not auto-redirected */}
          {isLoggedIn && !isProcessing && (
            <div className="mt-6 rounded-md bg-blue-50 p-4 text-sm text-blue-800">
              You are signed in. Click the button above to continue to dashboard.
            </div>
          )}
        </div>

        {/* Terms of service */}
        <p className="mt-6 text-xs text-center text-gray-500">
          By signing in, you agree to our{" "}
          <a
            href="https://its.umich.edu/computing/ai/terms-of-service"
            className="underline underline-offset-2 text-blue-600"
          >
            terms of service
          </a>{" "}
          and{" "}
          <a
            href="https://spg.umich.edu/policy/601.07"
            className="underline underline-offset-2 text-blue-600"
          >
            privacy policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}