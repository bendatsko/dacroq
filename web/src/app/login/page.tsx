"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RiGoogleFill } from "@remixicon/react";
import { auth, User } from "@/lib/auth";
import Link from "next/link";
import {DacroqLogo} from "@/components/DacroqLogo";

interface LoginState {
  error: string | null;
  isMounted: boolean;
  isProcessing: boolean;
  isLoggedIn: boolean;
}

export default function LoginPage() {
  const router = useRouter();

  // State Management
  const [state, setState] = useState<LoginState>({
    error: null,
    isMounted: false,
    isProcessing: false,
    isLoggedIn: false,
  });

  // Effects & Initialization
  useEffect(() => {
    setState(prev => ({ ...prev, isMounted: true }));

    // Handle intentional logout scenario
    const wasIntentionalLogout = sessionStorage.getItem("intentionalLogout") === "true";
    if (wasIntentionalLogout) {
      sessionStorage.removeItem("intentionalLogout");
      auth.signOut();
      return;
    }

    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (sessionStorage.getItem("intentionalLogout") === "true") {
        return;
      }

      if (user) {
        setState(prev => ({ 
          ...prev, 
          isLoggedIn: true,
          error: null
        }));
        router.push("/");
      } else {
        setState(prev => ({ ...prev, isLoggedIn: false }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Authentication Handlers
  const handleGoogleSignIn = async () => {
    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));
      const currentUser = auth.getCurrentUser();
      if (state.isLoggedIn && currentUser) {
        router.push("/");
        return;
      }
      const user = await auth.signInWithGooglePopup();
    } catch (error) {
      console.error("Error during sign-in:", error);
      setState(prev => ({
        ...prev,
        error: "An error occurred during sign in. Please try again.",
        isProcessing: false,
      }));
    }
  };

  return (
      <div className="min-h-screen bg-background flex  justify-center px-4">
        <div className="w-full max-w-md ">
          
          {/* Login Card */}
          <div className="mt-[24vh] bg-card border border-border rounded-xl p-12">
            
            {/* Header */}
            <div className="text-center mb-3">
              <div className="flex items-center justify-center mb-1">
                <DacroqLogo className="h-6 w-6 text-foreground/95" />
                <span className="text-xl font-semibold text-foreground/95">
                  Dacroq
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Please dont sign in.
              </p>
            </div>

            {/* Error Display */}
            {state.error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-600 dark:text-red-400">
                      {state.error}
                    </span>
                  </div>
                </div>
            )}

            {/* Google Sign-In Button */}
            <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={state.isProcessing}
                className="w-full h-11 flex items-center justify-center gap-3 px-4 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiGoogleFill className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">
                {state.isProcessing ? "Signing in..." : "Sign in with Google"}
              </span>
            </button>

            {/* Already Signed In Notice */}
            {state.isLoggedIn && !state.isProcessing && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    You're already signed in. Click the button above to continue.
                  </p>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}