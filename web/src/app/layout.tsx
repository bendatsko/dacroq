import './globals.css'
import type { Metadata } from 'next'
import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "@/lib/theme"

// =============================================================================
// |                              METADATA                                     |
// =============================================================================
export const metadata: Metadata = {
  title: 'Dacroq',
  description: 'A web based telemetry framework for electronics research.',
}

// =============================================================================
// |                            ROOT LAYOUT                                    |
// =============================================================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={`${GeistSans.className} min-h-full antialiased transition-colors duration-300`}
        suppressHydrationWarning
      >
        <ThemeProvider defaultTheme="system" storageKey="dacroq-ui-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}