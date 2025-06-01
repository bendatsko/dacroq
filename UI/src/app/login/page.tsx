"use client";

// =============================================================================
// |                              DEPENDENCIES                                 |
// =============================================================================
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Icons & UI Components
import { RiGoogleFill } from "@remixicon/react";

// Authentication
import { auth, User } from "@/lib/auth";

// =============================================================================
// |                                TYPES                                      |
// =============================================================================
interface LoginState {
  error: string | null;
  isMounted: boolean;
  isProcessing: boolean;
  isLoggedIn: boolean;
}

// =============================================================================
// |                           LOGIN PAGE COMPONENT                           |
// =============================================================================
export default function LoginPage() {
  const router = useRouter();

  // ─────────────────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────────────────
  const [state, setState] = useState<LoginState>({
    error: null,
    isMounted: false,
    isProcessing: false,
    isLoggedIn: false,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Effects & Initialization
  // ─────────────────────────────────────────────────────────────────────────
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
          error: null  // Clear any errors when user is authenticated
        }));
        // Redirect immediately when user is authenticated
        router.push("/");
      } else {
        setState(prev => ({ ...prev, isLoggedIn: false }));
      }
    });

    return () => unsubscribe();
  }, []); // Remove the problematic dependency

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initiate Google Sign-In flow
   */
  const handleGoogleSignIn = async () => {
    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));

      // For existing authenticated sessions, skip sign-in
      const currentUser = auth.getCurrentUser();
      if (state.isLoggedIn && currentUser) {
        router.push("/");
        return;
      }

      const user = await auth.signInWithGooglePopup();
      // Auth state listener will handle the redirect
    } catch (error) {
      console.error("Error during sign-in:", error);
      setState(prev => ({
        ...prev,
        error: "An error occurred during sign in. Please try again.",
        isProcessing: false,
      }));
    }
  };

  // =============================================================================
  // |                                RENDER                                     |
  // =============================================================================
  return (
      <div className="min-h-screen bg-background flex flex-col transition-all duration-300">

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Navigation Header                                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {/*<nav className="w-full h-16 flex items-center px-8 border-b border-border bg-card/50 backdrop-blur-xl justify-between">*/}
        {/*  <div className="flex items-center gap-2.5">*/}
        {/*    <div className="h-9 w-9 flex items-center justify-center">*/}
        {/*      <RiCpuLine className="h-6 w-6 text-foreground" />*/}
        {/*    </div>*/}
        {/*    <span className="font-semibold text-foreground text-[19px] tracking-[-0.01em]">*/}
        {/*    Dacroq*/}
        {/*  </span>*/}
        {/*  </div>*/}

        {/*  <div className="flex items-center gap-3">*/}
        {/*    {state.isMounted && <ThemeToggle />}*/}
        {/*  </div>*/}
        {/*</nav>*/}


        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Main Content Area                                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-8 py-16">
          <div className="w-full max-w-md mx-auto">

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Standard Login Interface                                        */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-10 shadow-lg">

              {/* Login Header */}
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-foreground mb-3">
                  Welcome back
                </h2>
                <p className="text-muted-foreground text-lg">
                  Sign in to access your account
                </p>
              </div>

              {/* Error Display */}
              {state.error && (
                  <div className="mb-8 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                      {state.error}
                    </span>
                  </div>
                </div>
              )}

              {/* Google Sign-In Button */}
              <button
                  type="button"
                  className="w-full relative overflow-hidden group"
                  onClick={handleGoogleSignIn}
                  disabled={state.isProcessing}
              >

                <div className="relative flex items-center justify-center h-14 px-6 rounded-xl border border-border bg-background hover:bg-accent/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">

                  <span className="inline-flex items-center gap-3 text-base font-medium text-foreground">
                <RiGoogleFill className="h-5 w-5" />
                {state.isProcessing ? "Signing in..." : "Sign in with Google"}
              </span>
                </div>
              </button>

              {/* Already Signed In Notice */}
              {state.isLoggedIn && !state.isProcessing && (
                  <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground text-center">
                      You're already signed in. Click the button above to continue.
                    </p>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}