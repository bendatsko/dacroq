import './globals.css'
import type { Metadata } from 'next'
import { GeistSans } from "geist/font/sans"
import { AnnouncementProvider } from "@/components/AnnouncementProvider"

export const metadata: Metadata = {
  title: 'Dacroq - Hardware Test Platform',
  description: 'Hardware test monitoring and management platform',
}

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
        className={`${GeistSans.className} min-h-full bg-white antialiased`}
        suppressHydrationWarning
      >
        <AnnouncementProvider>
          {children}
        </AnnouncementProvider>
      </body>
    </html>
  )
}