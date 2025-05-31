"use client";

// =============================================================================
// |                              DEPENDENCIES                                 |
// =============================================================================
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Icons & UI Components
import { RiGoogleFill, RiCpuLine } from "@remixicon/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Authentication
import { auth, User } from "@/lib/auth";
import Navigation from "@/components/ui/Navigation";

// =============================================================================
// |                                TYPES                                      |
// =============================================================================
interface LoginState {
  error: string | null;
  isMounted: boolean;
  isProcessing: boolean;
  isLoggedIn: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
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
    maintenanceMode: false,
    maintenanceMessage: "",
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Effects & Initialization
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setState(prev => ({ ...prev, isMounted: true }));

    // Check maintenance mode status
    const checkMaintenanceMode = async () => {
      try {
        const { maintenanceMode: isMaintenanceMode, message } = await auth.checkMaintenanceMode();
        setState(prev => ({
          ...prev,
          maintenanceMode: isMaintenanceMode,
          maintenanceMessage: message || "System is currently under maintenance. Please check back later.",
        }));
      } catch (err) {
        console.warn("Could not check maintenance status:", err);
      }
    };

    checkMaintenanceMode();

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
        // Check if user is admin before checking maintenance mode
        if (user.role === "admin" || !state.maintenanceMode) {
          setState(prev => ({ ...prev, isLoggedIn: true }));
        } else if (state.maintenanceMode) {
          setState(prev => ({
            ...prev,
            error: "System is currently under maintenance. Only administrators can access the system.",
          }));
          return;
        }
      }
    });

    return () => unsubscribe();
  }, [state.maintenanceMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process successful user authentication and handle redirects
   */
  const handleSuccessfulLogin = async (user: User) => {
    if (state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Check maintenance mode for non-admin users
      if (user.role !== "admin") {
        const { maintenanceMode: isMaintenanceMode, message } = await auth.checkMaintenanceMode();
        if (isMaintenanceMode) {
          const maintenanceMessage = message || "System is currently under maintenance. Only administrators can access the system.";
          setState(prev => ({
            ...prev,
            error: maintenanceMessage,
            isProcessing: false,
          }));
          return;
        }
      }

      // Redirect to dashboard
      router.push("/");
    } catch (err) {
      console.error("Error handling login:", err);
      setState(prev => ({
        ...prev,
        error: "An error occurred while processing your login. Please try again.",
        isProcessing: false,
      }));
    }
  };

  /**
   * Initiate Google Sign-In flow
   */
  const handleGoogleSignIn = async () => {
    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));

      // For existing authenticated sessions, skip sign-in
      const currentUser = auth.getCurrentUser();
      if (state.isLoggedIn && currentUser) {
        await handleSuccessfulLogin(currentUser);
        return;
      }

      const user = await auth.signInWithGooglePopup();
      await handleSuccessfulLogin(user);
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

        <Navigation />

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Main Content Area                                                     */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-8 py-16">
          <div className="w-full max-w-md mx-auto">

            {state.maintenanceMode ? (
                /* ═══════════════════════════════════════════════════════════════ */
                /* Maintenance Mode Interface                                      */
                /* ═══════════════════════════════════════════════════════════════ */
                <div className="bg-card border border-border rounded-2xl p-10 shadow-lg">
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-xl bg-orange-500/10 mb-8">
                      <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-4">
                      System Maintenance
                    </h2>

                    <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                      {state.maintenanceMessage}
                    </p>

                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-5 mb-8">
                      <p className="text-sm text-orange-600 dark:text-orange-400 leading-relaxed">
                        We're working to improve your experience. Please check back in a few minutes.
                      </p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-8 py-3 border border-transparent text-sm font-medium rounded-lg text-orange-700 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-all duration-200"
                    >
                      Check Again
                    </button>
                  </div>
                </div>
            ) : (
                /* ═══════════════════════════════════════════════════════════════ */
                /* Standard Login Interface                                        */
                /* ═══════════════════════════════════════════════════════════════ */
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
            )}
          </div>
        </div>
      </div>
  );
}