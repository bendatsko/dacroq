import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// This is the standard shadcn utility function
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// These are for backward compatibility with your existing components
export const cx = cn;
export const focusRing = "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";